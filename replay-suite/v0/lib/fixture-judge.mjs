import { evaluateCandidate } from "./evaluator.mjs";

export function pickBestCandidate({ candidates, scenario, config, tieBreak = "candidate_id" }) {
  const evaluated = candidates.map((c, inputOrder) => ({
    ...evaluateCandidate({ scenario, candidate: c, config }),
    _input_order: inputOrder
  }));

  evaluated.sort((a, b) => {
    // PASS first
    if (a.pass !== b.pass) return a.pass ? -1 : 1;
    // higher overall score next
    if (b.scores.overall !== a.scores.overall) return b.scores.overall - a.scores.overall;
    // replay mode can use input-order ties after shuffle
    if (tieBreak === "input_order") return a._input_order - b._input_order;
    // default stable tie-break
    return String(a.candidate_id).localeCompare(String(b.candidate_id));
  });

  const ranked = evaluated.map(({ _input_order, ...candidate }) => candidate);
  const best = ranked[0] ?? null;
  return { best, evaluated: ranked };
}
