# Requested Agent Replay Suite (v0)
[![Trust Signal](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml/badge.svg)](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml)

A runnable, deterministic CI gate for “regulated agent” behavior.

## Quickstart

```bash
npm install
npm run ci
```

Expected:
- RG-01 PASS
- RG-02 PASS
- RG-03 PASS
- RG-04 PASS
- RG-07 PASS

A report is written to:
- `replay-suite/v0/reports/latest.json`

Runtime:
- Node.js 18+

## Versioning

This project uses semantic version tags (`vMAJOR.MINOR.PATCH`) for release snapshots of the harness and fixtures. The current release tag is `v0.1.0` for the first public trust-signal baseline.

## Candidate mode

If you have real candidate outputs (same schema as fixtures), run:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./path/to/candidates.json
```

You can also try the included example (`candidates.example.json`):

```bash
npm run ci:candidates
```

Replay stress run (candidate-order shuffle, 25 replays):

```bash
npm run ci:replays
```

CI workflow:
- `.github/workflows/trust-signal.yml` runs `npm ci`, `npm run ci`, `npm run ci:candidates`, and `npm run ci:replays` on push and pull requests.

Scenario tiers:
- `replay-suite/v0/ci-gate.json` is the stop-the-world gate (small, stable must-pass set).
- `replay-suite/v0/suite.json` is the extended governance battery (includes RG-05 and RG-06).

## Folder layout

- `replay-suite/v0/` – suite definitions + config + fixtures
- `replay-suite/v0/suite.json` – extended scenario battery definitions
- `replay-suite/v0/lib/` – evaluator + deterministic fixture judge (ESM)
- `tools/run-ci-gate.mjs` – runner wiring + report emission
- `docs/` – candidate schema + notes
- `docs/scenario-paper-map.md` – suggested mapping from scenarios to paper sections
- `candidates.example.json` – top-level example payload for `--mode candidates`
