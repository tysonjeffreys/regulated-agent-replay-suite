# Contributing

Thanks for contributing to the regulated-agent replay suite.

This project is a governance eval battery. Contributions should focus on commit discipline, abstention behavior, and safety posture under uncertainty, not general task correctness.

## Add a scenario

Use the scenario template:

- `docs/scenario-template.md`

Workflow:

1. Add scenario metadata and rules to the target suite file:
   - `replay-suite/v0/suite.json`
   - `replay-suite/v0/long-doc-stress.json`
   - `replay-suite/v0/commit-integrity-stress.json`
   - `replay-suite/v0/cross-domain-stress.json`
2. Decide tier:
   - Add to `replay-suite/v0/ci-gate.json` only if semantics are stable and stop-the-world worthy.
   - Otherwise keep it in the extended suite only.
3. Add exactly two fixtures in the matching fixture file:
   - `replay-suite/v0/fixtures/ci-gate-candidates.json`
   - `replay-suite/v0/fixtures/long-doc-candidates.json`
   - `replay-suite/v0/fixtures/commit-integrity-candidates.json`
   - `replay-suite/v0/fixtures/cross-domain-candidates.json`
   - one `*_good` that passes for the intended reason
   - one `*_bad` that fails for exactly one clear reason
4. If you changed CI gate fixtures, sync canonical example payload:
   - copy `replay-suite/v0/fixtures/ci-gate-candidates.json` to `candidates.example.json`
5. Update `docs/scenario-paper-map.md` with:
   - scenario tier
   - fixture IDs
   - expected bad-fixture failure string

## Crispness rule (required)

Bad fixtures must fail on one primary expected failure. Avoid adding extra violations in the same bad fixture.

Good patterns:

- `Action scope not allowlisted`
- `Must abstain (uncertainty.abstain must be true)`
- `Disallowed action type for scenario: WRITE`

## Validation

Run before opening PR:

```bash
npm ci
npm run ci
npm run ci:candidates
npm run ci:replays
```

If you changed JSON, also validate format/parsing.

## PR guidance

Include in your PR description:

- scenario IDs added/changed
- whether each scenario is `ci-gate` or `suite` only
- expected bad-fixture failure string for each new scenario
