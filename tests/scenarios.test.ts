// Generic runner for tests/scenarios/<name>/{expect,scenario,inputs}.json — format in tests/scenarios/README.md.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(__dirname, "..");
const HEADLESS = join(root, "dist/headless.js");
const SCEN_DIR = join(__dirname, "scenarios");
const tmp = mkdtempSync(join(tmpdir(), "ddl-scn-"));

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface Expect {
  requirement: string;
  seed: number;
  ticks: number;
  snapshot_every?: number;
  exit_code?: number;
  stderr_match?: string;
  end?: Record<string, Json>;
  snapshots?: Array<{ tick: number } & Record<string, Json>>;
  events?: Array<{ name: string; tick?: number; data?: Record<string, Json> }>;
  absent_events?: string[];
  absent_snapshots?: number[];
  deterministic?: boolean;
  night?: number; // --night (default 1)
  pending?: string; // reason; the scenario is skipped until built. Release requires zero pending.
}

/**
 * Partial deep match: objects match listed keys; arrays need equal length; primitives strict-equal.
 * `{"$range": [lo, hi]}` matches a number lo <= x <= hi (use only where the spec fixes a bound, not an exact value).
 */
export function matches(actual: unknown, expected: unknown): boolean {
  if (expected !== null && typeof expected === "object" && !Array.isArray(expected) && "$range" in expected) {
    const [lo, hi] = (expected as { $range: [number, number] }).$range;
    return typeof actual === "number" && actual >= lo && actual <= hi;
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => matches(actual[i], e));
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([k, v]) => matches((actual as Record<string, unknown>)[k], v));
  }
  return Object.is(actual, expected) || actual === expected;
}

function run(dir: string, exp: Expect, outName: string) {
  const out = join(tmp, outName);
  const args = [HEADLESS, "--seed", String(exp.seed), "--night", String(exp.night ?? 1), "--ticks", String(exp.ticks), "--out", out];
  if (exp.snapshot_every !== undefined) args.push("--snapshot-every", String(exp.snapshot_every));
  for (const [flag, file] of [["--scenario", "scenario.json"], ["--inputs", "inputs.json"]] as const) {
    if (existsSync(join(dir, file))) args.push(flag, join(dir, file));
  }
  const r = spawnSync("node", args, { encoding: "utf8" });
  const text = existsSync(out) ? readFileSync(out, "utf8") : "";
  return { status: r.status, stderr: r.stderr, text };
}

const folders = existsSync(SCEN_DIR)
  ? readdirSync(SCEN_DIR).filter((f) => statSync(join(SCEN_DIR, f)).isDirectory()).sort()
  : [];
const load = (name: string) => JSON.parse(readFileSync(join(SCEN_DIR, name, "expect.json"), "utf8")) as Expect;
const pending = folders.filter((f) => load(f).pending);
const active = folders.filter((f) => !load(f).pending);

describe("headless scenarios", () => {
  // Visible in every run so a pending scenario can't be forgotten (release requires zero).
  if (pending.length) it.skip.each(pending.map((f) => [f, load(f).pending]))("PENDING %s — %s", () => {});
  it.each(active)("%s", (name) => {
    const dir = join(SCEN_DIR, name);
    const exp = load(name);
    const a = run(dir, exp, `${name}.a.jsonl`);
    const why = `[${name}] ${exp.requirement}`;

    expect(a.status, `${why}\nstderr: ${a.stderr}`).toBe(exp.exit_code ?? 0);
    if (exp.stderr_match) expect(a.stderr, why).toMatch(new RegExp(exp.stderr_match));
    if ((exp.exit_code ?? 0) !== 0) return;

    const lines = a.text.trim().split("\n").map((l) => JSON.parse(l) as Record<string, Json>);
    const last = lines.at(-1)!;
    expect(last.type, `${why}: last line must be end`).toBe("end");
    if (exp.end) expect(matches(last, exp.end), `${why}: end ${JSON.stringify(last)}`).toBe(true);

    for (const s of exp.snapshots ?? []) {
      const snap = lines.find((l) => l.type === "snapshot" && l.tick === s.tick);
      expect(snap, `${why}: no snapshot at tick ${s.tick}`).toBeDefined();
      expect(matches(snap, s), `${why}: snapshot ${s.tick}\nexpected ${JSON.stringify(s)}\nactual   ${JSON.stringify(snap)}`).toBe(true);
    }

    for (const t of exp.absent_snapshots ?? []) {
      expect(lines.some((l) => l.type === "snapshot" && l.tick === t), `${why}: unexpected snapshot at tick ${t}`).toBe(false);
    }
    // contract order: within one tick the events come before that tick's snapshot; end is last (checked above)
    lines.forEach((l, i) => {
      if (l.type !== "snapshot") return;
      const late = lines.findIndex((x, j) => j > i && x.type === "event" && x.tick === l.tick);
      expect(late, `${why}: an event of tick ${String(l.tick)} comes after that tick's snapshot`).toBe(-1);
    });

    const events = lines.filter((l) => l.type === "event");
    let from = 0;
    for (const e of exp.events ?? []) {
      const idx = events.findIndex((ev, i) => i >= from && matches(ev, e));
      expect(idx, `${why}: missing (in order) event ${JSON.stringify(e)}\nevents: ${JSON.stringify(events)}`).toBeGreaterThanOrEqual(0);
      from = idx + 1;
    }
    for (const n of exp.absent_events ?? []) {
      expect(events.some((ev) => ev.name === n), `${why}: unexpected event ${n}`).toBe(false);
    }

    if (exp.deterministic !== false) {
      const b = run(dir, exp, `${name}.b.jsonl`);
      expect(b.text === a.text, `${why}: output differs between two identical runs`).toBe(true);
    }
  });
});

describe("matches()", () => {
  it("does partial object, exact-length array and strict primitive matching", () => {
    expect(matches({ a: 1, b: { c: [1, 2] }, x: 9 }, { b: { c: [1, 2] } })).toBe(true);
    expect(matches({ c: [1, 2, 3] }, { c: [1, 2] })).toBe(false);
    expect(matches({ a: "1" }, { a: 1 })).toBe(false);
    expect(matches([{ id: "S1", s: "chase" }], [{ id: "S1" }])).toBe(true);
    expect(matches({ x: 43.2 }, { x: { $range: [42, 98] } })).toBe(true);
    expect(matches({ x: 41 }, { x: { $range: [42, 98] } })).toBe(false);
  });
});
