// The standard bench scene (Ticket-04 section 1): Night 1, 200 wander shades spread over the island, 100 motes, L1-L3 lit at fuel 100.
// Built with the `bench` option of Sim, which no scenario file or CLI flag can set, so headless output is unaffected.
import { Sim } from "../sim/sim";

export function createBenchSim(seed: number): Sim {
  return new Sim(
    seed,
    {
      random_motes: false, motes: [], random_shades: false, shades: [], random_drifters: false, drifters: [], wind_enabled: false,
      lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true }], // fuel defaults to 100
    },
    1,
    { bench: true },
  );
}

/** Camera position at t seconds: a circle of radius 30 m at Y 15 around the origin, counter-clockwise from above, one lap per 15 s, starting at (30,15,0). */
export function benchCamera(t: number): [number, number, number] {
  const a = (2 * Math.PI * t) / 15;
  return [30 * Math.cos(a), 15, 30 * Math.sin(a)];
}
