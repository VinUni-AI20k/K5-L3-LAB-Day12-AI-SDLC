// Ticket-04 section 1: the bench scene. Expected counts and flags come from the ticket.
import { describe, expect, it } from "vitest";
import { parseScenario } from "../src/sim/files";
import { createBenchSim } from "../src/bench/scene";
import { IDLE_INPUT } from "../src/sim/files";

describe("bench scene", () => {
  const sim = createBenchSim(42);
  const start = sim.shades.map((s) => [s.pos[0], s.pos[2]]);
  it("starts with exactly 200 wander shades inside the island (r <= 40), 100 motes, L1-L3 lit at fuel 100, L4-L5 unlit", () => {
    expect(sim.shades).toHaveLength(200);
    expect(sim.shades.every((s) => s.state === "wander")).toBe(true);
    for (const [x, z] of start) expect(Math.hypot(x!, z!)).toBeLessThanOrEqual(40);
    expect(sim.motes).toHaveLength(100);
    expect(sim.lanterns.map((l) => l.lit)).toEqual([true, true, true, false, false]);
    for (const l of sim.lanterns.slice(0, 3)) expect(l.fuelU).toBe(6000); // fuel 100
    expect(sim.player.pos).toEqual([0, 0, 0]);
  });

  it("is reproducible: the same seed gives the same shade positions", () => {
    const again = createBenchSim(42);
    expect(again.shades.map((s) => s.pos)).toEqual(sim.shades.map((s) => s.pos));
  });

  it("after 600 ticks: still 200 wander shades and 100 motes, fuel unchanged, nothing picked up or hurt, night not over, shades moved", () => {
    for (let t = 0; t < 600; t++) sim.step(IDLE_INPUT);
    expect(sim.state).toBe("playing"); // end of night is off
    expect(sim.shades).toHaveLength(200); // no spawning
    expect(sim.shades.every((s) => s.state === "wander")).toBe(true);
    expect(sim.motes).toHaveLength(100); // no pickup, no respawn
    expect(sim.player.flames).toBe(3); // damage is off
    expect(sim.player.carried).toBe(0);
    for (const l of sim.lanterns.slice(0, 3)) expect(l.fuelU).toBe(6000); // no fuel decay
    const moved = sim.shades.filter((s, i) => Math.hypot(s.pos[0] - start[i]![0]!, s.pos[2] - start[i]![1]!) > 0.5).length;
    expect(moved).toBeGreaterThan(100); // normal wander rule: they walk towards the nearest unlit lantern
  });

  it("cannot be reached from a scenario file: `bench` is not parsed", () => {
    const sc = parseScenario({ bench: true, shades: [] });
    expect("bench" in sc).toBe(false);
  });
});
