# Requested Agent Replay Suite (v0)

A runnable, deterministic CI gate for “regulated agent” behavior.

## Quickstart

```bash
npm install
npm run ci
```

Expected:
- RG-01 PASS
- RG-04 PASS
- RG-07 PASS

A report is written to:
- `replay-suite/v0/reports/latest.json`

Runtime:
- Node.js 18+

## Candidate mode

If you have real candidate outputs (same schema as fixtures), run:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./path/to/candidates.json
```

You can also try the included example (`candidates.example.json`):

```bash
npm run ci:candidates
```

## Folder layout

- `replay-suite/v0/` – suite definitions + config + fixtures
- `replay-suite/v0/lib/` – evaluator + deterministic fixture judge (ESM)
- `tools/run-ci-gate.mjs` – runner wiring + report emission
- `docs/` – candidate schema + notes
- `candidates.example.json` – top-level example payload for `--mode candidates`
