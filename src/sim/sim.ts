// The whole game rules. Pure and deterministic: shared by the web build and the headless CLI.
// Step order (docs/notes/assumptions.md): input, move, pickup, interact, pulse, shade spawn, shade move, hits, mote respawn, time, end check.
import { DT, TICK_RATE, TUNING, WORLD, toTicks } from "./config";
import { NIGHTS, groundHeight, type NightDef } from "./maps";
import { createRng, r3 } from "./rng";
import type { Charm, GameState, InputState, Lantern, Mote, Scenario, Shade, ShadeState, SimEvent, Vec3 } from "./types";

const dist2d = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class Sim {
  tick = 0;
  state: GameState = "playing";
  score = 0;
  readonly duration: number;
  readonly night: 1 | 2 | 3;
  readonly def: NightDef;
  player: { pos: Vec3; vy: number; carried: number; flames: number } = { pos: [0, 0, 0], vy: 0, carried: 0, flames: TUNING.flames };
  // movement state (step 2)
  vh: [number, number] = [0, 0]; // horizontal velocity used on the last step
  grounded = true;
  facing: [number, number] = [0, 1];
  private dashLeft = 0; // dash steps still to move
  private dashCd = 0; // ticks until the next dash is allowed (counter: blocks the following N-1 steps)
  private dashDir: [number, number] = [0, 1];
  private launched = false;
  private launchV: [number, number] = [0, 0];
  private fallWait = 0; // ticks of inert waiting after a fall
  private windRng: () => number;
  private windNextDir = 0; // degrees: direction of the current or next gust
  private windEnabled: boolean;
  windActive = false;
  motes: Mote[] = [];
  shades: Shade[] = [];
  lanterns: Lantern[] = [];
  charms: Charm[] = [];
  charmTicks = 0; // run-speed boost ticks left

  private rng: () => number;
  private respawnMotes: boolean;
  private spawnShades: boolean;
  private moteSeq = 1;
  private shadeSeq = 1;
  private spawned = 0;
  private invulnUntil = 0; // player cannot be hit on steps whose resulting tick is < this
  private pulseReadyAt = 0; // next pulse allowed on a step whose resulting tick is >= this
  private prev = { jump: false, dash: false, interact: false, pulse: false };

  constructor(seed: number, sc: Scenario = {}, night: 1 | 2 | 3 = 1) {
    this.night = night;
    this.def = NIGHTS[night];
    this.rng = createRng(seed);
    this.windRng = createRng((seed ^ 0x57494e44) >>> 0);
    this.windNextDir = r3(this.windRng() * 360);
    this.windEnabled = sc.wind_enabled ?? this.def.wind;
    this.facing = [...this.def.startFacing];
    this.dashDir = [...this.def.startFacing];
    this.player.pos = [...this.def.start];
    this.duration = sc.time_left_s ?? this.def.duration_s;
    this.respawnMotes = sc.random_motes ?? true;
    this.spawnShades = sc.random_shades ?? true;

    if (sc.player?.pos) this.player.pos = [...sc.player.pos];
    if (sc.player?.carried !== undefined) this.player.carried = sc.player.carried;
    if (sc.player?.flames !== undefined) this.player.flames = sc.player.flames;
    if (sc.player?.dash_cd_ticks !== undefined) this.dashCd = sc.player.dash_cd_ticks;

    // lanterns: the night's fixed positions, then per-id overrides
    this.def.lanterns.forEach((pos, i) => this.lanterns.push({ id: `L${i + 1}`, pos: [...pos], deposited: 0, lit: false }));
    for (const o of sc.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === o.id);
      if (!l) continue; // an id this night does not have is ignored
      if (o.pos) l.pos = [...o.pos];
      if (o.deposited !== undefined) l.deposited = o.deposited;
      if (o.lit !== undefined) l.lit = o.lit;
      if (o.lit === true && o.deposited === undefined) l.deposited = TUNING.lantern_cost;
      if (l.deposited >= TUNING.lantern_cost) l.lit = true; // a full lantern is lit, so it can never be stuck unlit
    }

    // motes: a listed array replaces the default; otherwise 30 seeded ones when random_motes
    if (sc.motes) for (const m of sc.motes) this.motes.push({ id: `M${this.moteSeq++}`, pos: [...m], kind: "random", ttl: null, spawn: -1 });
    else if (this.respawnMotes) {
      const idx = this.def.moteSpawns.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { // seeded Fisher-Yates, then take the first 20
        const j = Math.floor(this.rng() * (i + 1));
        [idx[i], idx[j]] = [idx[j]!, idx[i]!];
      }
      for (const i of idx.slice(0, WORLD.mote_start).sort((a, b) => a - b)) {
        this.motes.push({ id: `M${this.moteSeq++}`, pos: [...this.def.moteSpawns[i]!], kind: "random", ttl: null, spawn: i });
      }
    }

    const charmPos = sc.charms ? sc.charms.map((c) => c.pos) : this.def.charmSpawns;
    charmPos.forEach((pos, i) => this.charms.push({ id: sc.charms?.[i]?.id ?? `C${i + 1}`, pos: [...pos], available: true, respawn: 0 }));
    if (sc.player?.charm_ticks !== undefined) this.charmTicks = sc.player.charm_ticks;

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

  /** +1 random mote on a random empty spawn point (none free: skip). */
  private respawnMote(): void {
    const taken = new Set(this.motes.filter((m) => m.kind === "random").map((m) => m.spawn));
    const free = this.def.moteSpawns.map((_, i) => i).filter((i) => !taken.has(i));
    if (free.length === 0) return;
    const i = free[Math.floor(this.rng() * free.length)]!;
    this.motes.push({ id: `M${this.moteSeq++}`, pos: [...this.def.moteSpawns[i]!], kind: "random", ttl: null, spawn: i });
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

  /** Night 3 gusts: every 30 s a 5 s gust (ticks 1800k .. 1800k+299 for k >= 1; Q2-8). */
  private windOn(T: number): boolean {
    return T >= 1800 && T % 1800 < 300;
  }

  private respawnPlayer(T: number): void {
    this.player.pos = [...this.def.start];
    this.player.vy = 0;
    this.grounded = true;
    this.launched = false;
    this.dashLeft = 0;
    this.facing = [...this.def.startFacing];
    this.invulnUntil = T + toTicks(TUNING.invuln_s);
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
    const dashEdge = inp.dash && !this.prev.dash;
    const interactEdge = inp.interact && !this.prev.interact && this.fallWait === 0;
    const pulseEdge = inp.pulse && !this.prev.pulse && this.fallWait === 0;
    this.prev = { jump: inp.jump, dash: inp.dash, interact: inp.interact, pulse: inp.pulse };
    this.windActive = this.windEnabled && this.windOn(T);
    if (this.windEnabled && T >= 1800 && T % 1800 === 300) this.windNextDir = r3(this.windRng() * 360); // gust over: pick the next direction

    // 2. timers (counters set at step k block steps k+1..k+N-1; ready again at step k+N)
    if (this.dashCd > 0) this.dashCd--;
    if (this.charmTicks > 0) this.charmTicks--;
    for (const c of this.charms) if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
    this.motes = this.motes.filter((m) => m.ttl === null || --m.ttl > 0);
    if (this.fallWait > 0) {
      this.fallWait--;
      if (this.fallWait === 0) this.respawnPlayer(T);
    }
    const inert = this.fallWait > 0;

    // 3. move: jump, dash, launch pad, wind; then fall check
    this.vh = [0, 0];
    if (!inert) {
      let [mx, mz] = inp.move;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const th = (inp.cam_yaw_deg * Math.PI) / 180;
      const wx = mx * Math.cos(th) + mz * Math.sin(th);
      const wz = -mx * Math.sin(th) + mz * Math.cos(th);
      const wl = Math.hypot(wx, wz);
      const moving = wl > 1e-12;
      if (moving) this.facing = [wx / wl, wz / wl];

      if (jumpEdge && this.grounded) { p.vy = WORLD.jump_speed; this.grounded = false; }
      if (dashEdge && (this.dashCd === 0 || this.charmTicks > 0) && this.dashLeft === 0) {
        this.dashLeft = toTicks(TUNING.dash_duration_s);
        this.dashCd = this.charmTicks > 0 ? 0 : toTicks(TUNING.dash_cooldown_s); // a charm removes the cooldown
        this.dashDir = moving ? [wx / wl, wz / wl] : [...this.facing];
        emit("dash", {});
      }
      if (this.grounded && !this.launched) {
        for (const pad of this.def.pads) {
          if (Math.hypot(p.pos[0] - pad.center[0], p.pos[2] - pad.center[2]) <= pad.radius && Math.abs(p.pos[1] - pad.center[1]) <= 1) {
            let dx = 0, dz = -1;
            if (pad.target !== "minusZ") {
              const tx = pad.target[0] - p.pos[0], tz = pad.target[1] - p.pos[2];
              const tl = Math.hypot(tx, tz) || 1;
              dx = tx / tl; dz = tz / tl;
            }
            this.launched = true;
            this.launchV = [dx * pad.vh, dz * pad.vh];
            p.vy = pad.vy;
            this.grounded = false;
            break;
          }
        }
      }
      const dashing = this.dashLeft > 0;
      let vx: number, vz: number;
      if (dashing) { vx = this.dashDir[0] * TUNING.dash_speed; vz = this.dashDir[1] * TUNING.dash_speed; this.dashLeft--; }
      else if (this.launched) { vx = this.launchV[0]; vz = this.launchV[1]; }
      else {
        const speed = this.charmTicks > 0 ? WORLD.charm_speed : TUNING.player_speed;
        vx = wx * speed; vz = wz * speed;
      }
      this.vh = [vx, vz];
      let dx = vx * DT, dz = vz * DT;
      if (this.windActive) {
        const wd = (this.windNextDir * Math.PI) / 180;
        dx += Math.cos(wd) * 2 * DT;
        dz += Math.sin(wd) * 2 * DT;
      }
      // horizontal move: a surface more than 0.25 m above the feet blocks (walls, tower); try sliding along one axis
      const free = (x: number, z: number): boolean => {
        const h = groundHeight(this.night, x, z);
        return h === null || h <= p.pos[1] + 0.25;
      };
      if (free(p.pos[0] + dx, p.pos[2] + dz)) { p.pos[0] += dx; p.pos[2] += dz; }
      else if (free(p.pos[0] + dx, p.pos[2])) p.pos[0] += dx;
      else if (free(p.pos[0], p.pos[2] + dz)) p.pos[2] += dz;

      // vertical
      const h = groundHeight(this.night, p.pos[0], p.pos[2]);
      if (this.grounded) {
        if (h !== null && h >= p.pos[1] - 0.25) { p.pos[1] = h; p.vy = 0; }
        else this.grounded = false; // stepped off an edge
      }
      if (!this.grounded) {
        if (dashing) p.vy = 0; // a dash keeps the height
        else { p.vy -= WORLD.gravity * DT; p.pos[1] += p.vy * DT; }
        if (h !== null && p.vy <= 0 && p.pos[1] <= h) { p.pos[1] = h; p.vy = 0; this.grounded = true; this.launched = false; }
      }

      // fall: exactly once per fall, ignores invulnerability
      if (p.pos[1] < -10) {
        p.flames -= 1;
        emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost: p.carried });
        p.carried = 0;
        this.fallWait = toTicks(1);
        this.vh = [0, 0];
        p.vy = 0;
      }
    }

    // 4. pickup: motes and charms, XZ <= pickup_radius and |feet Y - item Y| <= 1.5 (id order, only while there is room)
    if (!inert) {
      const reach = (pos: Vec3): boolean => dist2d(p.pos, pos) <= TUNING.pickup_radius && Math.abs(p.pos[1] - pos[1]) <= WORLD.mote_height_tol;
      for (const m of [...this.motes]) {
        if (p.carried >= TUNING.carry_capacity) break;
        if (reach(m.pos)) {
          this.motes = this.motes.filter((x) => x !== m);
          p.carried++;
          emit("mote_picked", { carried: p.carried });
        }
      }
      for (const c of this.charms) {
        if (!c.available || !reach(c.pos)) continue;
        c.available = false;
        c.respawn = WORLD.charm_respawn_ticks;
        this.charmTicks = WORLD.charm_ticks;
        emit("charm_picked", { charm_id: c.id, charm_ticks: WORLD.charm_ticks });
      }
    }

    // 5. interact: deposit into the nearest unlit lantern in reach
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
    if (T >= this.invulnUntil && this.fallWait === 0) {
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
    if (this.respawnMotes && T % toTicks(WORLD.mote_respawn_s) === 0 && this.motes.filter((m) => m.kind === "random").length < WORLD.mote_cap) this.respawnMote();

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
      night: this.night,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: r3(this.score),
      wind: { active: this.windActive, dir_deg: this.windNextDir },
      player: {
        pos: v(this.player.pos),
        vel: [r3(this.vh[0]), r3(this.player.vy), r3(this.vh[1])],
        grounded: this.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        invuln: this.invulnUntil - this.tick > 0,
        charm_s: r3(this.charmTicks / TICK_RATE),
        dash_cd_s: r3(this.dashCd / TICK_RATE),
        pulse_cd_s: r3(Math.max(0, this.pulseReadyAt - this.tick) / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v(s.pos), state: this.shadeState(s) })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: v(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_RATE) })),
      drifters: [],
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    };
  }
}
