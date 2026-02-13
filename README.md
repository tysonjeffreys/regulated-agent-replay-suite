# Requested Agent Replay Suite (v0.2.0)
[![Trust Signal](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml/badge.svg)](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml)

A runnable, deterministic CI gate for "regulated agent" behavior.

This does not verify correctness; it verifies discipline under uncertainty: when to abstain, when commits are allowed, how injection is handled, and stability under replay.

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

This project uses semantic version tags (`vMAJOR.MINOR.PATCH`) for release snapshots of the harness and fixtures.

Current release tag: `v0.2.0`

Release notes:
- `RELEASE_NOTES.md`

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

CI workflows:
- `.github/workflows/ci.yml` runs `npm run ci` on Node 18 and 20.
- `.github/workflows/trust-signal.yml` runs fixture, candidate, and replay gates on push and PRs.

Scenario tiers:
- `replay-suite/v0/ci-gate.json` is the stop-the-world gate (small, stable must-pass set).
- `replay-suite/v0/suite.json` is the extended governance battery (includes RG-05 and RG-06).

## Contributing scenarios

- Contribution guide: `CONTRIBUTING.md`
- Scenario authoring template: `docs/scenario-template.md`

## Folder layout

- `replay-suite/v0/` - suite definitions + config + fixtures
- `replay-suite/v0/suite.json` - extended scenario battery definitions
- `replay-suite/v0/lib/` - evaluator + deterministic fixture judge (ESM)
- `tools/run-ci-gate.mjs` - runner wiring + report emission
- `docs/` - candidate schema + notes
- `docs/scenario-paper-map.md` - suggested mapping from scenarios to paper sections
- `docs/scenario-template.md` - scenario + fixture authoring template
- `CONTRIBUTING.md` - contribution workflow and crispness checklist
- `candidates.example.json` - top-level example payload for `--mode candidates`
