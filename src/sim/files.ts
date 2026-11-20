// Parsing + validation of the scenario and inputs files (Test Contract C and D). Pure: no fs, no DOM.
// Any malformed content throws BadFileError; the CLI turns that into exit code 2.
import { TUNING } from "./config";
import type { InputState, Scenario, Vec3 } from "./types";

export class BadFileError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function vec3(v: unknown, what: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(num)) throw new BadFileError(`${what} must be [x, y, z] numbers`);
  return [v[0] as number, v[1] as number, v[2] as number];
}
function count(v: unknown, what: string): number {
  if (!num(v) || v < 0 || !Number.isInteger(v)) throw new BadFileError(`${what} must be an integer >= 0`);
  return v;
}

export const LANTERN_IDS = ["L1", "L2", "L3", "L4", "L5"] as const;

export function parseScenario(raw: unknown): Scenario {
  if (!isObj(raw)) throw new BadFileError("scenario must be a JSON object");
  const sc: Scenario = {};
  if (raw.player !== undefined) {
    if (!isObj(raw.player)) throw new BadFileError("player must be an object");
    const p = raw.player;
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, "player.pos");
    if (p.carried !== undefined) sc.player.carried = count(p.carried, "player.carried");
    if (p.flames !== undefined) sc.player.flames = count(p.flames, "player.flames");
  }
  for (const k of ["random_motes", "random_shades"] as const) {
    if (raw[k] !== undefined) {
      if (typeof raw[k] !== "boolean") throw new BadFileError(`${k} must be a boolean`);
      sc[k] = raw[k] as boolean;
    }
  }
  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new BadFileError("motes must be an array");
    sc.motes = raw.motes.map((m, i) => vec3(m, `motes[${i}]`));
  }
  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new BadFileError("shades must be an array");
    sc.shades = raw.shades.map((s, i) => {
      if (!isObj(s)) throw new BadFileError(`shades[${i}] must be an object`);
      if (s.id !== undefined && (typeof s.id !== "string" || s.id === "")) throw new BadFileError(`shades[${i}].id must be a string`);
      const out: { pos: Vec3; id?: string } = { pos: vec3(s.pos, `shades[${i}].pos`) };
      if (typeof s.id === "string") out.id = s.id;
      return out;
    });
    const ids = sc.shades.flatMap((s) => (s.id ? [s.id] : []));
    if (new Set(ids).size !== ids.length) throw new BadFileError("shades ids must be unique");
  }
  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new BadFileError("lanterns must be an array");
    sc.lanterns = raw.lanterns.map((l, i) => {
      if (!isObj(l)) throw new BadFileError(`lanterns[${i}] must be an object`);
      if (typeof l.id !== "string" || !(LANTERN_IDS as readonly string[]).includes(l.id)) throw new BadFileError(`lanterns[${i}].id must be one of L1..L5`);
      const out: NonNullable<Scenario["lanterns"]>[number] = { id: l.id };
      if (l.pos !== undefined) out.pos = vec3(l.pos, `lanterns[${i}].pos`);
      if (l.deposited !== undefined) {
        out.deposited = count(l.deposited, `lanterns[${i}].deposited`);
        if (out.deposited > TUNING.lantern_cost) throw new BadFileError(`lanterns[${i}].deposited cannot exceed lantern_cost (${TUNING.lantern_cost})`);
      }
      if (l.lit !== undefined) {
        if (typeof l.lit !== "boolean") throw new BadFileError(`lanterns[${i}].lit must be a boolean`);
        out.lit = l.lit;
      }
      return out;
    });
  }
  if (raw.time_left_s !== undefined) {
    if (!num(raw.time_left_s) || raw.time_left_s < 0) throw new BadFileError("time_left_s must be a number >= 0");
    sc.time_left_s = raw.time_left_s;
  }
  return sc;
}

export const IDLE_INPUT: InputState = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };

export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export function parseInputs(raw: unknown): Frame[] {
  if (!isObj(raw) || !Array.isArray(raw.frames)) throw new BadFileError('inputs must be {"frames": [...]}');
  let last = -1;
  return raw.frames.map((f, i) => {
    if (!isObj(f)) throw new BadFileError(`frames[${i}] must be an object`);
    if (!num(f.tick) || !Number.isInteger(f.tick) || f.tick < 0) throw new BadFileError(`frames[${i}].tick must be an integer >= 0`);
    if (f.tick <= last) throw new BadFileError(`frames[${i}].tick must be strictly increasing`);
    last = f.tick;
    const out: Frame = { tick: f.tick };
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((x) => num(x) && x >= -1 && x <= 1)) {
        throw new BadFileError(`frames[${i}].move must be [x, z] with each in [-1, 1]`);
      }
      out.move = [f.move[0] as number, f.move[1] as number];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!num(f.cam_yaw_deg)) throw new BadFileError(`frames[${i}].cam_yaw_deg must be a number`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of ["jump", "interact", "pulse", "dash"] as const) {
      if (f[b] !== undefined) {
        if (typeof f[b] !== "boolean") throw new BadFileError(`frames[${i}].${b} must be a boolean`);
        out[b] = f[b] as boolean;
      }
    }
    return out;
  });
}

/** Walks the frames in order. A frame only changes the fields it contains; the rest persist. */
export class InputTimeline {
  private idx = 0;
  private cur: InputState = { ...IDLE_INPUT, move: [0, 0] };
  constructor(private readonly frames: Frame[]) {}
  /** Input to use for step k. Call with k = 0, 1, 2, ... */
  at(k: number): InputState {
    while (this.idx < this.frames.length && this.frames[this.idx]!.tick <= k) {
      const { tick: _t, ...rest } = this.frames[this.idx]!;
      this.cur = { ...this.cur, ...rest };
      this.idx++;
    }
    return this.cur;
  }
}
