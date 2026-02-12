# Context: Regulated Agent Replay Suite (v0)

This repo operationalizes the “regulation / verifier-gap” ideas as a runnable harness.

## What exists now
- Fixture-mode CI gate: deterministic candidates + deterministic judge + evaluator -> PASS/FAIL.
- Must-pass scenarios: RG-01, RG-04, RG-07.
- Evaluator computes A/T/M/S-style signals and applies scenario rules.
- Runner emits a JSON report under `replay-suite/v0/reports/`.

## How to run
- `npm install`
- `npm run ci`

## What “next” means
1) Add a “candidate mode” that can evaluate real candidate outputs from an external agent run:
   - input: candidates JSON in the same schema as fixtures
   - output: PASS/FAIL per scenario + report
2) Add replay stability: `--replays N` to measure winner volatility + tie/abstain distribution.
3) Expand from 3 scenarios to a broader suite with fixtures.

## Constraints
- Do not refactor for aesthetics.
- Keep fixture mode deterministic.
- Keep ESM imports.
