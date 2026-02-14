# Reproducibility Contract (v0)

This suite treats reproducibility as an operational property, not a claim that all model outputs are identical.

## Reproducibility modes

- `R0` Replayable operations (required default):
  - same inputs + same artifacts + same version should replay to comparable outcomes and uncertainty signals
- `R1` Deterministic outputs (task-dependent):
  - same input should produce the same regulated field/label when deterministic behavior is required
- `R2` Distributional reproducibility (generative analysis):
  - outputs may vary, but tie-mass/abstention/stability metrics stay bounded and monitored

`tools/run-ci-gate.mjs` currently emits an `R0` manifest in every report.

## Report manifest fields

Each run writes `replay-suite/v0/reports/latest.json` and includes:

- `reproducibility_contract.mode`: current reproducibility mode (`R0`)
- `reproducibility_contract.manifest.runner`
  - suite name/version
  - command
  - cwd
- `reproducibility_contract.manifest.system`
  - node version
  - platform/arch/hostname
- `reproducibility_contract.manifest.inputs`
  - `ci-gate.json` path + SHA-256
  - `evaluator-config.json` path + SHA-256
  - candidates path + file SHA-256
  - normalized candidates SHA-256
  - candidate IDs
- `reproducibility_contract.manifest.scenario_selection`
  - must-pass scenario IDs used for this run
- `reproducibility_contract.selection_outcomes`
  - per-scenario winner/pass/tie-mass/abstention/volatility/pass-rate
- `reproducibility_contract.posture_transitions`
  - per-scenario winner phase/posture/trace decisions (when available)

## Optional runtime metadata from candidates payload

Candidate envelopes may include a `reproducibility` object. If present, the runner copies it into report manifest as `external_runtime_metadata`.

Recommended fields:

```json
{
  "reproducibility": {
    "model_identifier": "model-name-or-hash",
    "prompt_template_hash": "sha256:...",
    "decoding_parameters": {
      "temperature": 0,
      "top_p": 1
    },
    "tool_versions": {
      "retriever": "1.4.0"
    },
    "retrieval_snapshot_hashes": [
      "sha256:..."
    ],
    "phase_transitions": [],
    "posture_transitions": []
  }
}
```

These fields are optional in v0 but recommended for longitudinal audit and rollback safety.
