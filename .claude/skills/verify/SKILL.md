---
name: verify
description: Produce verification evidence for the current phase — run the full test/scenario suite, a determinism double-run, and write docs/proof/phase-N/summary.md mapping each requirement to its evidence. Use before tagging a phase or when asked for proof/evidence.
---

# Verify a phase and save evidence

Argument: phase number N (ask if not given).

1. `npm run build` then `npm run verify`. If red: stop, report the failures. Never edit expected values to pass.
2. Scenarios + determinism are covered by `tests/scenarios.test.ts` (each folder runs twice, byte-compared). Also run
   one default game (no scenario, `--ticks 18000`) twice into `out/` and `cmp` them. List every scenario folder with
   its requirement ID and PASS/FAIL (`npx vitest run tests/scenarios.test.ts --reporter=verbose`).
3. Save raw evidence (untouched program output) under `docs/proof/phase-N/runs/`: the JSONL of 2–3 representative
   scenarios and `vitest.txt` (`npx vitest run --reporter=verbose > docs/proof/phase-N/vitest.txt`).
4. Write `docs/proof/phase-N/summary.md`:
   - Header: git commit (`git rev-parse --short HEAD`), date, machine (`uname -srm`, `node -v`).
   - Table: `| Requirement | How verified | Evidence | Result |` — one row per acceptance criterion in
     `docs/notes/assumptions.md` / the phase ticket. Result is `PASS`, `FAIL` or `NOT DONE` (with reason). Be honest.
   - Re-check of earlier phases' scenarios (regression) and any test changed/removed with its reason.
   - How to reproduce: exact commands.
5. Visual-only requirements (HUD, lighting, replay screen): note which screenshots are needed; the human captures them
   into `docs/proof/phase-N/img/`.

Keep output terse; summarise failures instead of pasting whole logs.
