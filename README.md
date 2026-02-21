# Requested Agent Replay Suite (v0.4.0)
[![CI](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/ci.yml)
[![Trust Signal](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml/badge.svg)](https://github.com/tysonjeffreys/regulated-agent-replay-suite/actions/workflows/trust-signal.yml)

A runnable, deterministic CI harness for regulated-agent behavior.

This does not verify correctness; it verifies discipline under uncertainty: when to abstain, when commits are allowed, how injection is handled, and stability under replay.

## Coherence Requires Support

Cross-cutting invariant: coherent agent behavior is a supported regime, not a willful default.
In this harness, "support" means evidence quality, stable uncertainty telemetry (tie/abstain posture), rollback readiness, and scoped action rights.
When support is weak, expected behavior is abstain/gather/recover; commit rights are earned only when support signals are sufficient.

## Quickstart

```bash
npm ci
npm run ci
```

Expected must-pass outcomes:
- `RG-01` PASS
- `RG-02` PASS
- `RG-03` PASS
- `RG-04` PASS
- `RG-07` PASS

Report output:
- `replay-suite/v0/reports/latest.json`

Runtime:
- Node.js `>=18`

## Run Modes

Fixture mode (deterministic baseline gate):

```bash
npm run ci
```

Candidate mode (evaluate real outputs that follow the fixture schema):

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./path/to/candidates.json
```

Candidate mode with included example payload:

```bash
npm run ci:candidates
```

Replay stress run (candidate-order shuffle, 25 replays):

```bash
npm run ci:replays
```

Non-blocking ablation run (comparison-only, does not affect suite pass/fail):

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./candidates.example.json --ablate
```

Extended long-doc retrieval stress suite (scope/causal/entity failure modes):

```bash
npm run ci:longdoc
```

Extended commit-integrity stress suite (no-evidence reversion, self-disowning, incentive conflict):

```bash
npm run ci:integrity
```

Optional cross-domain integration stress suite (false unification / bridge discipline):

```bash
npm run ci:crossdomain
```

## Reproducibility and Audit

The suite treats reproducibility as an engineering contract:

- `R0` replayable operations (default requirement)
- `R1` deterministic outputs for regulated fields
- `R2` distributional reproducibility for generative analysis (stable tie/abstain signals under replay)

See `docs/reproducibility-contract.md` for required manifest fields and optional runtime metadata.

## Scenario Tiers

- `replay-suite/v0/ci-gate.json` is the stop-the-world gate (small, stable must-pass set).
- `replay-suite/v0/suite.json` is the extended governance battery (includes `RG-05` and `RG-06`).
- `replay-suite/v0/long-doc-stress.json` is an extended retrieval stress battery (`RG-08` to `RG-10`).
- `replay-suite/v0/commit-integrity-stress.json` is an extended commitment-integrity battery (`RG-11` to `RG-13`).
- `replay-suite/v0/cross-domain-stress.json` is an optional integration battery (`RG-14` to `RG-15`).

## Optional Retrieval-Gate Signal

`replay-suite/v0/evaluator-config.json` includes an optional `G` scoring channel for retrieval/integration gates:

- bridge evidence
- falsifier presence
- scope penalty

By default this signal is neutral (`retrieval_gate_signal.enabled=false`, `weights.G=0`) and does not affect existing CI outcomes.

## Experimental Report Telemetry

`replay-suite/v0/reports/latest.json` now includes `experimental.paper_v01_proxies`:

- compensation duty cycle proxy
- thrash proxy
- recovery evidence proxy
- commit regret proxy
- gating fidelity proxy

These are report-only trend metrics and do not affect pass/fail semantics.

## CI Workflows

- `.github/workflows/ci.yml` runs `npm run ci` on Node 18 and 20.
- `.github/workflows/trust-signal.yml` runs fixture, candidate, and replay gates on push and pull request events.

## Versioning

This project uses semantic version tags (`vMAJOR.MINOR.PATCH`) for release snapshots of the harness and fixtures.

Current release version:
- `v0.4.0`

Release notes:
- `RELEASE_NOTES.md`

## Contributing Scenarios

- Contribution guide: `CONTRIBUTING.md`
- Scenario authoring template: `docs/scenario-template.md`

## Repository Layout

- `replay-suite/v0/`: suite definitions, config, fixtures, reports
- `replay-suite/v0/suite.json`: extended scenario battery
- `replay-suite/v0/long-doc-stress.json`: long-doc retrieval stress scenarios
- `replay-suite/v0/commit-integrity-stress.json`: commitment-integrity stress scenarios
- `replay-suite/v0/cross-domain-stress.json`: optional cross-domain integration scenarios
- `replay-suite/v0/lib/`: evaluator and deterministic fixture judge (ESM)
- `replay-suite/v0/fixtures/long-doc-candidates.json`: focused good/bad fixtures for `RG-08` to `RG-10`
- `replay-suite/v0/fixtures/commit-integrity-candidates.json`: focused good/bad fixtures for `RG-11` to `RG-13`
- `replay-suite/v0/fixtures/cross-domain-candidates.json`: focused good/bad fixtures for `RG-14` to `RG-15`
- `tools/run-ci-gate.mjs`: runner wiring and report emission
- `docs/candidate-contract.md`: candidate payload schema and contract
- `docs/reproducibility-contract.md`: reproducibility modes and manifest schema
- `docs/scenario-paper-map.md`: suggested mapping from scenarios to paper sections
- `docs/scenario-template.md`: scenario and fixture authoring template
- `CONTRIBUTING.md`: contribution workflow and crispness checklist
- `candidates.example.json`: top-level example payload for `--mode candidates`
