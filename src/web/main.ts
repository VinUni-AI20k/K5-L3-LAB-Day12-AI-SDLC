// Web client: renders sim state with Three.js, runs the 3-night flow and menus, pushes inputs. No gameplay rules here (those live in src/sim).
// Randomness/Date in this file is fine: it only picks the seed of a new web game and drives visual effects.
import * as THREE from "three";
import { DT, TUNING } from "../sim/config";
import { Sim } from "../sim/sim";
import type { InputState, SimEvent } from "../sim/types";
import { buildNight, buildSea } from "./scene";
import { loadSettings, saveSettings, type Settings } from "./settings";

type Night = 1 | 2 | 3;
type Mode = "menu" | "intro" | "playing" | "paused" | "result" | "dawn";

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
const dusk = new THREE.Color(0x1d1438);
const dawnTint = new THREE.Color(0x3a2347);
scene.background = dusk.clone();
scene.fog = new THREE.FogExp2(0x241845, 0.012);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
const ambient = new THREE.HemisphereLight(0x9a86d0, 0x3a2a55, 1.1);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb8c4ff, 1.1);
moon.position.set(-30, 50, -20);
scene.add(moon);

const mat = (c: number, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color: c, emissive, emissiveIntensity: ei, roughness: 0.8 });

// player: body + scarf + conical hat with a small lantern
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 10), mat(0xe8e2d0));
body.position.y = 0.8;
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), mat(0xc8102e));
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

interface LanternView { lamp: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh; fill: THREE.Mesh }
const lanternViews = new Map<string, LanternView>();
let nightGroup: THREE.Group | undefined;
let seaMesh: THREE.Mesh | undefined;
const moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff6c2, emissive: 0xffe58a, emissiveIntensity: 2.2 });
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
let acc = 0;
let lastT = 0;
let yaw = 0; // cam_yaw_deg in radians: forward (input z=+1) is (sin, cos)
let toastTimer = 0;
const settings: Settings = loadSettings();
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
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(0x6b4a2f));
    pole.position.y = 1.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), mat(0x5b5f6e));
    lamp.position.y = 3.6;
    const light = new THREE.PointLight(0xffb347, 0, 40);
    light.position.y = 3.6;
    const zone = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.05;
    zone.visible = false;
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), mat(0x554466));
    fill.position.y = 0.1;
    g.add(pole, lamp, light, zone, fill);
    scene.add(g);
    lanternViews.set(l.id, { lamp, light, zone, fill });
  }
}

function loadNightScene(n: Night): void {
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
  sim = new Sim(seed, {}, n);
  (window as unknown as { __ddl: unknown }).__ddl = { get sim() { return sim; } };
  loadNightScene(n);
  acc = 0;
  yaw = 0;
  mode = "playing";
  hideOverlay();
}

