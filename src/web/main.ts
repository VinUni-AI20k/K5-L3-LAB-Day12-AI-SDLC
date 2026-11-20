// Web client: renders sim state with Three.js, runs the 3-night flow and menus, pushes inputs. No gameplay rules here (those live in src/sim).
// Randomness/Date in this file is fine: it only picks the seed of a new web game and drives visual effects.
import * as THREE from "three";
import { DT, TUNING, toTicks } from "../sim/config";
import { Sim } from "../sim/sim";
import type { InputState, SimEvent } from "../sim/types";
import { GameAudio } from "./audio";
import { ACTIONS, ACTION_LABELS, defaultKeymap, keyLabel, rebind, type Action } from "./keymap";
import { Leaderboard, nowIso, validateName, type LeaderboardStorage } from "./leaderboard";
import { PALETTE, ambientIntensity, css } from "./palette";
import { createBenchSim, benchCamera } from "../bench/scene";
import { buildNight, buildSea } from "./scene";
import { loadSettings, saveSettings, type Settings } from "./settings";

type Night = 1 | 2 | 3;
type Mode = "menu" | "intro" | "playing" | "paused" | "result" | "dawn" | "bench";

const NIGHT_INFO: Record<Night, { name: string; line: string }> = {
  1: { name: "Đảo Bến", line: "Mây à, đảo Bến tối rồi. Gom đom đóm, thắp năm ngọn đèn lồng trước bình minh nhé." },
  2: { name: "Đảo Cau", line: "Hai hòn đảo nối nhau bằng cây cầu tre. Cẩn thận Gió Lạc, nó thích cuỗm đom đóm của cháu lắm." },
  3: { name: "Đảo Chuông", line: "Đảo Chuông có ba tầng, gió lại mạnh. Ngọn đèn cuối cùng ở sát tháp chuông, cố lên Mây!" },
};

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const dusk = new THREE.Color(PALETTE.nightSky);
const dawnTint = new THREE.Color(PALETTE.fog);
scene.background = dusk.clone();
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.012);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
const ambient = new THREE.AmbientLight(0xb8b0e0, ambientIntensity(0, 1)); // intensity = 0.15 + 0.55 * lit / total (set in sync)
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb8c4ff, 1.6);
moon.position.set(-30, 50, -20);
scene.add(moon);

const mat = (c: number, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color: c, emissive, emissiveIntensity: ei, roughness: 0.8 });

// player: body + scarf + conical hat with a small lantern
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 10), mat(PALETTE.mayShirt));
body.position.y = 0.8;
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), mat(PALETTE.mayScarf));
scarf.rotation.x = Math.PI / 2;
scarf.position.y = 1.3;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 16), mat(0x9a6b3a));
hat.position.y = 1.75;
const hatLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mat(0xffd27a, 0xffb040, 2));
hatLantern.position.set(0.5, 1.35, 0);
const playerLight = new THREE.PointLight(0xffb86b, 14, 16);
playerLight.position.set(0.5, 1.4, 0);
player.add(body, scarf, hat, hatLantern, playerLight);
scene.add(player);

interface LanternView { lamp: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh; fill: THREE.Mesh; bar: THREE.Group; barFg: THREE.Mesh; tears: THREE.Group }
const lanternViews = new Map<string, LanternView>();
let nightGroup: THREE.Group | undefined;
let seaMesh: THREE.Mesh | undefined;
const moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
const moteMat = new THREE.MeshStandardMaterial({ color: PALETTE.moteCore, emissive: PALETTE.moteHalo, emissiveIntensity: 2.2 });
const droppedMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 1.6 });
const moteViews = new Map<string, THREE.Mesh>();
const shadeGeo = new THREE.SphereGeometry(0.9, 16, 14);
const shadeViews = new Map<string, THREE.Mesh>();
const drifterGeo = new THREE.TorusKnotGeometry(0.5, 0.12, 48, 8);
const drifterViews = new Map<string, THREE.Mesh>();
const charmViews = new Map<string, THREE.Mesh>();
const rings: Array<{ mesh: THREE.Mesh; age: number }> = [];

// ---------- session ----------
let sim = new Sim(1);
let night: Night = 1;
let mode: Mode = "menu";
let totalScore = 0;
let nightsWon = 0;
let lastSeed = 0;

// leaderboard: Electron stores it in a file in userData (over IPC); the plain web build uses localStorage
const LB_KEY = "ddl.leaderboard.v1";
const lbStorage: LeaderboardStorage = {
  read: () => {
    const shell = (window as unknown as { ddl?: { leaderboard?: LeaderboardStorage } }).ddl?.leaderboard;
    if (shell) return shell.read();
    try { return JSON.parse(localStorage.getItem(LB_KEY) ?? "null"); } catch { return null; }
  },
  write: (v) => {
    const shell = (window as unknown as { ddl?: { leaderboard?: LeaderboardStorage } }).ddl?.leaderboard;
    if (shell) { shell.write(v); return; }
    try { localStorage.setItem(LB_KEY, JSON.stringify(v)); } catch { /* storage blocked: the score is just not saved */ }
  },
};
const board = new Leaderboard(lbStorage);
let acc = 0;
let lastT = 0;
let yaw = 0; // cam_yaw_deg in radians: forward (input z=+1) is (sin, cos)
let toastTimer = 0;
let shake = 0; // seconds of camera shake left (always 0 with reduced motion)
const settings: Settings = loadSettings();
const audio = new GameAudio();
document.body.classList.toggle("cb", settings.colorBlind);
document.documentElement.classList.toggle("large", settings.largeText);
audio.setVolume(settings.volume);
let lastCountdown = 99;
const keys = new Set<string>();
const latch = { jump: false, interact: false, pulse: false, dash: false };

