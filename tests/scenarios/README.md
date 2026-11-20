# Headless scenarios (data-driven)

Each folder is one acceptance check. It is run by `tests/scenarios.test.ts` through the real CLI (`dist/headless.js`). Run them all with `npm run verify`.

```
tests/scenarios/p1-pickup-boundary/
  expect.json     required
  scenario.json   optional → passed as --scenario
  inputs.json     optional → passed as --inputs
```

## expect.json
```jsonc
{
  "requirement": "P1-03 pickup within pickup_radius (<=)",
  "seed": 1,
  "ticks": 120,
  "snapshot_every": 10,
  "exit_code": 0,
  "stderr_match": "regex",
  "end": { "state": "playing" },
  "snapshots": [ { "tick": 0, "player": { "carried": 0 } } ],
  "events": [ { "name": "mote_picked", "tick": 31, "data": { "carried": 1 } } ],
  "absent_events": ["player_hit"],
  "absent_snapshots": [1],
  "deterministic": true
}
```

Field notes:
- `requirement`: the acceptance-criterion ID from `docs/notes/assumptions.md`.
- `snapshot_every`: optional. Defaults to the CLI default.
- `exit_code`: optional, default 0. Use 2 for malformed-file cases.
- `stderr_match`: optional. A regex the stderr must match.
- `end`: a partial match on the `end` line.
- `snapshots`: each entry is a partial match against the snapshot with the same tick.
- `events`: an ordered subsequence, each entry a partial match. `tick` and `data` are optional.
- `absent_events`: these event names must never appear.
- `absent_snapshots`: ticks that must NOT have a snapshot (e.g. the game ends off the `--snapshot-every` schedule).
- Every scenario also checks, without being asked, that no event of tick T appears after tick T's snapshot.
- `deterministic`: optional, default true. The scenario is run twice and the two outputs must be byte-identical.
- `night`: optional, default 1. Passed as `--night`.
- `pending`: optional reason string. The scenario is skipped and listed as `PENDING` in every run. Phase kickoffs write
  scenarios before the code exists; remove the flag when the feature is built. **`/phase release` requires zero pending.**
- `{"$range": [lo, hi]}` in place of a number: matches lo ≤ x ≤ hi. Use only where the spec fixes a bound, not a value
  (e.g. "lands on island B" → x in [42, 98]).

Partial match means:
- Objects match on the listed keys only.
- Arrays must have the same length, and each element is a partial match.
- Numbers must be equal exactly. Output is already rounded to 3 decimals.

## Rules
- Expected values come from the spec, the tuning and arithmetic. Show the arithmetic in `requirement` when it isn't obvious, e.g. "6 m/s × 0.5 s = 3.0".
- Never paste program output in as the expectation.
- When a later ticket replaces a rule, edit or delete the folder and log why in `docs/notes/changes.md`.
- Name folders `p{phase}-{topic}` so the regression scope of each phase is visible.
