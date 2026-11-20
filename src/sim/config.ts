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
  mote_start: 20, // motes at the start, on distinct spawn points
  mote_cap: 30, // random motes never exceed this
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  dropped_ttl_ticks: 480,
  shade_spawning_ticks: 60,
  shade_recoil_ticks: 60,
  shade_recoil_m: 2,
  shade_chase_start_m: 12,
  shade_chase_stop_m: 18,
  shade_spawn_min_dist: 15,
  shade_first_count: 2,
  safe_push_per_tick: 0.2,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_interval_ticks: 1200,
  drifter_chase_carried: 5,
  drifter_chase_range: 15,
  drifter_touch_m: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_leave_ticks: 120,
  pulse_push_ticks: 15,
  pulse_center_y: 0.8,
  touch_height_tol: 1.5,
  drop_ring_min: 1.5,
  drop_ring_width: 1,
  mote_height_tol: 1.5, // |feet Y - mote Y| for pickup
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