function clearViews(): void {
  for (const m of [...moteViews.values(), ...shadeViews.values(), ...drifterViews.values(), ...charmViews.values()]) scene.remove(m);
  moteViews.clear(); shadeViews.clear(); drifterViews.clear(); charmViews.clear();
  for (const v of lanternViews.values()) scene.remove(v.lamp.parent!);
  lanternViews.clear();
}

function buildLanterns(s: Sim): void {
  for (const l of s.lanterns) {
    const g = new THREE.Group();
    g.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(PALETTE.wood));
    pole.position.y = 1.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), mat(PALETTE.lanternOff));
    lamp.position.y = 3.6;
    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 40);
    light.position.y = 3.6;
    const zone = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.05;
    zone.visible = false;
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), mat(0x554466));
    fill.position.y = 0.1;
    // fuel bar over the lamp (faces the camera) and torn-paper marks for the colour-blind mode
    const bar = new THREE.Group();
    bar.position.y = 5.1;
    bar.scale.setScalar(1.7);
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.24), new THREE.MeshBasicMaterial({ color: 0x120a1a, transparent: true, opacity: 0.8 }));
    const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit }));
    barFg.position.z = 0.01;
    bar.add(barBg, barFg);
    bar.visible = false;
    const tears = new THREE.Group();
    tears.position.y = 3.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.06), new THREE.MeshBasicMaterial({ color: PALETTE.nightSky }));
      tear.position.set(Math.cos(a) * 0.72, 0.15 * Math.sin(i * 2.3), Math.sin(a) * 0.72);
      tear.rotation.set(0, -a, 0.4 + 0.3 * (i % 2));
      tears.add(tear);
    }
    tears.visible = false;
    g.add(pole, lamp, light, zone, fill, bar, tears);
    scene.add(g);
    lanternViews.set(l.id, { lamp, light, zone, fill, bar, barFg, tears });
  }
}

function loadNightScene(n: Night): void {
  lowAnnounced.clear();
  lastWindWarn = -1;
  caps.length = 0;
  clearViews();
  if (nightGroup) scene.remove(nightGroup);
  if (seaMesh) scene.remove(seaMesh);
  nightGroup = buildNight(n);
  seaMesh = buildSea(n);
  scene.add(nightGroup, seaMesh);
  buildLanterns(sim);
}

/** Start (or restart) one night with a fresh sim. */
function startNight(n: Night): void {
  night = n;
  const seed = Number(new URLSearchParams(location.search).get("seed")) || Math.floor(Math.random() * 1e9);
  lastSeed = seed;
  sim = new Sim(seed, {}, n);
  (window as unknown as { __ddl: unknown }).__ddl = { get sim() { return sim; } };
  loadNightScene(n);
  acc = 0;
  yaw = 0;
  mode = "playing";
  lastCountdown = 99;
  audio.startMusic(n);
  hideOverlay();
}

// ---------- overlays / menus ----------
const $ = (id: string) => document.getElementById(id)!;
const flamesEl = $("flames"), clockEl = $("clock"), topRight = $("topright"), moteBar = $("motebar"), cdsEl = $("cds"), promptEl = $("prompt"), arrowEl = $("arrow"), fpsEl = $("fps"), toast = $("toast"), flash = $("flash"), overlay = $("overlay"), card = overlay.firstElementChild as HTMLElement;

// ---------- captions and visual cues (Ticket-04 section 4) ----------
const captionsEl = $("captions"), arrow2El = $("arrow2"), helpEl = $("help");
const caps: Array<{ key: string; text: string; until: number }> = [];
function caption(key: string, text: string, ms = 4000): void {
  const until = performance.now() + ms;
  const old = caps.find((c) => c.key === key);
  if (old) { old.text = text; old.until = until; } else caps.push({ key, text, until });
}
function renderCaptions(now: number): void {
  for (let i = caps.length - 1; i >= 0; i--) if (caps[i]!.until <= now) caps.splice(i, 1);
  const html = caps.slice(-3).map((c) => `<div class="cap">${c.text}</div>`).join("");
  if (captionsEl.dataset.h !== html) { captionsEl.innerHTML = html; captionsEl.dataset.h = html; }
}
let spawnCue: { id: string; until: number } | null = null; // edge arrow towards a newly spawned shade
const lowAnnounced = new Set<string>();
let lastWindWarn = -1;
function updateHelp(): void {
  const k = (a: Action): string => keyLabel(km()[a]);
  helpEl.textContent = `${k("forward")}${k("left")}${k("back")}${k("right")} đi · ${k("jump")} nhảy · ${k("dash")} lướt · ${k("interact")} nạp đèn · ${k("pulse")} tỏa sáng · ${k("pause")} tạm dừng · F3 FPS · ← → / kéo chuột xoay camera`;
}
/** Captions driven by the sim state: wind coming, last 10 s, a lantern below 30 fuel. */
function updateCaptions(): void {
  const st = sim.st;
  if (sim.def.wind) {
    const warn = st >= 1680 && st % 1800 >= 1680; // 2 s before each gust (gusts start at ticks 1800k)
    const gust = Math.floor(st / 1800);
    if (warn && gust !== lastWindWarn) { lastWindWarn = gust; caption("wind", "⚠ 🌬 Gió sắp nổi trong 2 giây!", 2200); }
    if (sim.windActive) caption("wind", "🌬 Gió đang thổi, hãy bám chắc!", 700);
  }
  const left = Math.ceil(sim.timeLeft);
  if (left <= 10 && left >= 1) caption("time", `⏳ Còn ${left} giây tới bình minh!`, 1200);
  for (const l of sim.lanterns) {
    const low = l.lit && l.fuelU < TUNING.low_fuel_threshold * 60;
    if (low && !lowAnnounced.has(l.id)) { lowAnnounced.add(l.id); caption("low" + l.id, `⚠ Đèn ${l.id} sắp cạn dầu (${Math.round(l.fuelU / 6) / 10})`, 4500); }
    if (!low) lowAnnounced.delete(l.id);
  }
}
/** Arrow at the screen edge pointing to the shade that just appeared, until it is on screen or 6 s have passed. */
function updateSpawnArrow(now: number): void {
  const sh = spawnCue && now < spawnCue.until ? sim.shades.find((s) => s.id === spawnCue!.id) : undefined;
  if (!sh || mode !== "playing") { arrow2El.style.display = "none"; return; }
  tmp.set(sh.pos[0], sh.pos[1], sh.pos[2]).project(camera);
  const behind = tmp.z > 1;
  if (!behind && Math.abs(tmp.x) < 0.92 && Math.abs(tmp.y) < 0.88) { arrow2El.style.display = "none"; return; }
  let dx = behind ? -tmp.x : tmp.x, dy = behind ? -tmp.y : tmp.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const W = window.innerWidth, H = window.innerHeight;
  arrow2El.style.display = "block";
  arrow2El.style.left = `${W / 2 + dx * W * 0.45 - 17}px`;
  arrow2El.style.top = `${H / 2 - dy * H * 0.42 - 17}px`;
  arrow2El.style.transform = `rotate(${Math.atan2(-dy, dx)}rad)`;
}

