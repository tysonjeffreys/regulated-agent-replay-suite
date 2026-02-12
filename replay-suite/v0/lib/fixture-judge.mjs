import { evaluateCandidate } from "./evaluator.mjs";

export function pickBestCandidate({ candidates, scenario, config }) {
  const evaluated = candidates.map((c) => evaluateCandidate({ scenario, candidate: c, config }));
  evaluated.sort((a, b) => {
    // PASS first
    if (a.pass !== b.pass) return a.pass ? -1 : 1;
    // higher overall score next
    if (b.scores.overall !== a.scores.overall) return b.scores.overall - a.scores.overall;
    // stable tie-break
    return String(a.candidate_id).localeCompare(String(b.candidate_id));
  });

  const best = evaluated[0] ?? null;
  return { best, evaluated };
}
