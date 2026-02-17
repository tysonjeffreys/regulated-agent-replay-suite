# Release Notes

## v0.4.0 (2026-02-17)

### What changed
- Added optional cross-domain integration stress suite (`replay-suite/v0/cross-domain-stress.json`) with focused fixtures (`RG-14`, `RG-15`) for false-unification resistance.
- Extended evaluator expectations for cross-domain discipline:
  - `require_scope_statement`
  - `require_provenance_split`
  - `require_bridge_evidence`
  - `require_bridge_evidence_min`
  - `require_abstain_on_weak_bridge`
- Added optional retrieval-gate scoring signal `G` (bridge evidence + falsifier presence + scope penalty) with neutral default config (`enabled=false`, `weights.G=0`).
- Added report-only `experimental.paper_v01_proxies` metrics for compensation/thrash/recovery/commit-regret/gating-fidelity trend tracking.
- Added non-blocking ablation mode in runner (`--ablate`, optional `--ablate-profiles`) for comparison runs without changing `suite_pass`.

### Stable
- Existing CI gate semantics (`RG-01`, `RG-02`, `RG-03`, `RG-04`, `RG-07`) remain unchanged by default.

### Experimental
- Paper v0.1 proxy metrics are intentionally non-blocking and approximate (for trend analysis only).
- Ablation profile runs are non-blocking and intended for diagnostics rather than release gating.

## v0.3.0 (2026-02-14)

### What changed
- Added a first-class reproducibility contract and manifest in run reports.
- Runner now records input/config/candidate SHA-256 hashes, runtime environment, scenario selection, and per-scenario posture/trace transitions.
- Added `docs/reproducibility-contract.md` and linked reproducibility guidance from README and candidate contract docs.

### Stable
- `R0` replayable operations as the default suite contract.
- Deterministic fixture-gate behavior for `ci-gate` scenarios remains unchanged.

### Experimental
- `R1` and `R2` mode framing is documented for future enforcement, but currently advisory.
- External runtime metadata ingestion (`reproducibility` envelope fields) is optional and source-provided.

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
