export type Vec3 = [number, number, number];

export interface InputState {
  pause?: boolean;
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned" | "drain";
export type DrifterState = "idle" | "chase" | "flee" | "removed";

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number; successful_lights?: number; invuln_ticks?: number; dash_cd_ticks?: number; pulse_cd_ticks?: number; charm_ticks?: number };
  random_drifters?: boolean;
  wind_enabled?: boolean;
  drifters?: Array<{ id?: string; pos: Vec3; state?: Exclude<DrifterState, "removed">; stolen?: number }>;
  charms?: Array<{ id?: string; pos: Vec3 }>;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: Array<{ pos: Vec3; id?: string; state?: ShadeState; state_ticks_left?: number }>;
  lanterns?: Array<{ id: string; pos?: Vec3; deposited?: number; lit?: boolean; fuel?: number; ever_lit?: boolean }>;
  time_left_s?: number;
}

export interface SimEvent {
  type: "event";
  tick: number;
  name: "refuel" | "lantern_out" | "fuel_drain" | "paused" | "resumed" | "drifter_steal" | "drifter_drop" | "night_start" | "dash" | "charm_picked" | "mote_picked" | "deposit" | "lantern_lit" | "pulse" | "player_hit" | "shade_spawned" | "game_over";
  data: Record<string, unknown>;
}

export type GameState = "playing" | "won" | "lost";

export interface Mote { id: string; pos: Vec3; kind: "random" | "dropped"; ttl: number | null; spawn: number }
export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number; // motes it carries
  stoleOnce: boolean; // each drifter steals only once
  ticks: number; // ticks left before a fleeing drifter disappears
  target: Vec3 | null; // idle glide target (a fog point)
}
export interface Charm { id: string; pos: Vec3; available: boolean; respawn: number }
export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  ticks: number; // ticks left in spawning / stunned / recoil
  pushLeft: number; // pulse push steps left
  pushDir: [number, number];
  recoilDir: [number, number];
  target: string | null; // lantern a wandering shade is heading for / draining
  drainTicks: number; // ticks of continuous draining (for fuel_drain events)
}
export interface Lantern {
  id: string;
  pos: Vec3;
  deposited: number;
  lit: boolean;
  fuelU: number; // fuel in 1/60 units: 6000 = 100 fuel (integers, so long runs never drift)
  everLit: boolean;
  relitCount: number;
}
