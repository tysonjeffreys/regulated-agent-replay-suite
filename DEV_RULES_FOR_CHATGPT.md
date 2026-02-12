# DEV_RULES_FOR_CHATGPT

## Prime directive
- Prefer stability and continuity over refactors.
- Do not remove or alter existing functionality unless explicitly requested.

## Code style
- Use ECMAScript Modules (ESM): `import` / `export`.
- Keep changes minimal and additive where possible.

## Harness expectations
- Fixture mode must remain deterministic.
- `npm run ci` must remain green after changes.
- Do not change scenario semantics or thresholds silently; document changes.

## Testing discipline
- Always run:
  - `npm install` (if deps changed)
  - `npm run ci`
- If adding a new mode/flag, add a README snippet showing how to run it.

## Docs
- If you introduce a new JSON contract, add a doc under `docs/` and an example file.
