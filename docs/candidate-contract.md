# Candidate Contract (v0)

This harness evaluates candidate outputs per scenario and selects one best candidate per scenario.

## CLI usage

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./candidates.json
```

Run against a non-default suite definition:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --suite ./replay-suite/v0/long-doc-stress.json --candidates ./replay-suite/v0/fixtures/long-doc-candidates.json
```

Commit-integrity stress run:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --suite ./replay-suite/v0/commit-integrity-stress.json --candidates ./replay-suite/v0/fixtures/commit-integrity-candidates.json
```

Cross-domain integration stress run:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --suite ./replay-suite/v0/cross-domain-stress.json --candidates ./replay-suite/v0/fixtures/cross-domain-candidates.json
```

Included example:

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./candidates.example.json
```

Replay run (candidate-order shuffle):

```bash
node ./tools/run-ci-gate.mjs --mode candidates --candidates ./candidates.example.json --replays 25
```

## Accepted file shapes

The candidates file can be either:

1. Envelope object:

```json
{
  "suite_version": "v0",
  "generated_at": "2026-02-12T11:38:28.125276Z",
  "candidates": [
    {
      "id": "cand_rg01_good",
      "scenario_id": "RG-01",
      "output": {}
    }
  ]
}
```

Optional envelope metadata:

- include `reproducibility` object when available
- schema and recommended fields are defined in `docs/reproducibility-contract.md`

2. Raw array:

```json
[
  {
    "id": "cand_rg01_good",
    "scenario_id": "RG-01",
    "output": {}
  }
]
```

## Candidate entry contract

Canonical entry:

```json
{
  "id": "candidate_id",
  "scenario_id": "RG-01",
  "output": {}
}
```

Rules:

- `id`:
  - optional but strongly recommended
  - if missing, harness auto-generates `candidate_<index>`
  - must be unique within the file
- `scenario_id`:
  - required either at top-level (`scenario_id`) or in `output.scenario_id`
  - should match a scenario in `replay-suite/v0/suite.json`
  - note: `npm run ci` / `npm run ci:candidates` enforce only `replay-suite/v0/ci-gate.json` must-pass subset
- `output`:
  - required object for canonical entries
  - harness also accepts a raw output object as an entry (no wrapper), as long as it includes `scenario_id`

## Output requirements and scoring

Required fields and scoring config:

- `replay-suite/v0/evaluator-config.json`
  - `required_fields`
  - `weights`
  - global thresholds
- `replay-suite/v0/ci-gate.json`
  - scenario-specific `expect` rules
  - `must_pass` scenario list
- `replay-suite/v0/suite.json`
  - full scenario battery (including extended non-gating scenarios)
- `replay-suite/v0/long-doc-stress.json`
  - retrieval stress battery (scope resolution, causal dependency checks, entity disambiguation)
- `replay-suite/v0/commit-integrity-stress.json`
  - commitment-integrity battery (no silent reversion, no self-disowning, conflict-of-interest posture tightening)
- `replay-suite/v0/cross-domain-stress.json`
  - optional cross-domain integration battery (false-unification resistance, scoped provenance discipline)

Current scoring dimensions are:

- `A`: action discipline
- `T`: trace quality
- `M`: uncertainty discipline
- `S`: safety
- `G`: optional retrieval/integration gate signal (bridge evidence + falsifier presence + scope penalty)

By default, `G` is neutral and non-participating (`retrieval_gate_signal.enabled=false`, `weights.G=0`).

The harness applies hard failures first (schema + scenario expectations), then applies minimum overall score threshold when hard failures are absent.

## Report output

The run writes:

- `replay-suite/v0/reports/latest.json`

Report includes:

- run mode
- selected suite path + suite version
- candidate file path + candidate count
- best and evaluated candidates per must-pass scenario
  - includes `scores.G` and `signals.retrieval_gate` telemetry when present
- reproducibility manifest:
  - `reproducibility_contract.mode`
  - `reproducibility_contract.manifest`
  - `reproducibility_contract.selection_outcomes`
  - `reproducibility_contract.posture_transitions`
- replay fields:
  - `replays_requested`
  - `replays_ran`
  - `replay_winners` (winner id per replay)
  - `winner_histogram` (winner id -> count)
  - `volatility` (`1 - max_winner_count / replays_ran`)
  - `pass_rate` (fraction of replay winners that pass)
  - `abstain_distribution` (winner abstain true/false counts)
  - `tie_distribution` (winner tie-mass high/low/missing counts)
- final suite pass/fail

Long-doc stress expectations currently use these scenario-level flags:

- `require_scope_resolved`
- `require_causal_dependency_checked`
- `require_entity_disambiguation`

Commit-integrity stress expectations currently use these scenario-level flags:

- `require_no_silent_reversion`
- `forbid_self_disowning_reasoning`
- `require_conflict_posture_tightening`

Cross-domain integration stress expectations currently use these scenario-level flags:

- `require_scope_statement`
- `require_provenance_split`
- `require_bridge_evidence`
- `require_bridge_evidence_min`
- `require_abstain_on_weak_bridge`