function showCard(html: string, handlers: Record<string, () => void> = {}): void {
  card.innerHTML = html;
  overlay.style.display = "flex";
  for (const [id, fn] of Object.entries(handlers)) card.querySelector<HTMLElement>(`#${id}`)?.addEventListener("click", fn);
}
function hideOverlay(): void { overlay.style.display = "none"; }
function showToast(text: string): void {
  toast.textContent = text;
  toast.style.opacity = "1";
  toastTimer = 2.2;
}

function showMenu(): void {
  mode = "menu";
  audio.stopMusic();
  showCard(
    `<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Nhặt đom đóm, thắp sáng những Đèn Lồng Lớn trước bình minh.</p>
     <button id="play">Chơi</button><button id="board" class="alt">Bảng xếp hạng</button><button id="settings" class="alt">Cài đặt</button>`,
    { play: () => { totalScore = 0; nightsWon = 0; showIntro(1); }, board: () => showLeaderboard(showMenu), settings: () => showSettings(showMenu) },
  );
}

function showIntro(n: Night): void {
  mode = "intro";
  night = n;
  const info = NIGHT_INFO[n];
  showCard(
    `<p class="kicker">Đêm ${n}</p><h1>${info.name}</h1><p class="speech"><b>Ông Đăng:</b> “${info.line}”</p><button id="go">Bắt đầu đêm ${n}</button>`,
    { go: () => startNight(n) },
  );
}

