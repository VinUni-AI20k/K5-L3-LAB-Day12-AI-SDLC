// Ticket-04 section 2: soak. Expected values are derived from the ticket, not from program output.
import { describe, expect, it } from "vitest";
import { makeSoakInputs, runSoak } from "../src/soak/run";

describe("soak input generator", () => {
  it("keeps one unit move direction for each 30-tick block and is reproducible", () => {
    const a = makeSoakInputs(7);
    const first = a(0);
    // ticks 0..29 share the block's direction (the ticket picks a new one every 30 ticks)
    for (let t = 1; t < 30; t++) expect(a(t).move).toEqual(first.move);
    // a unit vector: |move| = 1 (cos^2 + sin^2)
    expect(Math.hypot(first.move[0], first.move[1])).toBeCloseTo(1, 12);
    // the same seed gives the same inputs, tick by tick
    const c = makeSoakInputs(7);
    const d = makeSoakInputs(7);
    for (let t = 0; t < 100; t++) expect(c(t)).toEqual(d(t));
  });

  it("presses buttons with the ticket's rates: 5% jump, 3% dash, 2% pulse, 10% interact (within 4 sigma over 20000 ticks)", () => {
    const g = makeSoakInputs(11);
    const n = 20000;
    const count = { jump: 0, dash: 0, pulse: 0, interact: 0 };
    for (let t = 0; t < n; t++) {
      const i = g(t);
      if (i.jump) count.jump++;
      if (i.dash) count.dash++;
      if (i.pulse) count.pulse++;
      if (i.interact) count.interact++;
    }
    const check = (got: number, p: number) => {
      const sigma = Math.sqrt(n * p * (1 - p));
      expect(Math.abs(got - n * p)).toBeLessThan(4 * sigma);
    };
    check(count.jump, 0.05);
    check(count.dash, 0.03);
    check(count.pulse, 0.02);
    check(count.interact, 0.1);
  });
});

describe("runSoak", () => {
  it("a 2-night run has the right shape: night 1 then 2, seeds 7 and 8, no crashes", () => {
    const r = runSoak({ seed: 7, nights: 2 });
    expect(r.nights).toBe(2);
    expect(r.crashes).toBe(0);
    expect(r.results).toHaveLength(2);
    expect(r.results.map((x) => x.night)).toEqual([1, 2]); // rotation 1 -> 2 -> 3
    expect(r.results.map((x) => x.seed)).toEqual([7, 8]); // night i uses seed 7 + i
    // standard lengths: 240 s and 270 s at 60 ticks/s
    expect(r.results[0]!.ticks).toBeLessThanOrEqual(14400);
    expect(r.results[1]!.ticks).toBeLessThanOrEqual(16200);
    for (const x of r.results) expect(["won", "lost", "playing"]).toContain(x.state);
    expect(typeof r.mem_start_mb).toBe("number");
    expect(typeof r.mem_end_mb).toBe("number");
    expect(r.duration_s).toBeGreaterThan(0);
  }, 60000);

  it("gives the same results twice with the same seed", () => {
    const a = runSoak({ seed: 7, nights: 2 });
    const b = runSoak({ seed: 7, nights: 2 });
    expect(b.results).toEqual(a.results);
  }, 60000);

  it("rotates 1, 2, 3, 1 over four nights", () => {
    const r = runSoak({ seed: 7, nights: 4 });
    expect(r.results.map((x) => x.night)).toEqual([1, 2, 3, 1]);
  }, 120000);
});
