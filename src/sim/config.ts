// Single source of truth for gameplay numbers. game.contract.json `tuning` must match (enforced by tests/contract.test.ts).
// Contract v1.1 standard numbers (Ticket-02 fixes every value). Non-contract numbers are in WORLD below; per-night data in maps.ts.
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
} as const;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Numbers the contract does not ask for (not in game.contract.json). Still gameplay numbers, so they live here only. */
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25, // L1 at (0,0,25), then every 72 degrees towards +X
  mote_count: 30,
  mote_min_r: 3, // random motes spawn between these radii (never on top of the start)
  mote_max_r: 38,
  mote_respawn_s: 4,
  shade_first_s: 5,
  shade_interval_s: 30,
  shade_max: 5,
  shade_y: 1,
  shade_spawn_r: 39,
  jump_speed: 7, // m/s, gravity below: air time 0.7 s
  gravity: 20,
} as const;

export const toTicks = (seconds: number): number => Math.round(seconds * TICK_RATE);
