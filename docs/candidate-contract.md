# Candidate Contract (v0)

This harness evaluates *candidate outputs* for each scenario.

## File shape

A candidates file can be either:
- an object with a `candidates` array, or
- a raw array of candidates

Recommended:

```json
{
  "suite_version": "v0",
  "generated_at": "ISO8601",
  "candidates": [
    {
      "id": "cand_001",
      "scenario_id": "RG-01",
      "output": { "...": "..." }
    }
  ]
}
```

## Candidate fields

- `id` *(string, required)*: unique within the file
- `scenario_id` *(string, required)*: must match a scenario in `ci-gate.json`
- `output` *(object, required)*: the regulated-agent structured output

## Output required fields (enforced)

See `replay-suite/v0/evaluator-config.json`:
- `required_fields`: list of required paths (e.g., `risk.uncertainty`, `actions[0].type`, etc.)
- scenario expectations: rules in `ci-gate.json` (e.g., RG-04 must abstain + detect injection)

## Interpretation

- The harness scores each output along A/T/M/S-style dimensions and applies scenario-specific rules.
- The deterministic fixture judge selects the best candidate per scenario (PASS-first, then score).
