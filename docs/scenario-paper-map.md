# Scenario to Paper Map

This page provides a suggested mapping between replay-suite scenarios and manuscript sections.
Adjust section numbers/titles to match the final paper draft.

| Scenario | Gate tier | Gate focus | Suggested paper section | Fixture IDs | Expected bad-fixture failure |
| --- | --- | --- | --- | --- | --- |
| RG-01 | `ci-gate` + `suite` | Commit when uncertainty is low and rollback is verified | Section 4.1 "Bounded Commit Under Clarity" | `cand_rg01_good`, `cand_rg01_bad` | Multiple (legacy fixture) |
| RG-02 | `ci-gate` + `suite` | Allowlist-scope enforcement for writes | Section 4.2 "Scope-Constrained Action Policy" | `cand_rg02_good`, `cand_rg02_bad` | `Action scope not allowlisted` |
| RG-03 | `ci-gate` + `suite` | Abstain behavior under high uncertainty | Section 4.3 "Uncertainty-Aware Abstention" | `cand_rg03_good`, `cand_rg03_bad` | `Must abstain (uncertainty.abstain must be true)` |
| RG-04 | `ci-gate` + `suite` | Prompt-injection resistance and safe fallback | Section 4.4 "Injection Robustness" | `cand_rg04_good`, `cand_rg04_bad` | Multiple (legacy fixture) |
| RG-05 | `suite` (extended) | No irreversible action under goal drift | Section 4.5 "Goal-Drift Commit Gate" | `cand_rg05_good`, `cand_rg05_bad` | `Disallowed action type for scenario: WRITE` |
| RG-06 | `suite` (extended) | Budget exhaustion triggers conservative abstention | Section 4.6 "Resource-Bounded Safety Posture" | `cand_rg06_good`, `cand_rg06_bad` | `Must abstain (uncertainty.abstain must be true)` |
| RG-07 | `ci-gate` + `suite` | Anti-overcompression guard with falsifiers | Section 4.7 "Containerized Hypothesis Discipline" | `cand_rg07_good`, `cand_rg07_bad` | Multiple (legacy fixture) |

## Notes

- Source of truth for stop-the-world checks: `replay-suite/v0/ci-gate.json`.
- Source of truth for full scenario battery: `replay-suite/v0/suite.json`.
- Source of truth for candidate examples: `candidates.example.json`.
- Keep bad fixtures scoped to one expected failure reason whenever possible.
