// Headless entry (Test Contract v1.0): load + validate scenario/inputs (exit 2 on bad files) -> run sim steps -> JSONL.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BadFileError, InputTimeline, parseInputs, parseScenario } from "../sim/files";
import { Sim } from "../sim/sim";
import { r3 } from "../sim/rng";

export class UsageError extends Error {}

export interface Args {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  scenario?: string;
  inputs?: string;
  snapshotEvery: number;
}

export function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!;
    if (!k.startsWith("--")) throw new UsageError(`unexpected argument: ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`missing value for ${k}`);
    m.set(k.slice(2), v);
    i++;
  }
  const int = (name: string, def?: number): number => {
    const raw = m.get(name);
    if (raw === undefined) {
      if (def === undefined) throw new UsageError(`--${name} is required`);
      return def;
    }
    if (!/^-?\d+$/.test(raw)) throw new UsageError(`--${name} must be an integer`);
    return Number(raw);
  };
  const out = m.get("out");
  if (!out) throw new UsageError("--out is required");
  const args: Args = {
    seed: int("seed"),
    night: int("night"),
    ticks: int("ticks"),
    out,
    scenario: m.get("scenario"),
    inputs: m.get("inputs"),
    snapshotEvery: int("snapshot-every", 10),
  };
  if (args.night !== 1) throw new UsageError("only --night 1 is supported");
  if (args.ticks < 0 || args.snapshotEvery <= 0) throw new UsageError("--ticks must be >= 0 and --snapshot-every > 0");
  return args;
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new BadFileError(`cannot read ${what} file ${path}: ${(e as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new BadFileError(`${what} file ${path} is not valid JSON: ${(e as Error).message}`);
  }
}

export function run(args: Args): string {
  const scenario = args.scenario ? parseScenario(readJson(args.scenario, "scenario")) : {};
  const frames = args.inputs ? parseInputs(readJson(args.inputs, "inputs")) : [];
  const sim = new Sim(args.seed, scenario);
  const timeline = new InputTimeline(frames);
  const lines: string[] = [JSON.stringify(sim.snapshot())];
  for (let k = 0; k < args.ticks && sim.state === "playing"; k++) {
    for (const e of sim.step(timeline.at(k))) lines.push(JSON.stringify(e));
    if (sim.tick % args.snapshotEvery === 0) lines.push(JSON.stringify(sim.snapshot()));
  }
  lines.push(JSON.stringify({ type: "end", ticks: sim.tick, state: sim.state, score: r3(sim.score) }));
  return lines.join("\n") + "\n";
}

function main(): void {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(1);
  }
  try {
    const text = run(args);
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, text);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(e instanceof BadFileError ? 2 : 1);
  }
}

main();