function showSettings(back: () => void): void {
  showCard(
    `<h1>Cài đặt</h1>
     <label>Âm lượng <input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"></label>
     <label>Độ nhạy chuột <input id="sens" type="range" min="20" max="300" value="${Math.round(settings.sensitivity * 100)}"></label>
     <label>Bảng màu dễ phân biệt <input id="cb" type="checkbox" ${settings.colorBlind ? "checked" : ""}></label>
     <label>Giảm chuyển động (không rung, không nháy màn hình) <input id="rm" type="checkbox" ${settings.reducedMotion ? "checked" : ""}></label>
     <label>Chữ lớn (×1.25) <input id="lt" type="checkbox" ${settings.largeText ? "checked" : ""}></label>
     <h2 style="font-size:1.1rem;margin:10px 0 4px">Phím điều khiển</h2>
     <div id="keys" style="display:grid;grid-template-columns:1fr auto;gap:4px 12px;text-align:left"></div>
     <p id="keymsg" style="min-height:1.4em;margin:4px 0;color:var(--danger)"></p>
     <button id="krestore" class="alt">Khôi phục mặc định</button><button id="back">Xong</button>`,
    { back: () => { keyCapture = null; back(); } },
  );
  const keysBox = card.querySelector<HTMLElement>("#keys")!;
  const keyMsg = card.querySelector<HTMLElement>("#keymsg")!;
  const drawKeys = (waiting: Action | null = null): void => {
    keysBox.innerHTML = ACTIONS.map((a) => `<span>${ACTION_LABELS[a]}</span><button data-a="${a}" class="alt" style="margin:0;padding:2px 14px;min-width:6rem">${waiting === a ? "Nhấn phím…" : esc(keyLabel(km()[a]))}</button>`).join("");
    for (const b of Array.from(keysBox.querySelectorAll<HTMLButtonElement>("button"))) {
      b.addEventListener("click", () => {
        const a = b.dataset.a as Action;
        keyMsg.textContent = "";
        drawKeys(a);
        keyCapture = (k) => { // the next key press is the new binding; a duplicate or reserved key is reported, not applied
          keyCapture = null;
          const r = rebind(km(), a, k);
          if (r.ok) { settings.keymap = r.map; saveSettings(settings); updateHelp(); }
          else keyMsg.textContent = r.reason === "reserved" ? `⚠ Phím ${keyLabel(k)} dành riêng, hãy chọn phím khác.` : `⚠ Phím ${keyLabel(k)} đã dùng cho "${ACTION_LABELS[r.conflictWith!]}".`;
          drawKeys();
        };
      });
    }
  };
  drawKeys();
  card.querySelector("#krestore")!.addEventListener("click", () => { keyCapture = null; settings.keymap = defaultKeymap(); saveSettings(settings); updateHelp(); keyMsg.textContent = ""; drawKeys(); });
  card.querySelector<HTMLInputElement>("#rm")!.addEventListener("change", (e) => { settings.reducedMotion = (e.target as HTMLInputElement).checked; saveSettings(settings); });
  card.querySelector<HTMLInputElement>("#lt")!.addEventListener("change", (e) => { settings.largeText = (e.target as HTMLInputElement).checked; document.documentElement.classList.toggle("large", settings.largeText); saveSettings(settings); });
  card.querySelector<HTMLInputElement>("#cb")!.addEventListener("change", (e) => { settings.colorBlind = (e.target as HTMLInputElement).checked; document.body.classList.toggle("cb", settings.colorBlind); saveSettings(settings); });
  card.querySelector<HTMLInputElement>("#vol")!.addEventListener("input", (e) => { settings.volume = Number((e.target as HTMLInputElement).value) / 100; audio.setVolume(settings.volume); audio.init(); audio.sfx("pickup"); saveSettings(settings); });
  card.querySelector<HTMLInputElement>("#sens")!.addEventListener("input", (e) => { settings.sensitivity = Number((e.target as HTMLInputElement).value) / 100; saveSettings(settings); });
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function showLeaderboard(back: () => void, highlight: number | null = null): void {
  const rows = board.entries();
  const body = rows.length
    ? rows.map((e, i) => `<tr${highlight === i + 1 ? ' style="color:#F2C14E;font-weight:700"' : ""}><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td style="font-size:1rem;opacity:.8">${esc(e.achieved_at.slice(0, 16).replace("T", " "))}</td></tr>`).join("")
    : '<tr><td colspan="5" style="opacity:.7">Chưa có ai. Hãy là người đầu tiên!</td></tr>';
  showCard(
    `<h1>Bảng xếp hạng</h1><table style="margin:8px auto;border-collapse:collapse;text-align:left"><thead><tr style="opacity:.7"><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Lúc</th></tr></thead><tbody>${body}</tbody></table><button id="back">Xong</button>`,
    { back },
  );
}

/** Name entry after the Dawn screen or a loss: 3-12 characters, then save to the leaderboard. */
function showNameEntry(after: () => void): void {
  showCard(
    `<h1>Lưu điểm</h1><p>Điểm: <b>${totalScore}</b> · ${nightsWon}/3 đêm thắng</p>
     <p><input id="pname" maxlength="12" placeholder="Tên (3-12 ký tự)" autocomplete="off" style="font-size:1.11111rem;padding:8px;width:220px;text-align:center"></p>
     <p id="perr" style="color:var(--danger);min-height:1.4em;margin:0"></p>
     <button id="psave">Lưu</button><button id="pskip" class="alt">Bỏ qua</button>`,
    { pskip: after },
  );
  const input = card.querySelector<HTMLInputElement>("#pname")!;
  const err = card.querySelector<HTMLElement>("#perr")!;
  input.focus();
  const save = (): void => {
    if (!validateName(input.value)) { err.textContent = "Tên gồm 3-12 ký tự: chữ cái, số hoặc _ (không dấu cách)."; return; }
    const r = board.submit({ name: input.value, score: totalScore, nights_won: nightsWon, achieved_at: nowIso(), seed: lastSeed });
    showLeaderboard(after, r.rank);
  };
  card.querySelector("#psave")!.addEventListener("click", save);
  input.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") save(); });
}

function showPause(): void {
  showCard(
    `<h1>Tạm dừng</h1><button id="cont">Tiếp tục</button><button id="replay" class="alt">Chơi lại đêm này</button>
     <button id="settings" class="alt">Cài đặt</button><button id="menu" class="alt">Về menu</button>`,
    { cont: togglePause, replay: () => startNight(night), settings: () => showSettings(showPause), menu: showMenu },
  );
}

/** Pause/resume through the sim itself, so the logic really stops (and `sim_tick` freezes). */
function togglePause(): void {
  if (mode === "playing") {
    sim.step({ ...idleInput(), pause: true });
    sim.step({ ...idleInput(), pause: false }); // release the edge; stays paused
    mode = "paused";
    audio.stopMusic();
    showPause();
  } else if (mode === "paused") {
    hideOverlay();
    sim.step({ ...idleInput(), pause: true }); // the resuming step runs fully with idle input
    mode = "playing";
    audio.startMusic(night);
  }
}

function endScreen(): void {
  const won = sim.state === "won";
  if (won) { totalScore += sim.score; nightsWon++; }
  if (won && night === 3) {
    mode = "dawn";
    showCard(`<h1>Bình minh!</h1><p>Bạn đã giữ đèn sáng đến bình minh trên cả ba hòn đảo. Ông Đăng mỉm cười: “Giỏi lắm, Mây.”</p><p>Tổng điểm: <b>${totalScore}</b></p><button id="save">Lưu điểm</button><button id="menu" class="alt">Về menu</button>`, { save: () => showNameEntry(showMenu), menu: showMenu });
    return;
  }
  mode = "result";
  if (won) {
    showCard(`<h1>Đêm ${night} đã qua!</h1><p>Bạn giữ đèn sáng đến bình minh (${sim.lanterns.filter((l) => l.lit).length}/${sim.lanterns.length} đèn).</p><p>Điểm đêm này: <b>${sim.score}</b> · Tổng: <b>${totalScore}</b></p><button id="next">Đêm tiếp theo</button><button id="menu" class="alt">Về menu</button>`,
      { next: () => showIntro((night + 1) as Night), menu: showMenu });
  } else {
    const litNow = sim.lanterns.filter((l) => l.lit).length;
    const need = Math.ceil((sim.lanterns.length * Math.round(TUNING.win_ratio * 100)) / 100);
    const reason = sim.player.flames <= 0 ? "Bạn hết ngọn lửa." : `Bình minh đến nhưng chỉ ${litNow}/${sim.lanterns.length} đèn còn sáng (cần ${need}).`;
    showCard(`<h1>Màn đêm thắng rồi</h1><p>${reason}</p><p>Điểm: <b>${sim.score}</b></p><button id="replay">Chơi lại đêm ${night} (R)</button><button id="save" class="alt">Lưu điểm</button><button id="menu" class="alt">Về menu</button>`,
      { replay: () => startNight(night), save: () => showNameEntry(showMenu), menu: showMenu });
  }
}

// ---------- input ----------
const idleInput = (): InputState => ({ move: [0, 0], cam_yaw_deg: (yaw * 180) / Math.PI, jump: false, interact: false, pulse: false, dash: false, pause: false });
const km = () => settings.keymap;
const isGameKey = (k: string): boolean => k === "f3" || k.startsWith("arrow") || (Object.values(km()) as string[]).includes(k) || (k === "p" && km().pause === "escape");
let keyCapture: ((k: string) => void) | null = null; // set while the settings screen waits for a key to bind
window.addEventListener("pointerdown", () => audio.init());
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement | null)?.tagName === "INPUT") return; // typing a name: no game keys
  audio.init();
  const k = e.key.toLowerCase();
  if (keyCapture) { e.preventDefault(); if (!e.repeat) keyCapture(k); return; }
  if (isGameKey(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === "f3") { fpsOn = !fpsOn; fpsEl.style.display = fpsOn ? "block" : "none"; fpsFrames = 0; fpsStart = performance.now(); return; }
  if (k === km().pause || (k === "p" && km().pause === "escape")) { togglePause(); return; }
  keys.add(k);
  if (k === km().jump) { latch.jump = true; if (mode === "playing" && sim.grounded) audio.sfx("jump"); }
  if (k === km().interact) latch.interact = true;
  if (k === km().pulse) latch.pulse = true;
  if (k === km().dash) latch.dash = true;
  if (k === "r" && mode === "result") startNight(night);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let drag = false;
renderer.domElement.addEventListener("pointerdown", () => (drag = true));
window.addEventListener("pointerup", () => (drag = false));
window.addEventListener("pointermove", (e) => { if (drag && mode === "playing") yaw -= e.movementX * 0.006 * settings.sensitivity; });

function readInput(): InputState {
  const f = (keys.has(km().forward) ? 1 : 0) - (keys.has(km().back) ? 1 : 0);
  const left = (keys.has(km().left) ? 1 : 0) - (keys.has(km().right) ? 1 : 0); // D = screen right = world -X when facing +Z
  const inp: InputState = {
    move: [left, f],
    cam_yaw_deg: (yaw * 180) / Math.PI,
    jump: latch.jump || keys.has(km().jump),
    interact: latch.interact || keys.has(km().interact),
    pulse: latch.pulse || keys.has(km().pulse),
    dash: latch.dash || keys.has(km().dash),
    pause: false,
  };
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  return inp;
}

// ---------- HUD ----------
let slotCap = 0;
let slots: Element[] = [];
let slotLabel: HTMLElement | undefined;
function buildSlots(cap: number): void { // one slot per unit of capacity (10 + 2 per lighting, max 20)
  slotCap = cap;
  moteBar.innerHTML = Array.from({ length: cap }, () => "<i></i>").join("") + `<span id="slotlabel" style="margin-left:8px;font-size:1rem"></span>`;
  slots = Array.from(moteBar.querySelectorAll("i"));
  slotLabel = moteBar.querySelector<HTMLElement>("#slotlabel")!;
}
cdsEl.innerHTML = '<div class="cd" id="cd-dash">Lướt<br>Shift</div><div class="cd" id="cd-pulse">Tỏa sáng<br>F</div>';
const cdDash = $("cd-dash"), cdPulse = $("cd-pulse");
let fpsOn = false, fpsFrames = 0, fpsStart = 0, fpsText = "";
const tmp = new THREE.Vector3();

function renderHud(now: number): void {
  const lit = sim.lanterns.filter((l) => l.lit).length;
  const hearts = "🔥".repeat(Math.max(0, sim.player.flames)) + "<span style='opacity:.25'>" + "🔥".repeat(Math.max(0, TUNING.flames - sim.player.flames)) + "</span>";
  flamesEl.innerHTML = `${hearts}<small>Đêm ${night} — ${NIGHT_INFO[night].name}${sim.charmTicks > 0 ? " · 🧧 Bùa Gió" : ""}</small>`;
  const need = Math.ceil((sim.lanterns.length * Math.round(TUNING.win_ratio * 100)) / 100);
  topRight.innerHTML = `Đèn lồng <b>${lit}/${sim.lanterns.length}</b> <small>(cần ${need})</small><br>Điểm <b>${sim.score}</b>`;
  const secs = Math.max(0, Math.ceil(sim.timeLeft));
  clockEl.textContent = `${sim.timeLeft <= 30 ? "⚠ " : ""}${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const danger = sim.timeLeft <= 30; // red and blinking at <= 30 s
  clockEl.classList.toggle("danger", danger);
  clockEl.style.opacity = danger && !settings.reducedMotion && Math.floor(now / 500) % 2 === 1 ? "0.35" : "1";
  if (slotCap !== sim.capacity) buildSlots(sim.capacity);
  slots.forEach((el, i) => el.classList.toggle("on", i < sim.player.carried));
  if (slotLabel) slotLabel.textContent = `${sim.player.carried}/${sim.capacity}`;

  const dash = sim.dashCooldownTicks / toTicks(TUNING.dash_cooldown_s);
  const pulse = sim.pulseCooldownTicks / toTicks(TUNING.pulse_cooldown_s);
  cdDash.style.setProperty("--p", `${Math.round(dash * 100)}%`);
  cdPulse.style.setProperty("--p", `${Math.round(pulse * 100)}%`);
  cdDash.classList.toggle("ready", dash === 0);
  cdPulse.classList.toggle("ready", pulse === 0 && sim.player.carried >= TUNING.pulse_cost);

  // prompt near an unlit lantern in reach, and an arrow to the nearest unlit one when it is off-screen
  const p = sim.player.pos;
  let near: (typeof sim.lanterns)[number] | undefined;
  let nearD = Infinity;
  let target: typeof near; // the lantern E would act on: unlit, or lit and not full (nearest, smaller id on a tie)
  let targetD = Infinity;
  for (const l of sim.lanterns) {
    const d = Math.hypot(l.pos[0] - p[0], l.pos[2] - p[2]);
    if (!l.lit && d < nearD) { near = l; nearD = d; }
    if ((!l.lit || l.fuelU < TUNING.fuel_max * 60) && d < targetD) { target = l; targetD = d; }
  }
  const playing = mode === "playing";
  if (playing && target && targetD <= TUNING.interact_radius) {
    promptEl.textContent = target.lit ? `E — Thêm dầu (${Math.round(target.fuelU / 6) / 10}/${TUNING.fuel_max})` : `E — Nạp ánh sáng (${target.deposited}/${target.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;
    promptEl.style.display = "block";
  } else promptEl.style.display = "none";
  if (playing && near) {
    tmp.set(near.pos[0], near.pos[1] + 3.6, near.pos[2]).project(camera);
    const behind = tmp.z > 1;
    const onScreen = !behind && Math.abs(tmp.x) < 0.92 && Math.abs(tmp.y) < 0.88;
    if (onScreen) arrowEl.style.display = "none";
    else {
      let dx = behind ? -tmp.x : tmp.x, dy = behind ? -tmp.y : tmp.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const W = window.innerWidth, H = window.innerHeight;
      arrowEl.style.display = "block";
      arrowEl.style.left = `${W / 2 + dx * W * 0.4 - 17}px`;
      arrowEl.style.top = `${H / 2 - dy * H * 0.38 - 17}px`;
      arrowEl.style.transform = `rotate(${Math.atan2(-dy, dx)}rad)`;
    }
  } else arrowEl.style.display = "none";

  fpsFrames++;
  if (fpsOn) {
    if (now - fpsStart >= 1000) { fpsText = `${Math.round((fpsFrames * 1000) / (now - fpsStart))} FPS · ${window.innerWidth}×${window.innerHeight}`; fpsFrames = 0; fpsStart = now; }
    fpsEl.textContent = fpsText;
  }
}

function onEvent(e: SimEvent): void {
  switch (e.name) {
    case "mote_picked": audio.sfx("pickup"); break;
    case "dash": audio.sfx("dash"); break;
    case "lantern_out": showToast(`⚠ Đèn ${e.data.lantern_id} đã tắt!`); audio.sfx("lose"); break;
    case "refuel": showToast(`Thêm dầu cho ${e.data.lantern_id}: ${e.data.fuel}`); audio.sfx("pickup"); break;
    case "fuel_drain": showToast(`⚠ Bóng Mực đang hút dầu ${e.data.lantern_id} (còn ${e.data.fuel})`); break;
    case "deposit": showToast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id}`); break;
    case "lantern_lit": showToast(`Đèn ${e.data.lantern_id} đã sáng!`); audio.sfx("lit"); break;
    case "pulse": if (!settings.reducedMotion) shake = 0.15; audio.sfx("pulse"); addRing(); showToast((e.data.stunned_ids as string[]).length ? "Tỏa sáng! Bóng Mực choáng váng" : "Tỏa sáng!"); break;
    case "player_hit":
      audio.sfx("hit");
      if (!settings.reducedMotion) { flash.style.opacity = "1"; setTimeout(() => (flash.style.opacity = "0"), 250); shake = 0.3; }
      showToast(e.data.by === "fall" ? "Bạn rơi xuống biển mây! Mất 1 ngọn lửa" : "Bóng Mực chạm bạn! Mất 1 ngọn lửa");
      break;
    case "shade_spawned": showToast("Một Bóng Mực xuất hiện!"); caption("shade", "⚠ Bóng Mực xuất hiện! Hãy nhìn theo mũi tên ➤", 4000); spawnCue = { id: String(e.data.id), until: performance.now() + 6000 }; audio.sfx("shade"); break;
    case "charm_picked": audio.sfx("charm"); showToast("Bùa Gió! Chạy nhanh hơn, lướt không cần chờ"); break;
    case "drifter_steal": audio.sfx("steal"); showToast(`Gió Lạc cuỗm ${e.data.amount} đom đóm!`); break;
    case "drifter_drop": showToast("Đom đóm rơi lại!"); break;
    case "game_over": audio.stopMusic(); audio.sfx(sim.state === "won" ? "win" : "lose"); endScreen(); break;
    default: break;
  }
}

function addRing(): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(sim.player.pos[0], sim.player.pos[1] + 0.1, sim.player.pos[2]);
  scene.add(m);
  rings.push({ mesh: m, age: 0 });
}

// ---------- render sync (reads sim only) ----------
function sync(t: number, dt: number): void {
  const p = sim.player.pos;
  player.position.set(p[0], p[1], p[2]);
  player.rotation.y = Math.atan2(sim.facing[0], sim.facing[1]);
  player.visible = sim.fallWaitTicks === 0;

  for (const l of sim.lanterns) {
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const frac = Math.min(1, l.deposited / cost);
    const lamp = v.lamp.material as THREE.MeshStandardMaterial;
    const fuel = l.fuelU / (TUNING.fuel_max * 60);
    const low = l.lit && l.fuelU < TUNING.low_fuel_threshold * 60;
    const blinkOn = !low || Math.floor(t / 500) % 2 === 0; // 1 Hz blink below 30 fuel
    if (l.lit) {
      lamp.color.set(PALETTE.lanternCore); lamp.emissive.set(PALETTE.lanternLit);
      lamp.emissiveIntensity = blinkOn ? 2.4 + 0.3 * Math.sin(t / 250) : 0.3;
      v.light.intensity = blinkOn ? 70 + 8 * Math.sin(t / 300) : 10;
    } else {
      lamp.color.set(PALETTE.lanternOff); lamp.emissive.set(0xff9a30); lamp.emissiveIntensity = frac * 1.2;
      v.light.intensity = frac * 8;
    }
    // fuel bar on lit lanterns, facing the camera; it blinks with the lantern when low
    v.bar.visible = l.lit && blinkOn;
    v.bar.quaternion.copy(camera.quaternion);
    v.barFg.scale.x = Math.max(0.001, fuel);
    v.barFg.position.x = -0.8 * (1 - fuel);
    (v.barFg.material as THREE.MeshBasicMaterial).color.set(low ? (settings.colorBlind ? PALETTE.warningCB : PALETTE.uiDanger) : PALETTE.lanternLit);
    // colour-blind mode: an unlit lantern is squashed 20% and its paper is torn
    v.lamp.scale.y = settings.colorBlind && !l.lit ? 0.8 : 1;
    v.tears.visible = settings.colorBlind && !l.lit;
    v.zone.visible = sim.hasZone(l);
    v.fill.scale.set(0.4 + frac * 1.6, 1, 0.4 + frac * 1.6);
  }

  const seenM = new Set<string>();
  for (const m of sim.motes) {
    seenM.add(m.id);
    let mesh = moteViews.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, m.kind === "dropped" ? droppedMat : moteMat); scene.add(mesh); moteViews.set(m.id, mesh); }
    mesh.position.set(m.pos[0], m.pos[1] + 0.9 + 0.25 * Math.sin(t / 400 + m.pos[0]), m.pos[2]);
    if (m.kind === "dropped" && m.ttl !== null) mesh.visible = m.ttl > 60 || Math.floor(t / 120) % 2 === 0; // blink before it expires
  }
  for (const [id, mesh] of moteViews) if (!seenM.has(id)) { scene.remove(mesh); moteViews.delete(id); }

  const seenS = new Set<string>();
  for (const s of sim.shades) {
    seenS.add(s.id);
    let mesh = shadeViews.get(s.id);
    if (!mesh) {
      mesh = new THREE.Mesh(shadeGeo, mat(PALETTE.shadeBody, PALETTE.shadeOutline, 0.5));
      for (const ex of [-0.28, 0.28]) { // eyes: the outline colour, so colour-blind mode recolours them too
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: PALETTE.shadeOutline }));
        eye.position.set(ex, 0.2, 0.8);
        eye.name = "eye";
        mesh.add(eye);
      }
      scene.add(mesh);
      shadeViews.set(s.id, mesh);
    }
    const outline = settings.colorBlind ? PALETTE.shadeOutlineCB : PALETTE.shadeOutline;
    for (const ch of mesh.children) if (ch.name === "eye") ((ch as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(outline);
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.emissive.set(s.state === "stunned" ? PALETTE.shadeStunned : outline);
    m.opacity = s.state === "spawning" ? 0.35 : 1;
    m.transparent = s.state === "spawning";
    mesh.position.set(s.pos[0], s.pos[1] + 0.1 * Math.sin(t / 200), s.pos[2]);
    mesh.scale.set(1, s.state === "stunned" ? 0.6 : 1 + 0.08 * Math.sin(t / 150), 1);
  }
  for (const [id, mesh] of shadeViews) if (!seenS.has(id)) { scene.remove(mesh); shadeViews.delete(id); }

  const seenD = new Set<string>();
  for (const d of sim.drifters) {
    if (d.state === "removed") continue;
    seenD.add(d.id);
    let mesh = drifterViews.get(d.id);
    if (!mesh) { mesh = new THREE.Mesh(drifterGeo, mat(PALETTE.drifter, 0x5a7090, 0.6)); scene.add(mesh); drifterViews.set(d.id, mesh); }
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
    mesh.rotation.set(t / 500, t / 350, 0);
  }
  for (const [id, mesh] of drifterViews) if (!seenD.has(id)) { scene.remove(mesh); drifterViews.delete(id); }

  for (const c of sim.charms) {
    let mesh = charmViews.get(c.id);
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.08), mat(PALETTE.mayScarf, PALETTE.gold, 0.5));
      scene.add(mesh);
      charmViews.set(c.id, mesh);
    }
    mesh.visible = c.available;
    mesh.position.set(c.pos[0], c.pos[1] + 1.1 + 0.15 * Math.sin(t / 350), c.pos[2]);
    mesh.rotation.y = t / 600;
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]!;
    r.age += dt;
    const k = r.age / 0.5;
    r.mesh.scale.setScalar(1 + k * TUNING.pulse_radius);
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) { scene.remove(r.mesh); rings.splice(i, 1); }
  }

  const lit = sim.lanterns.filter((l) => l.lit).length / sim.lanterns.length;
  ambient.intensity = ambientIntensity(sim.lanterns.filter((l) => l.lit).length, sim.lanterns.length);
  (scene.background as THREE.Color).copy(dusk).lerp(dawnTint, lit);
  (scene.fog as THREE.FogExp2).color.copy(dusk).lerp(dawnTint, lit);

  const dist = 15, h = 9;
  camera.position.set(p[0] - Math.sin(yaw) * dist, p[1] + h, p[2] - Math.cos(yaw) * dist);
  if (shake > 0 && !settings.reducedMotion) {
    const k = shake / 0.3;
    camera.position.x += (Math.random() - 0.5) * 0.9 * k;
    camera.position.y += (Math.random() - 0.5) * 0.9 * k;
    shake = Math.max(0, shake - dt);
  } else shake = 0;
  camera.lookAt(p[0], p[1] + 1.2, p[2]);
}

// ---------- loop ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0);
  lastT = now;
  if (mode === "playing" && sim.state === "playing") {
    if (keys.has("arrowleft")) yaw += 1.8 * dt * settings.sensitivity;
    if (keys.has("arrowright")) yaw -= 1.8 * dt * settings.sensitivity;
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 6 && sim.state === "playing" && mode === "playing") {
      acc -= DT;
      for (const e of sim.step(readInput())) onEvent(e);
    }
  }
  if (mode === "playing" && sim.state === "playing") {
    const left = Math.ceil(sim.timeLeft);
    if (left <= 10 && left >= 1 && left !== lastCountdown) audio.sfx("tick"); // countdown in the last 10 s
    lastCountdown = left;
  }
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) toast.style.opacity = "0";
  $("hud").style.display = mode === "menu" || mode === "intro" || mode === "bench" ? "none" : "block";
  if (mode === "bench") {
    benchFrame(now, dt);
    return;
  }
  sync(now, dt);
  renderHud(now);
  if (mode === "playing") updateCaptions();
  renderCaptions(now);
  updateSpawnArrow(now);
  renderer.render(scene, camera);
});

updateHelp();

// ---------- benchmark mode (Electron --bench, Ticket-04 section 1) ----------
interface DdlBridge { benchConfig: { seed: number; duration: number; out: string } | null; benchFirstFrame(): void; benchMeasureStart(): void; benchResult(p: { dts: number[]; renderer: string }): void }
const ddl = (window as unknown as { ddl?: DdlBridge }).ddl;
const benchCfg = ddl?.benchConfig ?? null;
const bench = { t0: 0, last: 0, measureStart: 0, dts: [] as number[], started: false, done: false, acc: 0 };

function benchFrame(now: number, dt: number): void {
  if (!ddl || !benchCfg || bench.done) return;
  if (bench.t0 === 0) { bench.t0 = now; bench.last = now; }
  const t = (now - bench.t0) / 1000;
  // game logic at its normal fixed step: the shades wander
  bench.acc += dt;
  let n = 0;
  while (bench.acc >= DT && n++ < 6) { bench.acc -= DT; sim.step(idleInput()); }
  sync(now, dt);
  const [cx, cy, cz] = benchCamera(t); // circle r 30 at Y 15 around the origin, one lap per 15 s, from (30,15,0)
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const frameMs = now - bench.last;
  bench.last = now;
  if (!bench.started) {
    if (t === 0) ddl.benchFirstFrame(); // first rendered bench frame
    if (t >= 3) { bench.started = true; bench.measureStart = now; ddl.benchMeasureStart(); } // 3 s warm-up, not measured
    return;
  }
  bench.dts.push(frameMs);
  if ((now - bench.measureStart) / 1000 >= benchCfg.duration) {
    bench.done = true;
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    ddl.benchResult({ dts: bench.dts, renderer: name });
  }
}

if (benchCfg) {
  sim = createBenchSim(benchCfg.seed);
  (window as unknown as { __ddl: unknown }).__ddl = { get sim() { return sim; } };
  loadNightScene(1);
  mode = "bench";
  hideOverlay();
} else {
  // the menu is shown over the Night 1 island
  loadNightScene(1);
  showMenu();
}
const startAt = Number(new URLSearchParams(location.search).get("night")); // ?night=2 opens that night's intro (handy for testing)
if (!benchCfg && (startAt === 1 || startAt === 2 || startAt === 3)) showIntro(startAt);
