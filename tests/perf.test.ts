// P2-19: a full headless night must finish in <= 30 s. v1.2: the longest night is Night 3 = 300 s = 18,000 ticks (21,600 before).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HEADLESS = join(__dirname, "..", "dist/headless.js");

describe("performance", () => {
  it("runs a full Night 3 (18,000 ticks) in under 30 s", () => {
    const dir = mkdtempSync(join(tmpdir(), "ddl-perf-"));
    const scenario = join(dir, "scenario.json");
    writeFileSync(scenario, JSON.stringify({ player: { flames: 999 } })); // survive all shades so the whole night is simulated
    const out = join(dir, "out.jsonl");
    const t0 = performance.now();
    const r = spawnSync("node", [HEADLESS, "--seed", "1", "--night", "3", "--ticks", "18000", "--scenario", scenario, "--out", out], { encoding: "utf8" });
    const secs = (performance.now() - t0) / 1000;
    expect(r.status, r.stderr).toBe(0);
    const last = JSON.parse(readFileSync(out, "utf8").trim().split("\n").at(-1)!);
    expect(last).toMatchObject({ type: "end", ticks: 18000, state: "lost" }); // dawn, nobody lit anything
    console.log(`Night 3, 18000 ticks: ${secs.toFixed(2)} s`);
    expect(secs).toBeLessThan(30);
  }, 60000);
});
