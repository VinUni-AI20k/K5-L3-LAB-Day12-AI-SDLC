// Web client: renders sim state with Three.js, reads the keyboard, pushes inputs. No gameplay rules here (those live in src/sim).
// Randomness/Date in this file is fine: it only picks the seed for a new web game and drives visual effects.
import * as THREE from "three";
import { DT, TUNING, WORLD } from "../sim/config";
import { Sim } from "../sim/sim";
import type { InputState, SimEvent } from "../sim/types";

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
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
const ambient = new THREE.HemisphereLight(0x9a86d0, 0x3a2a55, 1.1);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb8c4ff, 1.1);
moon.position.set(-30, 50, -20);
scene.add(moon);

const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 4, 4, 72), new THREE.MeshStandardMaterial({ color: 0x4d7d4a, roughness: 1 }));
island.position.y = -2;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshBasicMaterial({ color: 0x0a0716 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -4;
scene.add(sea);

const mat = (c: number, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color: c, emissive, emissiveIntensity: ei, roughness: 0.8 });

// player: body + conical hat with a small lantern
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 10), mat(0xe9c79a));
body.position.y = 0.8;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 16), mat(0x9a6b3a));
hat.position.y = 1.75;
const hatLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mat(0xffd27a, 0xffb040, 2));
hatLantern.position.set(0.5, 1.35, 0);
const playerLight = new THREE.PointLight(0xffb86b, 14, 16);
playerLight.position.set(0.5, 1.4, 0);
player.add(body, hat, hatLantern, playerLight);
scene.add(player);

// lanterns
interface LanternView { lamp: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh; fill: THREE.Mesh }
const lanternViews = new Map<string, LanternView>();
function buildLanterns(sim: Sim): void {
  for (const v of lanternViews.values()) scene.remove(v.lamp.parent!);
  lanternViews.clear();
  for (const l of sim.lanterns) {
    const g = new THREE.Group();
    g.position.set(l.pos[0], 0, l.pos[2]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(0x4a3a2a));
    pole.position.y = 1.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), mat(0x302838));
    lamp.position.y = 3.6;
    const light = new THREE.PointLight(0xffa040, 0, 40);
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

const moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xffe066, emissiveIntensity: 2.2 });
const moteViews = new Map<string, THREE.Mesh>();
const shadeGeo = new THREE.SphereGeometry(0.9, 16, 14);
const shadeViews = new Map<string, THREE.Mesh>();
const rings: Array<{ mesh: THREE.Mesh; age: number }> = [];

// ---------- game session ----------
let sim = new Sim(1);
let started = false;
let acc = 0;
let lastT = 0;
let yaw = 0; // cam_yaw_deg in radians: forward (input z=+1) is (sin, cos)
let toastTimer = 0;
const keys = new Set<string>();
const latch = { jump: false, interact: false, pulse: false };

function newGame(): void {
  const seed = Number(new URLSearchParams(location.search).get("seed")) || Math.floor(Math.random() * 1e9);
  sim = new Sim(seed);
  (window as unknown as { __ddl: unknown }).__ddl = { get sim() { return sim; } };
  buildLanterns(sim);
  for (const m of moteViews.values()) scene.remove(m);
  for (const m of shadeViews.values()) scene.remove(m);
  moteViews.clear();
  shadeViews.clear();
  acc = 0;
  yaw = 0;
  hideOverlay();
  started = true;
}