// ---------- overlays / menus ----------
const $ = (id: string) => document.getElementById(id)!;
const stats = $("stats"), timer = $("timer"), toast = $("toast"), flash = $("flash"), overlay = $("overlay"), card = overlay.firstElementChild as HTMLElement;

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
  showCard(
    `<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Nhặt đom đóm, thắp sáng những Đèn Lồng Lớn trước bình minh.</p>
     <button id="play">Chơi</button><button id="settings" class="alt">Cài đặt</button>`,
    { play: () => { totalScore = 0; showIntro(1); }, settings: () => showSettings(showMenu) },
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
     <button id="back">Xong</button>`,
    { back },
  );
  card.querySelector<HTMLInputElement>("#vol")!.addEventListener("input", (e) => { settings.volume = Number((e.target as HTMLInputElement).value) / 100; saveSettings(settings); });
  card.querySelector<HTMLInputElement>("#sens")!.addEventListener("input", (e) => { settings.sensitivity = Number((e.target as HTMLInputElement).value) / 100; saveSettings(settings); });
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
    showPause();
  } else if (mode === "paused") {
    hideOverlay();
    sim.step({ ...idleInput(), pause: true }); // the resuming step runs fully with idle input
    mode = "playing";
  }
}

function endScreen(): void {
  const won = sim.state === "won";
  if (won) totalScore += sim.score;
  if (won && night === 3) {
    mode = "dawn";
    showCard(`<h1>Bình minh!</h1><p>Cả ba hòn đảo đã sáng. Ông Đăng mỉm cười: “Giỏi lắm, Mây.”</p><p>Tổng điểm: <b>${totalScore}</b></p><button id="menu">Về menu</button>`, { menu: showMenu });
    return;
  }
  mode = "result";
  if (won) {
    showCard(`<h1>Đêm ${night} đã sáng!</h1><p>Điểm đêm này: <b>${sim.score}</b> · Tổng: <b>${totalScore}</b></p><button id="next">Đêm tiếp theo</button><button id="menu" class="alt">Về menu</button>`,
      { next: () => showIntro((night + 1) as Night), menu: showMenu });
  } else {
    const reason = sim.player.flames <= 0 ? "Bạn hết ngọn lửa." : "Trời đã sáng, đèn chưa thắp hết.";
    showCard(`<h1>Màn đêm thắng rồi</h1><p>${reason}</p><p>Điểm: <b>${sim.score}</b></p><button id="replay">Chơi lại đêm ${night} (R)</button><button id="menu" class="alt">Về menu</button>`,
      { replay: () => startNight(night), menu: showMenu });
  }
}

// ---------- input ----------
const idleInput = (): InputState => ({ move: [0, 0], cam_yaw_deg: (yaw * 180) / Math.PI, jump: false, interact: false, pulse: false, dash: false, pause: false });
const GAME_KEYS = new Set(["w", "a", "s", "d", "arrowleft", "arrowright", "arrowup", "arrowdown", " ", "e", "f", "shift", "escape", "p"]);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (GAME_KEYS.has(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === "escape" || k === "p") { togglePause(); return; }
  keys.add(k);
  if (k === " ") latch.jump = true;
  if (k === "e") latch.interact = true;
  if (k === "f") latch.pulse = true;
  if (k === "shift") latch.dash = true;
  if (k === "r" && mode === "result") startNight(night);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let drag = false;
renderer.domElement.addEventListener("pointerdown", () => (drag = true));
window.addEventListener("pointerup", () => (drag = false));
window.addEventListener("pointermove", (e) => { if (drag && mode === "playing") yaw -= e.movementX * 0.006 * settings.sensitivity; });

function readInput(): InputState {
  const f = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
  const left = (keys.has("a") ? 1 : 0) - (keys.has("d") ? 1 : 0); // D = screen right = world -X when facing +Z
  const inp: InputState = {
    move: [left, f],
    cam_yaw_deg: (yaw * 180) / Math.PI,
    jump: latch.jump || keys.has(" "),
    interact: latch.interact || keys.has("e"),
    pulse: latch.pulse || keys.has("f"),
    dash: latch.dash || keys.has("shift"),
    pause: false,
  };
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  return inp;
}

// ---------- HUD (step 9 replaces this with the full layout) ----------
function renderHud(): void {
  const lit = sim.lanterns.filter((l) => l.lit).length;
  const flames = "🔥".repeat(Math.max(0, sim.player.flames)) + "<span style='opacity:.25'>" + "🔥".repeat(Math.max(0, TUNING.flames - sim.player.flames)) + "</span>";
  stats.innerHTML = `<div>Đêm ${night} — ${NIGHT_INFO[night].name}</div><div>Ngọn lửa: ${flames}</div><div>Đom đóm mang: <b>${sim.player.carried}</b> / ${TUNING.carry_capacity}${sim.charmTicks > 0 ? " · 🧧 Bùa Gió" : ""}</div><div>Đèn lồng sáng: <b>${lit}</b> / ${sim.lanterns.length}</div><div>Điểm: <b>${sim.score}</b></div>`;
  const s = Math.max(0, Math.ceil(sim.timeLeft));
  timer.innerHTML = `Bình minh sau<br><b style="font-size:28px">${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b>`;
}

function onEvent(e: SimEvent): void {
  switch (e.name) {
    case "deposit": showToast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id}`); break;
    case "lantern_lit": showToast(`Đèn ${e.data.lantern_id} đã sáng!`); break;
    case "pulse": addRing(); showToast((e.data.stunned_ids as string[]).length ? "Tỏa sáng! Bóng Mực choáng váng" : "Tỏa sáng!"); break;
    case "player_hit":
      flash.style.opacity = "1"; setTimeout(() => (flash.style.opacity = "0"), 250);
      showToast(e.data.by === "fall" ? "Bạn rơi xuống biển mây! Mất 1 ngọn lửa" : "Bóng Mực chạm bạn! Mất 1 ngọn lửa");
      break;
    case "shade_spawned": showToast("Một Bóng Mực xuất hiện!"); break;
    case "charm_picked": showToast("Bùa Gió! Chạy nhanh hơn, lướt không cần chờ"); break;
    case "drifter_steal": showToast(`Gió Lạc cuỗm ${e.data.amount} đom đóm!`); break;
    case "drifter_drop": showToast("Đom đóm rơi lại!"); break;
    case "game_over": endScreen(); break;
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
    const frac = Math.min(1, l.deposited / TUNING.lantern_cost);
    const lamp = v.lamp.material as THREE.MeshStandardMaterial;
    if (l.lit) {
      lamp.color.set(0xffe9b0); lamp.emissive.set(0xffb347); lamp.emissiveIntensity = 2.4 + 0.3 * Math.sin(t / 250);
      v.light.intensity = 70 + 8 * Math.sin(t / 300);
    } else {
      lamp.color.set(0x5b5f6e); lamp.emissive.set(0xff9a30); lamp.emissiveIntensity = frac * 1.2;
      v.light.intensity = frac * 8;
    }
    v.zone.visible = l.lit;
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
    if (!mesh) { mesh = new THREE.Mesh(shadeGeo, mat(0x120a1a, 0x7a3cff, 0.5)); scene.add(mesh); shadeViews.set(s.id, mesh); }
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.emissive.set(s.state === "stunned" ? 0x3a3450 : 0x7a3cff);
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
    if (!mesh) { mesh = new THREE.Mesh(drifterGeo, mat(0x8fa3b8, 0x5a7090, 0.6)); scene.add(mesh); drifterViews.set(d.id, mesh); }
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
    mesh.rotation.set(t / 500, t / 350, 0);
  }
  for (const [id, mesh] of drifterViews) if (!seenD.has(id)) { scene.remove(mesh); drifterViews.delete(id); }

  for (const c of sim.charms) {
    let mesh = charmViews.get(c.id);
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.08), mat(0xc8102e, 0xf2c14e, 0.5));
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
  ambient.intensity = 1.1 + lit * 0.9;
  (scene.background as THREE.Color).copy(dusk).lerp(dawnTint, lit);
  (scene.fog as THREE.FogExp2).color.copy(dusk).lerp(dawnTint, lit);

  const dist = 15, h = 9;
  camera.position.set(p[0] - Math.sin(yaw) * dist, p[1] + h, p[2] - Math.cos(yaw) * dist);
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
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) toast.style.opacity = "0";
  $("hud").style.display = mode === "menu" || mode === "intro" ? "none" : "block";
  sync(now, dt);
  renderHud();
  renderer.render(scene, camera);
});

// the menu is shown over the Night 1 island
loadNightScene(1);
showMenu();
const startAt = Number(new URLSearchParams(location.search).get("night")); // ?night=2 opens that night's intro (handy for testing)
if (startAt === 1 || startAt === 2 || startAt === 3) showIntro(startAt);
