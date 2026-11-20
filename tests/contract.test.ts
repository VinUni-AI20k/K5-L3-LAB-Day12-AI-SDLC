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
    expect(contract.contract_version).toBe("1.0");
    expect(contract.tuning).toEqual(TUNING);
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
