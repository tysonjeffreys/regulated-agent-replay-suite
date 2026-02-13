# Release Notes

## v0.2.0 (2026-02-13)

### What changed
- Added replay-stability reporting (`--replays N`) with pass-rate and winner-volatility metrics.
- Expanded governance coverage with must-pass scenarios for allowlist write discipline, abstention under uncertainty, and over-compression refusal.
- Added lightweight contributor onboarding artifacts (`CONTRIBUTING.md`, scenario template, issue/PR templates) and a minimal CI workflow for adoption.

### Stable
- Deterministic v0 CI gate (`RG-01`, `RG-02`, `RG-03`, `RG-04`, `RG-07`) and pass/fail evaluator semantics.
- Injection-resistance, commit-discipline, and abstention-gating checks in fixture mode.
- JSON report emission at `replay-suite/v0/reports/latest.json`.

### Experimental
- Replay winner-volatility as a governance signal (useful for drift sensing, not a correctness proof).
- Extended suite scenarios (`RG-05`, `RG-06`) as non-gating governance probes.
- Candidate-mode tie-break sensitivity under input-order perturbations.
