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

export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned";
export type DrifterState = "idle" | "chase" | "flee" | "removed";

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number; invuln_ticks?: number; dash_cd_ticks?: number; pulse_cd_ticks?: number; charm_ticks?: number };
  random_drifters?: boolean;
  wind_enabled?: boolean;
  drifters?: Array<{ id?: string; pos: Vec3; state?: Exclude<DrifterState, "removed">; stolen?: number }>;
  charms?: Array<{ id?: string; pos: Vec3 }>;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: Array<{ pos: Vec3; id?: string; state?: ShadeState; state_ticks_left?: number }>;
  lanterns?: Array<{ id: string; pos?: Vec3; deposited?: number; lit?: boolean }>;
  time_left_s?: number;
}

export interface SimEvent {
  type: "event";
  tick: number;
  name: "dash" | "mote_picked" | "deposit" | "lantern_lit" | "pulse" | "player_hit" | "shade_spawned" | "game_over";
  data: Record<string, unknown>;
}

export type GameState = "playing" | "won" | "lost";

export interface Mote { id: string; pos: Vec3 }
export interface Shade { id: string; pos: Vec3; stunUntil: number }
export interface Lantern { id: string; pos: Vec3; deposited: number; lit: boolean }
