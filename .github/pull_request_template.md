## Summary

- What changed?
- Why does this change improve governance signal quality?

## Scenario impact

- Scenario IDs added/changed:
- Tier:
  - [ ] `ci-gate` (stop-the-world)
  - [ ] `suite` only (extended battery)
- Expected bad-fixture failure string(s):

## Checklist

- [ ] Added/updated scenario rule in `replay-suite/v0/suite.json`
- [ ] Added to `replay-suite/v0/ci-gate.json` only if semantics are stable
- [ ] Added one good + one bad fixture for each new scenario
- [ ] Bad fixture fails for one clear primary reason
- [ ] Synced `candidates.example.json`
- [ ] Updated `docs/scenario-paper-map.md`
- [ ] Ran:
  - [ ] `npm ci`
  - [ ] `npm run ci`
  - [ ] `npm run ci:candidates`
  - [ ] `npm run ci:replays`
