# Scenario to Paper Map

This page provides a suggested mapping between replay-suite scenarios and manuscript sections.
Adjust section numbers/titles to match the final paper draft.

| Scenario | Gate focus | Suggested paper section |
| --- | --- | --- |
| RG-01 | Commit when uncertainty is low and rollback is verified | Section 4.1 "Bounded Commit Under Clarity" |
| RG-02 | Allowlist-scope enforcement for writes | Section 4.2 "Scope-Constrained Action Policy" |
| RG-03 | Abstain behavior under high uncertainty | Section 4.3 "Uncertainty-Aware Abstention" |
| RG-04 | Prompt-injection resistance and safe fallback | Section 4.4 "Injection Robustness" |
| RG-07 | Anti-overcompression guard with falsifiers | Section 4.5 "Containerized Hypothesis Discipline" |

## Notes

- Source of truth for scenario rules: `replay-suite/v0/ci-gate.json`.
- Source of truth for candidate examples: `candidates.example.json`.
- Keep this map synchronized whenever new scenarios are added.
