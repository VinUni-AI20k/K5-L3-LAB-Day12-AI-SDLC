// Ticket-04 section 2 pass criteria on the real command: crashes 0 and mem_end <= 1.2 x mem_start (10 nights, about 1 s).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("soak CLI (dist/soak.js)", () => {
  it("10 nights: 0 crashes and memory ratio <= 1.2, output has the ticket's fields", () => {
    const out = join(mkdtempSync(join(tmpdir(), "ddl-soak-")), "soak.json");
    const r = spawnSync("node", [join(__dirname, "..", "dist", "soak.js"), "--seed", "7", "--nights", "10", "--out", out], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    const d = JSON.parse(readFileSync(out, "utf8"));
    expect(Object.keys(d).sort()).toEqual(["crashes", "duration_s", "mem_end_mb", "mem_start_mb", "nights", "results"]);
    expect(d.nights).toBe(10);
    expect(d.results).toHaveLength(10);
    expect(d.crashes).toBe(0);
    expect(d.mem_end_mb).toBeLessThanOrEqual(1.2 * d.mem_start_mb);
  }, 60000);
});
