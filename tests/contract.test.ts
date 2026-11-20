import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TUNING } from "../src/sim/config";

const root = join(__dirname, "..");
const contract = JSON.parse(readFileSync(join(root, "game.contract.json"), "utf8"));
const HEADLESS = join(root, "dist/headless.js"); // built by `npm run build:headless` (part of `npm run verify`)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("contract hygiene", () => {
  it("game.contract.json tuning matches src/sim/config.ts", () => {
    expect(contract.contract_version).toBe("1.3");
    expect(contract.tuning).toEqual(TUNING);
  });

  it("v1.3 has the bench and soak commands and keeps the earlier ones", () => {
    expect(contract.bench_cmd).toBe("npx electron . --bench");
    expect(contract.soak_cmd).toBe("node dist/soak.js");
    expect(contract.run_cmd).toBe("npx electron .");
    expect(contract.headless_cmd).toBe("node dist/headless.js");
    expect(contract.build_cmd).toBe("npm ci && npm run build");
  });

  it("v1.2 tuning has the standard numbers and the new keys", () => {
    const t = contract.tuning;
    for (const k of ["dash_speed", "dash_duration_s", "dash_cooldown_s", "night2_duration_s", "night3_duration_s", "fuel_max", "fuel_decay_per_s", "fuel_per_mote", "relight_cost", "win_ratio", "drain_per_s", "low_fuel_threshold", "capacity_max"]) expect(t, k).toHaveProperty(k);
    expect(t).toMatchObject({
      player_speed: 6, carry_capacity: 10, lantern_cost: 10, fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
      pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, flames: 3,
      invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
      shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
      score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 },
    });
  });

  it("src/sim uses no nondeterministic or rendering APIs", () => {
    for (const f of walk(join(root, "src/sim"))) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|from ["']three["']/);
    }
  });
});

describe("headless CLI", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-"));
  const run = (args: string[]) => spawnSync("node", [HEADLESS, ...args], { encoding: "utf8" });

  it("writes JSONL whose last line is an end record", () => {
    const out = join(dir, "a.jsonl");
    const r = run(["--seed", "1", "--night", "1", "--ticks", "60", "--out", out]);
    expect(r.status, r.stderr).toBe(0);
    const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0]).toMatchObject({ type: "snapshot", tick: 0 });
    expect(lines.at(-1)).toMatchObject({ type: "end" });
  });

  it("is byte-identical across two runs with the same args", () => {
    const a = join(dir, "d1.jsonl");
    const b = join(dir, "d2.jsonl");
    execFileSync("node", [HEADLESS, "--seed", "7", "--night", "1", "--ticks", "600", "--out", a]);
    execFileSync("node", [HEADLESS, "--seed", "7", "--night", "1", "--ticks", "600", "--out", b]);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
  });

  it("rejects missing required args with non-zero exit and stderr", () => {
    const r = run(["--seed", "1"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/error/);
  });
});
