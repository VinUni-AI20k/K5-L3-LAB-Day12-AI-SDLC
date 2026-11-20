// Soak test core (Ticket-04 section 2): N nights in one process on the same Sim as headless, with seeded random input.
// Pure of file I/O; the CLI wrapper is soak.ts. Memory is read with process.memoryUsage().rss.
import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";
import { toTicks } from "../sim/config";
import { createRng } from "../sim/rng";
import { Sim } from "../sim/sim";
import type { InputState } from "../sim/types";
import { NIGHTS } from "../sim/maps";

export interface SoakNight { night: 1 | 2 | 3; seed: number; ticks: number; state: string; score: number; error?: string }
export interface SoakResult { nights: number; crashes: number; results: SoakNight[]; mem_start_mb: number; mem_end_mb: number; duration_s: number }

/** Seeded random input: a new unit move direction every 30 ticks; each tick 5% jump, 3% dash, 2% pulse, 10% interact. */
export function makeSoakInputs(seed: number): (tick: number) => InputState {
  const rng = createRng(seed);
  let dir: [number, number] = [0, 1];
  let lastTick = -1;
  return (tick: number): InputState => {
    if (tick !== lastTick) {
      if (tick % 30 === 0) {
        const a = 2 * Math.PI * rng();
        dir = [Math.cos(a), Math.sin(a)];
      }
      lastTick = tick;
    }
    return { move: dir, cam_yaw_deg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false };
  };
}

const mb = (bytes: number): number => Math.round((bytes / 1048576) * 10) / 10;

function gcIfPossible(): void {
  try {
    setFlagsFromString("--expose-gc");
    (runInNewContext("gc") as () => void)();
  } catch {
    /* no gc available: the RSS reading is just less tight */
  }
}

export function runSoak(opts: { seed: number; nights: number }): SoakResult {
  const t0 = Date.now();
  const results: SoakNight[] = [];
  let crashes = 0;
  let memStart = 0;
  for (let i = 0; i < opts.nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3;
    const seed = opts.seed + i;
    try {
      let sim: Sim | null = new Sim(seed, {}, night);
      if (i === 0) memStart = process.memoryUsage().rss; // RSS after the first night has loaded
      const inputs = makeSoakInputs(seed);
      const max = toTicks(NIGHTS[night].duration_s);
      while (sim.state === "playing" && sim.tick < max) sim.step(inputs(sim.tick));
      results.push({ night, seed, ticks: sim.tick, state: sim.state, score: sim.score });
      sim = null; // reset: nothing from this night is kept
    } catch (e) {
      crashes++;
      results.push({ night, seed, ticks: 0, state: "crashed", score: 0, error: (e as Error).message });
    }
  }
  gcIfPossible();
  const memEnd = process.memoryUsage().rss; // RSS after the last night has been reset
  return { nights: opts.nights, crashes, results, mem_start_mb: mb(memStart), mem_end_mb: mb(memEnd), duration_s: Math.round(((Date.now() - t0) / 1000) * 100) / 100 };
}
