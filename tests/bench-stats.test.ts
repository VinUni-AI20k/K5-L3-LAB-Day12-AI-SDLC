// Ticket-04 section 1: bench statistics. Every expected value is computed by hand from the ticket's definitions.
import { describe, expect, it } from "vitest";
import { benchStats } from "../src/bench/stats";

describe("benchStats", () => {
  it("N=4, dt 10,10,10,40 ms: avg = 1000*4/70 = 57.143, p1-low with k=max(1,ceil(0.04))=1 -> 1000/40 = 25, p95 (nearest rank 4) = 40", () => {
    const s = benchStats([10, 10, 10, 40]);
    expect(s.frames).toBe(4);
    expect(s.avg_fps).toBeCloseTo(57.143, 3);
    expect(s.p1_low_fps).toBe(25);
    expect(s.frame_ms_p95).toBe(40);
  });

  it("N=100: 99 frames of 10 ms and one of 110 ms: sum 1100, avg = 100000/1100 = 90.909, k=ceil(1)=1 -> 1000/110 = 9.091, p95 = rank 95 = 10", () => {
    const dts = [...Array(99).fill(10), 110];
    const s = benchStats(dts);
    expect(s.frames).toBe(100);
    expect(s.avg_fps).toBeCloseTo(90.909, 3);
    expect(s.p1_low_fps).toBeCloseTo(9.091, 3);
    expect(s.frame_ms_p95).toBe(10);
  });

  it("N=200: 198 frames of 10 ms plus 30 and 50: sum 2060, avg = 200000/2060 = 97.087, k=ceil(2)=2 -> mean(50,30)=40 -> 25, p95 = rank 190 = 10", () => {
    const dts = [...Array(198).fill(10), 50, 30]; // order must not matter
    const s = benchStats(dts);
    expect(s.avg_fps).toBeCloseTo(97.087, 3);
    expect(s.p1_low_fps).toBe(25);
    expect(s.frame_ms_p95).toBe(10);
  });

  it("N=1 (k = max(1, ceil(0.01)) = 1): one frame of 20 ms -> 50 fps, p1-low 50, p95 20", () => {
    const s = benchStats([20]);
    expect(s.avg_fps).toBe(50);
    expect(s.p1_low_fps).toBe(50);
    expect(s.frame_ms_p95).toBe(20);
  });

  it("does not modify its input and rejects an empty list", () => {
    const dts = [30, 10, 20];
    benchStats(dts);
    expect(dts).toEqual([30, 10, 20]);
    expect(() => benchStats([])).toThrow();
  });
});
