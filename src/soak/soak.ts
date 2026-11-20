// CLI: node dist/soak.js --seed 7 --nights 10 --out soak.json   (headless, one process)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setFlagsFromString } from "node:v8";
import { runSoak } from "./run";

// V8's optimizing compiler (TurboFan) allocates tens of MB of native memory while the sim code gets hot. That growth is warm-up, not game memory,
// and it would drown the leak check. Turning it off before the sim runs makes RSS reflect what the game itself holds (see docs/notes/assumptions.md).
setFlagsFromString("--no-opt");

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined || v.startsWith("--")) {
    if (def !== undefined) return def;
    process.stderr.write(`error: --${name} is required\n`);
    process.exit(1);
  }
  return v;
}

const seed = Number(arg("seed", "7"));
const nights = Number(arg("nights", "10"));
const out = arg("out");
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write("error: --seed and --nights must be integers (nights >= 1)\n");
  process.exit(1);
}
const result = runSoak({ seed, nights });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
process.exit(result.crashes === 0 ? 0 : 1);
