// Per-night data (Ticket-02 section 2). Pure data + generators; geometry queries are added below in step 2.
// Angles are measured from +X, counter-clockwise seen from above: a point is (cx + r*cos a, y, cz + r*sin a).
import type { Vec3 } from "./types";

export interface Pad {
  center: Vec3;
  radius: number;
  vy: number;
  vh: number; // horizontal launch speed, m/s
  target: [number, number] | "minusZ"; // island centre (x, z) or the -Z direction
}

export interface NightDef {
  night: 1 | 2 | 3;
  duration_s: number;
  start: Vec3;
  startFacing: [number, number]; // (x, z), +Z = [0, 1]
  lanterns: Vec3[]; // id = L{i+1}
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  charmSpawns: Vec3[]; // id = C{i+1}
  shadeFirstTick: number; // tick of the first scheduled spawn (2 shades)
  shadeInterval: number; // ticks between later spawns
  shadeMax: number;
  shadeSpeed: number; // m/s
  drifters: boolean;
  wind: boolean;
  pads: Pad[];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** `count` points on a circle of radius r around (cx, cz), every `stepDeg` from `startDeg`, at height y. */
function ring(cx: number, cz: number, r: number, count: number, stepDeg: number, startDeg: number, y = 0): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const a = rad(startDeg + i * stepDeg);
    out.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
  }
  return out;
}

const NIGHT1: NightDef = {
  night: 1,
  duration_s: 300,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: [...ring(0, 0, 12, 8, 45, 0), ...ring(0, 0, 33, 16, 22.5, 0)],
  shadeSpawns: ring(0, 0, 37, 12, 30, 15),
  charmSpawns: [],
  shadeFirstTick: 300,
  shadeInterval: 480, // 8 s
  shadeMax: 6,
  shadeSpeed: 4,
  drifters: false,
  wind: false,
  pads: [],
};

const NIGHT2: NightDef = {
  night: 2,
  duration_s: 330,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: [
    ...ring(0, 0, 10, 4, 90, 0), ...ring(0, 0, 22, 8, 45, 0),
    ...ring(70, 0, 10, 4, 90, 0), ...ring(70, 0, 22, 8, 45, 0),
  ],
  shadeSpawns: [...ring(0, 0, 26, 8, 45, 22.5), ...ring(70, 0, 26, 8, 45, 22.5)],
  charmSpawns: [[35, 0, 0]],
  shadeFirstTick: 300,
  shadeInterval: 420, // 7 s
  shadeMax: 8,
  shadeSpeed: 4,
  drifters: true,
  wind: false,
  pads: [
    { center: [20, 0, 18], radius: 1, vy: 14, vh: 24, target: [70, 0] },
    { center: [50, 0, -18], radius: 1, vy: 14, vh: 24, target: [0, 0] },
  ],
};

const NIGHT3: NightDef = {
  night: 3,
  duration_s: 360,
  start: [0, 0, -15],
  startFacing: [0, 1],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: [...ring(0, 0, 34, 18, 20, 0, 0), ...ring(0, 0, 18, 8, 20, 20, 3), ...ring(0, 0, 5, 4, 90, 45, 6)],
  shadeSpawns: ring(0, 0, 43, 16, 22.5, 0),
  charmSpawns: [[30, 0, 25], [-30, 0, 25]],
  shadeFirstTick: 300,
  shadeInterval: 360, // 6 s
  shadeMax: 10,
  shadeSpeed: 4.5,
  drifters: true,
  wind: true,
  pads: [{ center: [0, 3, 13], radius: 1, vy: 12, vh: 8, target: "minusZ" }],
};

export const NIGHTS: Record<1 | 2 | 3, NightDef> = { 1: NIGHT1, 2: NIGHT2, 3: NIGHT3 };
