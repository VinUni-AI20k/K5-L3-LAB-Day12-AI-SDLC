// The whole game rules. Pure and deterministic: shared by the web build and the headless CLI.
// Tick order (docs/spec/ticket-02.md): 1 input, 2 timers, 3 move, 4 pickup, 5 interact, 6 safe zones, 7 pulse, 8 move shades, 9 touch, 10 spawn, 11 end check.
import { DT, TICK_RATE, TUNING, WORLD, toTicks } from "./config";
import { NIGHTS, groundHeight, type NightDef } from "./maps";
import { createRng, r3 } from "./rng";
import type { Charm, Drifter, GameState, InputState, Lantern, Mote, Scenario, Shade, ShadeState, SimEvent, Vec3 } from "./types";

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
  drifters: Drifter[] = [];
  private spawnDrifters: boolean;
  private drifterSeq = 1;
  private drifterReserved = new Set<string>();
  charmTicks = 0; // run-speed boost ticks left

  private rng: () => number;
  private respawnMotes: boolean;
  private spawnShades: boolean;
  private moteSeq = 1;
  private shadeSeq = 1;
  private spawned = 0; // scheduled shades spawned so far
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
    this.spawnDrifters = sc.random_drifters ?? this.def.drifters;

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

    for (const d of sc.drifters ?? []) if (d.id) this.drifterReserved.add(d.id);
    for (const d of sc.drifters ?? []) {
      const state = d.state ?? "idle";
      this.drifters.push({
        id: d.id ?? this.freeDrifterId(), pos: [...d.pos], state, stolen: d.stolen ?? 0,
        stoleOnce: state === "flee" || (d.stolen ?? 0) > 0, ticks: state === "flee" ? WORLD.drifter_flee_ticks : 0, target: null,
      });
    }
    for (const s of sc.shades ?? []) if (s.id) this.reservedIds.add(s.id);
    for (const s of sc.shades ?? []) {
      this.shades.push({ ...this.newShade(s.id ?? this.freeShadeId(), s.pos, s.state ?? "wander"), ticks: s.state_ticks_left ?? 0 });
    }
  }

  get timeLeft(): number {
    return this.duration - this.tick / TICK_RATE;
  }

  shadeState(s: Shade): ShadeState {
    return s.state;
  }

  private newShade(id: string, pos: Vec3, state: ShadeState): Shade {
    return { id, pos: [...pos], state, ticks: 0, pushLeft: 0, pushDir: [1, 0], recoilDir: [1, 0] };
  }

  /** Walkable for a flying shade: there is ground, and it is not inside the Night 3 bell tower (r 2). */
  private shadeFree(x: number, z: number): boolean {
    if (groundHeight(this.night, x, z) === null) return false;
    return !(this.night === 3 && Math.hypot(x, z) < 2);
  }

  private freeDrifterId(): string {
    let id = `D${this.drifterSeq++}`;
    while (this.drifterReserved.has(id) || this.drifters.some((d) => d.id === id)) id = `D${this.drifterSeq++}`;
    return id;
  }

  /** Height of a ribbon's centre: ground + 1.0, or where it is now when there is no ground. */
  private shadeY(x: number, z: number, fallback: number): number {
    const h = groundHeight(this.night, x, z);
    return h === null ? fallback : h + 1;
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

  /** Nearest point outside every lit zone: radial projection onto one zone edge, or the intersection of two edges when zones overlap. */
  private nearestOutside(x: number, z: number): [number, number] | undefined {
    const R = TUNING.safe_radius;
    const lit = this.lanterns.filter((l) => l.lit);
    const outside = (px: number, pz: number): boolean => lit.every((l) => Math.hypot(px - l.pos[0], pz - l.pos[2]) >= R - 1e-9);
    if (outside(x, z)) return [x, z];
    const cands: Array<[number, number]> = [];
    for (const l of lit) {
      const d = Math.hypot(x - l.pos[0], z - l.pos[2]);
      cands.push(d === 0 ? [l.pos[0] + R, l.pos[2]] : [l.pos[0] + ((x - l.pos[0]) / d) * R, l.pos[2] + ((z - l.pos[2]) / d) * R]);
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
      const d = Math.hypot(c[0] - x, c[1] - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  private insideLitZone(pos: Vec3): boolean {
    return this.lanterns.some((l) => l.lit && dist2d(pos, l.pos) < TUNING.safe_radius - 1e-9);
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

    if (T === 1) emit("night_start", { night: this.night }); // tick 0 has no events, so the first step announces the night

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
    for (const sh of this.shades) {
      if (sh.ticks > 0 && --sh.ticks === 0 && (sh.state === "spawning" || sh.state === "stunned" || sh.state === "recoil")) sh.state = "wander";
    }
    for (const d of this.drifters) {
      if (d.state === "removed" || d.ticks === 0) continue;
      if (--d.ticks === 0 && d.state === "flee") { d.state = "removed"; d.stolen = 0; } // disappears along with what it stole
    }
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

    // 6. safe zones: a shade inside a lit zone is pushed radially out at 0.2 m per tick, harmless meanwhile
    const pushedOut = new Set<Shade>();
    for (const sh of this.shades) {
      const l = this.lanterns.find((x) => x.lit && dist2d(sh.pos, x.pos) < TUNING.safe_radius - 1e-9);
      if (!l) continue;
      const d = dist2d(sh.pos, l.pos);
      const nd = Math.min(TUNING.safe_radius, d + WORLD.safe_push_per_tick);
      const ux = d === 0 ? 1 : (sh.pos[0] - l.pos[0]) / d;
      const uz = d === 0 ? 0 : (sh.pos[2] - l.pos[2]) / d;
      sh.pos = [l.pos[0] + ux * nd, sh.pos[1], l.pos[2] + uz * nd];
      pushedOut.add(sh);
    }

    // 7. pulse: costs 3 motes, 3D range from feet + 0.8, targets locked now; stun 120 ticks, push 4 m over 15 ticks
    if (pulseEdge && T >= this.pulseReadyAt && p.carried >= TUNING.pulse_cost) {
      p.carried -= TUNING.pulse_cost;
      this.pulseReadyAt = T + toTicks(TUNING.pulse_cooldown_s);
      const stunned: string[] = [];
      for (const sh of this.shades) {
        const dx = sh.pos[0] - p.pos[0], dz = sh.pos[2] - p.pos[2];
        const dy = sh.pos[1] - (p.pos[1] + WORLD.pulse_center_y);
        if (Math.hypot(dx, dy, dz) > TUNING.pulse_radius) continue;
        const dh = Math.hypot(dx, dz);
        sh.pushDir = dh === 0 ? [1, 0] : [dx / dh, dz / dh]; // on the same spot: towards +X
        sh.pushLeft = WORLD.pulse_push_ticks;
        sh.state = "stunned";
        sh.ticks = toTicks(TUNING.pulse_stun_s);
        stunned.push(sh.id);
        this.score += TUNING.score.per_stun;
      }
      emit("pulse", { stunned_ids: stunned });
      for (const d of this.drifters) { // drifters: no stun, no score, not in stunned_ids
        if (d.state !== "chase" && d.state !== "flee") continue;
        const dist = Math.hypot(d.pos[0] - p.pos[0], d.pos[1] - (p.pos[1] + WORLD.pulse_center_y), d.pos[2] - p.pos[2]);
        if (dist > TUNING.pulse_radius) continue;
        if (d.state === "chase") { d.state = "flee"; d.ticks = WORLD.drifter_flee_ticks; }
        else if (d.stolen > 0) {
          const y = groundHeight(this.night, d.pos[0], d.pos[2]) ?? p.pos[1];
          for (let i = 0; i < d.stolen; i++) this.motes.push({ id: `M${this.moteSeq++}`, pos: [d.pos[0], y, d.pos[2]], kind: "dropped", ttl: WORLD.dropped_ttl_ticks, spawn: -1 });
          emit("drifter_drop", { drifter_id: d.id, amount: d.stolen });
          d.stolen = 0;
          d.ticks = WORLD.drifter_drop_leave_ticks;
        }
      }
    }

    // 8. move shades
    const R = TUNING.safe_radius;
    for (const sh of this.shades) {
      let nx = sh.pos[0], nz = sh.pos[2];
      if (!pushedOut.has(sh)) {
        if (sh.pushLeft > 0) {
          sh.pushLeft--;
          const step = TUNING.pulse_push_m / WORLD.pulse_push_ticks;
          if (this.shadeFree(nx + sh.pushDir[0] * step, nz + sh.pushDir[1] * step)) { nx += sh.pushDir[0] * step; nz += sh.pushDir[1] * step; }
        }
        if (sh.state === "recoil") {
          const step = WORLD.shade_recoil_m / WORLD.shade_recoil_ticks;
          if (this.shadeFree(nx + sh.recoilDir[0] * step, nz + sh.recoilDir[1] * step)) { nx += sh.recoilDir[0] * step; nz += sh.recoilDir[1] * step; }
        } else if (sh.state === "wander" || sh.state === "chase") {
          const d = this.fallWait > 0 ? Infinity : Math.hypot(p.pos[0] - nx, p.pos[2] - nz);
          if (sh.state === "wander" && d <= WORLD.shade_chase_start_m) sh.state = "chase";
          else if (sh.state === "chase" && d > WORLD.shade_chase_stop_m) sh.state = "wander";
          if (sh.state === "chase") {
            const stepLen = this.def.shadeSpeed * DT;
            const tx = d <= stepLen ? p.pos[0] : nx + ((p.pos[0] - nx) / d) * stepLen;
            const tz = d <= stepLen ? p.pos[2] : nz + ((p.pos[2] - nz) / d) * stepLen;
            if (this.shadeFree(tx, tz)) { nx = tx; nz = tz; }
          }
        }
        // shades outside a lit zone are blocked at its edge
        const out = this.nearestOutside(nx, nz);
        if (out) { nx = out[0]; nz = out[1]; }
        else { nx = sh.pos[0]; nz = sh.pos[2]; }
        void R;
        sh.pos = [nx, nx === sh.pos[0] && nz === sh.pos[2] ? sh.pos[1] : this.shadeY(nx, nz, sh.pos[1]), nz];
      }
    }

    for (const d of this.drifters) { // drifters ignore safe zones, walls and invulnerability
      if (d.state === "removed") continue;
      const dx = p.pos[0] - d.pos[0], dz = p.pos[2] - d.pos[2];
      const dist = Math.hypot(dx, dz);
      const near = this.fallWait === 0 && p.carried >= WORLD.drifter_chase_carried && dist <= WORLD.drifter_chase_range;
      if (d.state === "idle" && near) d.state = "chase";
      else if (d.state === "chase" && !near) d.state = "idle";
      let nx = d.pos[0], nz = d.pos[2];
      if (d.state === "chase") {
        const step = WORLD.drifter_speed * DT;
        if (dist <= step) { nx = p.pos[0]; nz = p.pos[2]; } else { nx += (dx / dist) * step; nz += (dz / dist) * step; }
      } else if (d.state === "flee") {
        const step = WORLD.drifter_speed * DT;
        if (dist === 0) nx += step; else { nx -= (dx / dist) * step; nz -= (dz / dist) * step; }
      } else { // idle: glide towards a seeded fog point, then pick another
        if (!d.target || Math.hypot(d.target[0] - nx, d.target[2] - nz) <= 0.01) d.target = [...this.def.shadeSpawns[Math.floor(this.rng() * this.def.shadeSpawns.length)]!];
        const tx = d.target[0] - nx, tz = d.target[2] - nz;
        const tl = Math.hypot(tx, tz);
        const step = Math.min(WORLD.drifter_idle_speed * DT, tl);
        if (tl > 0) { nx += (tx / tl) * step; nz += (tz / tl) * step; }
      }
      d.pos = [nx, this.shadeY(nx, nz, d.pos[1]), nz];
    }

    // 9. touch: drifters steal first, then shades hit in ascending id order, at most one flame per tick
    if (this.fallWait === 0) {
      for (const d of this.drifters) {
        if (d.state !== "chase" || d.stoleOnce || dist2d(d.pos, p.pos) > WORLD.drifter_touch_m) continue;
        const amount = Math.min(WORLD.drifter_steal, p.carried);
        p.carried -= amount;
        d.stolen = amount;
        d.stoleOnce = true;
        d.state = "flee";
        d.ticks = WORLD.drifter_flee_ticks;
        emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (T >= this.invulnUntil && this.fallWait === 0) {
      const order = [...this.shades].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const hitter = order.find((sh) =>
        (sh.state === "wander" || sh.state === "chase") && !pushedOut.has(sh) && !this.insideLitZone(sh.pos) &&
        dist2d(sh.pos, p.pos) <= TUNING.shade_hit_radius && Math.abs(sh.pos[1] - p.pos[1]) <= WORLD.touch_height_tol);
      if (hitter) {
        const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
        p.carried -= dropped;
        p.flames -= 1;
        this.invulnUntil = T + toTicks(TUNING.invuln_s);
        const dx = hitter.pos[0] - p.pos[0], dz = hitter.pos[2] - p.pos[2];
        const dh = Math.hypot(dx, dz);
        hitter.recoilDir = dh === 0 ? [1, 0] : [dx / dh, dz / dh];
        hitter.state = "recoil";
        hitter.ticks = WORLD.shade_recoil_ticks;
        const baseY = this.grounded ? p.pos[1] : (groundHeight(this.night, p.pos[0], p.pos[2]) ?? 0);
        for (let i = 0; i < dropped; i++) {
          const r = WORLD.drop_ring_min + WORLD.drop_ring_width * this.rng();
          const a = 2 * Math.PI * this.rng();
          const x = p.pos[0] + r * Math.cos(a), z = p.pos[2] + r * Math.sin(a);
          const y = groundHeight(this.night, x, z) ?? baseY;
          this.motes.push({ id: `M${this.moteSeq++}`, pos: [x, y, z], kind: "dropped", ttl: WORLD.dropped_ttl_ticks, spawn: -1 });
        }
        emit("player_hit", { by: "shade", flames: p.flames, dropped });
      }
    }

    // 10. spawn: motes, then shades on schedule (2 at the first time, then one per interval, up to the night's max)
    if (this.respawnMotes && T % toTicks(WORLD.mote_respawn_s) === 0 && this.motes.filter((m) => m.kind === "random").length < WORLD.mote_cap) this.respawnMote();
    if (this.spawnDrifters && T % WORLD.drifter_interval_ticks === 0 && this.drifters.filter((d) => d.state !== "removed").length < WORLD.drifter_max) {
      const pt = this.def.shadeSpawns[Math.floor(this.rng() * this.def.shadeSpawns.length)]!;
      this.drifters.push({ id: this.freeDrifterId(), pos: [pt[0], this.shadeY(pt[0], pt[2], 1), pt[2]], state: "idle", stolen: 0, stoleOnce: false, ticks: 0, target: null });
    }
    if (this.spawnShades && this.spawned < this.def.shadeMax) {
      let count = 0;
      if (T === this.def.shadeFirstTick) count = WORLD.shade_first_count;
      else if (T > this.def.shadeFirstTick && (T - this.def.shadeFirstTick) % this.def.shadeInterval === 0) count = 1;
      for (let i = 0; i < count && this.spawned < this.def.shadeMax; i++) {
        const valid = this.def.shadeSpawns.filter((pt) =>
          Math.hypot(pt[0] - p.pos[0], pt[2] - p.pos[2]) >= WORLD.shade_spawn_min_dist && !this.shades.some((sh) => dist2d(sh.pos, pt) < 1));
        if (valid.length === 0) continue; // no valid point: skip
        const pt = valid[Math.floor(this.rng() * valid.length)]!;
        const sh = this.newShade(this.freeShadeId(), [pt[0], this.shadeY(pt[0], pt[2], 1), pt[2]], "spawning");
        sh.ticks = WORLD.shade_spawning_ticks;
        this.shades.push(sh);
        this.spawned++;
        emit("shade_spawned", { id: sh.id });
      }
    }

    // 11. end check: no_flames, then all_lit (even on the dawn tick), then dawn
    this.tick = T;
    const left = this.timeLeft;
    if (p.flames <= 0) {
      this.state = "lost";
      emit("game_over", { result: "lost", reason: "no_flames" });
    } else if (this.lanterns.every((l) => l.lit)) {
      this.state = "won";
      this.score += Math.floor(left + 1e-9) * TUNING.score.per_second_left + Math.max(0, p.flames) * TUNING.score.per_flame_left;
      emit("game_over", { result: "won", reason: "all_lit" });
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
      drifters: this.drifters.map((d) => ({ id: d.id, pos: v(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    };
  }
}