// ---------- input ----------
const GAME_KEYS = new Set(["w", "a", "s", "d", "arrowleft", "arrowright", "arrowup", "arrowdown", " ", "e", "f", "q"]);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (GAME_KEYS.has(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") latch.jump = true;
  if (k === "e") latch.interact = true;
  if (k === "f") latch.pulse = true;
  if (k === "r" && sim.state !== "playing") newGame();
  if ((k === "enter" || k === " ") && !started) newGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let drag = false;
renderer.domElement.addEventListener("pointerdown", () => (drag = true));
window.addEventListener("pointerup", () => (drag = false));
window.addEventListener("pointermove", (e) => { if (drag) yaw -= e.movementX * 0.006; });

function readInput(): InputState {
  const f = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
  const left = (keys.has("a") ? 1 : 0) - (keys.has("d") ? 1 : 0); // D = screen right = world -X when facing +Z
  const inp: InputState = {
    move: [left, f],
    cam_yaw_deg: (yaw * 180) / Math.PI,
    jump: latch.jump || keys.has(" "),
    interact: latch.interact || keys.has("e"),
    pulse: latch.pulse || keys.has("f"),
    dash: false,
  };
  latch.jump = latch.interact = latch.pulse = false;
  return inp;
}

// ---------- HUD ----------
const $ = (id: string) => document.getElementById(id)!;
const stats = $("stats"), timer = $("timer"), toast = $("toast"), flash = $("flash"), overlay = $("overlay");
function showToast(text: string): void {
  toast.textContent = text;
  toast.style.opacity = "1";
  toastTimer = 2.2;
}
function showOverlay(html: string, onClick?: () => void): void {
  overlay.firstElementChild!.innerHTML = html;
  overlay.style.display = "flex";
  const b = overlay.querySelector("button");
  if (b && onClick) b.addEventListener("click", onClick);
}
function hideOverlay(): void { overlay.style.display = "none"; }

function renderHud(): void {
  const lit = sim.lanterns.filter((l) => l.lit).length;
  const flames = "🔥".repeat(Math.max(0, sim.player.flames)) + "<span style='opacity:.25'>" + "🔥".repeat(Math.max(0, TUNING.flames - sim.player.flames)) + "</span>";
  stats.innerHTML = `<div>Ngọn lửa: ${flames}</div><div>Đom đóm mang: <b>${sim.player.carried}</b> / ${TUNING.carry_capacity}</div><div>Đèn lồng sáng: <b>${lit}</b> / ${sim.lanterns.length}</div><div>Điểm: <b>${sim.score}</b></div>`;
  const s = Math.max(0, Math.ceil(sim.timeLeft));
  timer.innerHTML = `Bình minh sau<br><b style="font-size:28px">${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b>`;
}

function onEvent(e: SimEvent): void {
  switch (e.name) {
    case "mote_picked": break;
    case "deposit": showToast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id}`); break;
    case "lantern_lit": showToast(`Đèn ${e.data.lantern_id} đã sáng!`); break;
    case "pulse": addRing(); showToast((e.data.stunned_ids as string[]).length ? "Tỏa sáng! Bóng Mực choáng váng" : "Tỏa sáng!"); break;
    case "player_hit": flash.style.opacity = "1"; setTimeout(() => (flash.style.opacity = "0"), 250); showToast("Bóng Mực chạm bạn! Mất 1 ngọn lửa"); break;
    case "shade_spawned": showToast("Một Bóng Mực xuất hiện!"); break;
    case "game_over": endScreen(); break;
  }
}
function endScreen(): void {
  const won = sim.state === "won";
  const reason = sim.lanterns.every((l) => l.lit) ? "" : sim.player.flames <= 0 ? "Bạn hết ngọn lửa." : "Trời đã sáng, đèn chưa thắp hết.";
  showOverlay(`<h1>${won ? "Đảo đã sáng!" : "Màn đêm thắng rồi"}</h1><p>${won ? "Cả 5 Đèn Lồng Lớn đã được thắp." : reason}</p><p>Điểm: <b>${sim.score}</b></p><button id="replay">Chơi lại (R)</button>`, newGame);
}

function addRing(): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(sim.player.pos[0], 0.1, sim.player.pos[2]);
  scene.add(m);
  rings.push({ mesh: m, age: 0 });
}

// ---------- render sync (reads sim only) ----------
function sync(t: number, dt: number): void {
  const p = sim.player.pos;
  player.position.set(p[0], p[1], p[2]);
  player.rotation.y = yaw;

  for (const l of sim.lanterns) {
    const v = lanternViews.get(l.id)!;
    const frac = Math.min(1, l.deposited / TUNING.lantern_cost);
    const lamp = v.lamp.material as THREE.MeshStandardMaterial;
    if (l.lit) {
      lamp.color.set(0xffd27a); lamp.emissive.set(0xffa030); lamp.emissiveIntensity = 2.4 + 0.3 * Math.sin(t / 250);
      v.light.intensity = 70 + 8 * Math.sin(t / 300);
    } else {
      lamp.color.set(0x302838); lamp.emissive.set(0xff9a30); lamp.emissiveIntensity = frac * 1.2;
      v.light.intensity = frac * 8;
    }
    v.zone.visible = l.lit;
    v.fill.scale.set(0.4 + frac * 1.6, 1, 0.4 + frac * 1.6);
  }

  const seenM = new Set<string>();
  for (const m of sim.motes) {
    seenM.add(m.id);
    let mesh = moteViews.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteViews.set(m.id, mesh); }
    mesh.position.set(m.pos[0], 0.9 + 0.25 * Math.sin(t / 400 + m.pos[0]), m.pos[2]);
  }
  for (const [id, mesh] of moteViews) if (!seenM.has(id)) { scene.remove(mesh); moteViews.delete(id); }

  const seenS = new Set<string>();
  for (const s of sim.shades) {
    seenS.add(s.id);
    let mesh = shadeViews.get(s.id);
    if (!mesh) { mesh = new THREE.Mesh(shadeGeo, mat(0x1d0f2b, 0x6a1fb0, 0.5)); scene.add(mesh); shadeViews.set(s.id, mesh); }
    const stunned = sim.shadeState(s) === "stunned";
    (mesh.material as THREE.MeshStandardMaterial).emissive.set(stunned ? 0x3060ff : 0x6a1fb0);
    mesh.position.set(s.pos[0], s.pos[1] + 0.1 * Math.sin(t / 200), s.pos[2]);
    mesh.scale.set(1, stunned ? 0.6 : 1 + 0.08 * Math.sin(t / 150), 1);
  }
  for (const [id, mesh] of shadeViews) if (!seenS.has(id)) { scene.remove(mesh); shadeViews.delete(id); }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]!;
    r.age += dt;
    const k = r.age / 0.5;
    r.mesh.scale.setScalar(1 + k * TUNING.pulse_radius);
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) { scene.remove(r.mesh); rings.splice(i, 1); }
  }

  // the island warms up as lanterns are lit
  const lit = sim.lanterns.filter((l) => l.lit).length / sim.lanterns.length;
  ambient.intensity = 1.1 + lit * 0.9;
  (scene.background as THREE.Color).copy(dusk).lerp(dawnTint, lit);
  (scene.fog as THREE.FogExp2).color.copy(dusk).lerp(dawnTint, lit);

  // third-person camera behind the player, rotating with yaw
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
  if (started && sim.state === "playing") {
    if (keys.has("arrowleft")) yaw += 1.8 * dt;
    if (keys.has("arrowright")) yaw -= 1.8 * dt;
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 6 && sim.state === "playing") {
      acc -= DT;
      for (const e of sim.step(readInput())) onEvent(e);
    }
  }
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) toast.style.opacity = "0";
  sync(now, dt);
  renderHud();
  renderer.render(scene, camera);
});

buildLanterns(sim);
showOverlay(
  `<h1>Đảo Đèn Lồng</h1><p>Bạn là Mây, người giữ đèn. Nhặt đom đóm, nạp vào 5 Đèn Lồng Lớn để thắp sáng cả đảo trước bình minh. Tránh Bóng Mực!</p>
   <p style="opacity:.8;font-size:14px">WASD đi · Space nhảy · E nạp đèn (đứng gần đèn) · F tỏa sáng đẩy Bóng Mực (tốn 1 đom đóm) · ← → hoặc kéo chuột xoay camera</p><button id="start">Bắt đầu</button>`,
  newGame,
);
