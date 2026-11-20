// The whole game rules. Pure and deterministic: shared by the web build and the headless CLI.
// Step order (docs/notes/assumptions.md): input, move, pickup, interact, pulse, shade spawn, shade move, hits, mote respawn, time, end check.
import { DT, TICK_RATE, TUNING, WORLD, toTicks } from "./config";
import { createRng, r3 } from "./rng";
import type { GameState, InputState, Lantern, Mote, Scenario, Shade, ShadeState, SimEvent, Vec3 } from "./types";

const dist2d = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class Sim {
  tick = 0;
  state: GameState = "playing";
  score = 0;
  readonly duration: number;
  player: { pos: Vec3; vy: number; carried: number; flames: number } = { pos: [0, 0, 0], vy: 0, carried: 0, flames: TUNING.flames };
  motes: Mote[] = [];
  shades: Shade[] = [];
  lanterns: Lantern[] = [];

  private rng: () => number;
  private respawnMotes: boolean;
  private spawnShades: boolean;
  private moteSeq = 1;
  private shadeSeq = 1;
  private spawned = 0;
  private invulnUntil = 0; // player cannot be hit on steps whose resulting tick is < this
  private pulseReadyAt = 0; // next pulse allowed on a step whose resulting tick is >= this
  private prev = { jump: false, interact: false, pulse: false };

  constructor(seed: number, sc: Scenario = {}) {
    this.rng = createRng(seed);
    this.duration = sc.time_left_s ?? TUNING.night1_duration_s;
    this.respawnMotes = sc.random_motes ?? true;
    this.spawnShades = sc.random_shades ?? true;

    if (sc.player?.pos) this.player.pos = [...sc.player.pos];
    if (sc.player?.carried !== undefined) this.player.carried = sc.player.carried;
    if (sc.player?.flames !== undefined) this.player.flames = sc.player.flames;

    // lanterns: ring of 5, then per-id overrides
    for (let i = 0; i < TUNING.lantern_count_night1; i++) {
      const a = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
      this.lanterns.push({ id: `L${i + 1}`, pos: [WORLD.lantern_ring_radius * Math.sin(a), 0, WORLD.lantern_ring_radius * Math.cos(a)], deposited: 0, lit: false });
    }
    for (const o of sc.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === o.id);
      if (!l) continue;
      if (o.pos) l.pos = [...o.pos];
      if (o.deposited !== undefined) l.deposited = o.deposited;
      if (o.lit !== undefined) l.lit = o.lit;
      if (o.lit === true && o.deposited === undefined) l.deposited = TUNING.lantern_cost;
      if (l.deposited >= TUNING.lantern_cost) l.lit = true; // a full lantern is lit, so it can never be stuck unlit
    }

    // motes: a listed array replaces the default; otherwise 30 seeded ones when random_motes
    if (sc.motes) for (const m of sc.motes) this.motes.push({ id: `M${this.moteSeq++}`, pos: [...m] });
    else if (this.respawnMotes) for (let i = 0; i < WORLD.mote_count; i++) this.motes.push(this.newMote());

    for (const s of sc.shades ?? []) if (s.id) this.reservedIds.add(s.id);
    for (const s of sc.shades ?? []) this.shades.push({ id: s.id ?? this.freeShadeId(), pos: [...s.pos], stunUntil: 0 });
  }

  get timeLeft(): number {
    return this.duration - this.tick / TICK_RATE;
  }

  shadeState(s: Shade): ShadeState {
    return this.tick < s.stunUntil ? "stunned" : "chase";
  }

  private reservedIds = new Set<string>(); // explicit scenario ids, so generated ids never collide with them

  private freeShadeId(): string {
    let id = `S${this.shadeSeq++}`;
    while (this.reservedIds.has(id) || this.shades.some((s) => s.id === id)) id = `S${this.shadeSeq++}`;
    return id;
  }

  private newMote(): Mote {
    const r = WORLD.mote_min_r + (WORLD.mote_max_r - WORLD.mote_min_r) * Math.sqrt(this.rng());
    const a = 2 * Math.PI * this.rng();
    return { id: `M${this.moteSeq++}`, pos: [r * Math.sin(a), 0, r * Math.cos(a)] };
  }

  /**
   * Shades never stand inside safe_radius of a LIT lantern. A shade inside is moved to the nearest point that is outside
   * every lit zone: its radial projection onto one zone edge, or (when zones overlap) an intersection of two edges.
   * If no such point exists (three or more mutually covering zones) it stays put; the default ring cannot do that.
   */
  private enforceSafeZones(): void {
    const R = TUNING.safe_radius;
    const EPS = 1e-9;
    const lit = this.lanterns.filter((l) => l.lit);
    if (lit.length === 0) return;
    const outside = (x: number, z: number): boolean => lit.every((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) >= R - EPS);
    for (const s of this.shades) {
      if (outside(s.pos[0], s.pos[2])) continue;
      const cands: Array<[number, number]> = [];
      for (const l of lit) {
        const d = dist2d(s.pos, l.pos);
        cands.push(d === 0 ? [l.pos[0] + R, l.pos[2]] : [l.pos[0] + ((s.pos[0] - l.pos[0]) / d) * R, l.pos[2] + ((s.pos[2] - l.pos[2]) / d) * R]);
      }
      for (let i = 0; i < lit.length; i++) {
        for (let j = i + 1; j < lit.length; j++) {
          const a = lit[i]!.pos, b = lit[j]!.pos;
          const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (d === 0 || d > 2 * R) continue;
          const h = Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2)));
          const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
          const ux = (b[0] - a[0]) / d, uz = (b[2] - a[2]) / d;
          cands.push([mx - uz * h, mz + ux * h], [mx + uz * h, mz - ux * h]);
        }
      }
      let best: [number, number] | undefined;
      let bestD = Infinity;
      for (const c of cands) {
        if (!outside(c[0], c[1])) continue;
        const d = Math.hypot(c[0] - s.pos[0], c[1] - s.pos[2]);
        if (d < bestD) { best = c; bestD = d; }
      }
      if (best) s.pos = [best[0], s.pos[1], best[1]];
    }
  }

  /** One fixed step (1/60 s). Returns the events of this step, stamped tick = k+1. */
  step(inp: InputState): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.state !== "playing") return ev;
    const T = this.tick + 1;
    const emit = (name: SimEvent["name"], data: Record<string, unknown>) => ev.push({ type: "event", tick: T, name, data });
    const p = this.player;

    // 1. input edges
    const jumpEdge = inp.jump && !this.prev.jump;
    const interactEdge = inp.interact && !this.prev.interact;
    const pulseEdge = inp.pulse && !this.prev.pulse;
    this.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse };

    // 2. player move (XZ by camera yaw) + vertical
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    let nx = p.pos[0] + wx * TUNING.player_speed * DT;
    let nz = p.pos[2] + wz * TUNING.player_speed * DT;
    const rr = Math.hypot(nx, nz);
    if (rr > WORLD.island_radius) { nx = (nx / rr) * WORLD.island_radius; nz = (nz / rr) * WORLD.island_radius; } // fall_enabled=false
    p.pos[0] = nx;
    p.pos[2] = nz;
    if (jumpEdge && p.pos[1] === 0 && p.vy === 0) p.vy = WORLD.jump_speed;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= WORLD.gravity * DT;
      p.pos[1] += p.vy * DT;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
    }

    // 3. pickup (automatic, id order, only while there is room)
    for (const m of [...this.motes]) {
      if (p.carried >= TUNING.carry_capacity) break;
      if (dist2d(p.pos, m.pos) <= TUNING.pickup_radius) {
        this.motes = this.motes.filter((x) => x !== m);
        p.carried++;
        emit("mote_picked", { carried: p.carried });
      }
    }

    // 4. interact: deposit into the nearest unlit lantern in reach
    if (interactEdge && p.carried > 0) {
      let best: Lantern | undefined;
      let bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = dist2d(p.pos, l.pos);
        if (d <= TUNING.interact_radius && d < bestD) { best = l; bestD = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.score += amount * TUNING.score.per_mote;
          emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= TUNING.lantern_cost) {
            best.lit = true;
            this.score += TUNING.score.per_lantern;
            emit("lantern_lit", { lantern_id: best.id });
          }
        }
      }
    }

    // 5. pulse: costs carried motes; stuns + pushes shades in range
    if (pulseEdge && T >= this.pulseReadyAt && p.carried >= TUNING.pulse_cost) {
      p.carried -= TUNING.pulse_cost;
      this.pulseReadyAt = T + toTicks(TUNING.pulse_cooldown_s);
      const stunned: string[] = [];
      for (const s of this.shades) {
        const d = dist2d(p.pos, s.pos);
        if (d > TUNING.pulse_radius) continue;
        const ux = d === 0 ? 1 : (s.pos[0] - p.pos[0]) / d; // standing on the player: pushed towards +X
        const uz = d === 0 ? 0 : (s.pos[2] - p.pos[2]) / d;
        let sx = s.pos[0] + ux * TUNING.pulse_push_m;
        let sz = s.pos[2] + uz * TUNING.pulse_push_m;
        const sr = Math.hypot(sx, sz);
        if (sr > WORLD.island_radius) { sx = (sx / sr) * WORLD.island_radius; sz = (sz / sr) * WORLD.island_radius; }
        s.pos = [sx, s.pos[1], sz];
        s.stunUntil = T + toTicks(TUNING.pulse_stun_s);
        stunned.push(s.id);
        this.score += TUNING.score.per_stun;
      }
      emit("pulse", { stunned_ids: stunned });
    }

    // 6. shade spawn: first at 5 s, then every 30 s, up to 5, at the island edge
    if (this.spawnShades && this.spawned < WORLD.shade_max) {
      const due = toTicks(WORLD.shade_first_s) + this.spawned * toTicks(WORLD.shade_interval_s);
      if (T === due) {
        const a = 2 * Math.PI * this.rng();
        const id = this.freeShadeId();
        this.shades.push({ id, pos: [WORLD.shade_spawn_r * Math.sin(a), WORLD.shade_y, WORLD.shade_spawn_r * Math.cos(a)], stunUntil: 0 });
        this.spawned++;
        emit("shade_spawned", { id });
      }
    }

    // 7. shade move: chase in XZ unless stunned; then keep them out of lit lanterns' safe zones
    for (const s of this.shades) {
      if (T < s.stunUntil) continue;
      const d = dist2d(s.pos, p.pos);
      const stepLen = TUNING.shade_speed * DT;
      if (d <= stepLen) { s.pos = [p.pos[0], s.pos[1], p.pos[2]]; continue; }
      s.pos = [s.pos[0] + ((p.pos[0] - s.pos[0]) / d) * stepLen, s.pos[1], s.pos[2] + ((p.pos[2] - s.pos[2]) / d) * stepLen];
    }
    this.enforceSafeZones();

    // 8. hits: first non-stunned shade in reach, unless invulnerable
    if (T >= this.invulnUntil) {
      const hitter = this.shades.find((s) => T >= s.stunUntil && dist2d(s.pos, p.pos) <= TUNING.shade_hit_radius);
      if (hitter) {
        const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
        p.carried -= dropped;
        p.flames -= 1;
        this.invulnUntil = T + toTicks(TUNING.invuln_s);
        emit("player_hit", { by: "shade", flames: p.flames, dropped });
      }
    }

    // 9. mote respawn (only when random_motes): +1 every 4 s up to 30
    if (this.respawnMotes && T % toTicks(WORLD.mote_respawn_s) === 0 && this.motes.length < WORLD.mote_count) this.motes.push(this.newMote());

    // 10. time
    this.tick = T;

    // 11. end check: all_lit, then no_flames, then dawn
    const left = this.timeLeft;
    if (this.lanterns.every((l) => l.lit)) {
      this.state = "won";
      this.score += Math.floor(left + 1e-9) * TUNING.score.per_second_left + Math.max(0, p.flames) * TUNING.score.per_flame_left;
      emit("game_over", { result: "won", reason: "all_lit" });
    } else if (p.flames <= 0) {
      this.state = "lost";
      emit("game_over", { result: "lost", reason: "no_flames" });
    } else if (left <= 1e-9) {
      this.state = "lost";
      emit("game_over", { result: "lost", reason: "dawn" });
    }
    return ev;
  }

  snapshot(): Record<string, unknown> {
    const v = (a: Vec3) => [r3(a[0]), r3(a[1]), r3(a[2])];
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: r3(this.score),
      player: { pos: v(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v(s.pos), state: this.shadeState(s) })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: v(m.pos) })),
    };
  }
}
