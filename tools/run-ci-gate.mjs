import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";

import { loadJson } from "../replay-suite/v0/lib/evaluator.mjs";
import { pickBestCandidate } from "../replay-suite/v0/lib/fixture-judge.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name, fallback = null) {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(`${flagName} must be a positive integer (got: ${value})`);
    process.exit(2);
  }
  return parsed;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

async function sha256File(filePath) {
  const raw = await fs.readFile(filePath);
  return sha256(raw);
}

function normalizeObject(value) {
  return isRecord(value) ? value : null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : null;
}

function collectEnvelopeReproducibility(loaded) {
  if (!isRecord(loaded)) return null;
  const repro = isRecord(loaded.reproducibility) ? loaded.reproducibility : loaded;

  const modelIdentifier =
    asNonEmptyString(repro.model_identifier) ??
    asNonEmptyString(repro.model_id) ??
    asNonEmptyString(loaded.model_identifier) ??
    asNonEmptyString(loaded.model_id) ??
    null;

  const promptTemplateHash =
    asNonEmptyString(repro.prompt_template_hash) ??
    asNonEmptyString(loaded.prompt_template_hash) ??
    null;

  return {
    model_identifier: modelIdentifier,
    prompt_template_hash: promptTemplateHash,
    decoding_parameters: normalizeObject(repro.decoding_parameters ?? repro.decoding),
    tool_versions: normalizeObject(repro.tool_versions),
    retrieval_snapshot_hashes: normalizeArray(repro.retrieval_snapshot_hashes),
    retrieval_snapshots: normalizeArray(repro.retrieval_snapshots),
    phase_transitions: normalizeArray(repro.phase_transitions),
    posture_transitions: normalizeArray(repro.posture_transitions)
  };
}

function emptyScenarioReproducibility() {
  return {
    candidate_ids: [],
    winner_candidate_id: null,
    winner_abstain: null,
    winner_tie_mass: null,
    phase: null,
    posture: null,
    trace_decisions: []
  };
}

function scenarioWinnerReproducibility({ candidates, winnerCandidateId }) {
  const details = emptyScenarioReproducibility();
  details.candidate_ids = candidates.map((c) => c.id);
  details.winner_candidate_id = winnerCandidateId;

  const winner = winnerCandidateId ? candidates.find((c) => c.id === winnerCandidateId) : null;
  const output = winner?.output ?? null;
  if (!isRecord(output)) return details;

  if (isRecord(output.uncertainty)) {
    details.winner_abstain = Boolean(output.uncertainty.abstain);
    details.winner_tie_mass =
      typeof output.uncertainty.tie_mass === "number" ? output.uncertainty.tie_mass : null;
  }
  details.phase = asNonEmptyString(output.phase);
  details.posture = asNonEmptyString(output.posture);
  details.trace_decisions = normalizeArray(output?.trace?.decisions) ?? [];
  return details;
}

function shuffledCopy(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function emptyReplayStats() {
  return {
    replay_winners: [],
    winner_histogram: {},
    volatility: 0,
    pass_rate: 0,
    abstain_distribution: { abstain: 0, no_abstain: 0 },
    tie_distribution: { high_tie_mass: 0, low_tie_mass: 0, missing: 0 }
  };
}

function runReplaySet({ candidates, scenario, config, mode, replaysRan }) {
  const stats = emptyReplayStats();
  if (replaysRan <= 0 || candidates.length === 0) return stats;

  let passCount = 0;
  for (let replay = 0; replay < replaysRan; replay += 1) {
    const replayCandidates =
      mode === "candidates" && replaysRan > 1 ? shuffledCopy(candidates) : [...candidates];
    const tieBreak = mode === "candidates" && replaysRan > 1 ? "input_order" : "candidate_id";

    const { best } = pickBestCandidate({ candidates: replayCandidates, scenario, config, tieBreak });
    const winnerId = best?.candidate_id ?? null;

    stats.replay_winners.push(winnerId);
    if (winnerId) {
      stats.winner_histogram[winnerId] = (stats.winner_histogram[winnerId] ?? 0) + 1;
    }
    if (best?.pass) passCount += 1;

    const winnerRecord = winnerId ? candidates.find((c) => c.id === winnerId) : null;
    if (Boolean(winnerRecord?.output?.uncertainty?.abstain)) {
      stats.abstain_distribution.abstain += 1;
    } else {
      stats.abstain_distribution.no_abstain += 1;
    }

    const tieMass = winnerRecord?.output?.uncertainty?.tie_mass;
    if (typeof tieMass !== "number") stats.tie_distribution.missing += 1;
    else if (tieMass >= 0.4) stats.tie_distribution.high_tie_mass += 1;
    else stats.tie_distribution.low_tie_mass += 1;
  }

  const maxWinnerCount = Object.values(stats.winner_histogram).reduce(
    (max, count) => (count > max ? count : max),
    0
  );

  stats.pass_rate = passCount / replaysRan;
  stats.volatility = 1 - maxWinnerCount / replaysRan;
  return stats;
}

function normalizeCandidatesPayload(loaded) {
  let source = null;
  if (Array.isArray(loaded)) source = loaded;
  if (source === null && isRecord(loaded) && Array.isArray(loaded.candidates)) {
    source = loaded.candidates;
  }

  if (!Array.isArray(source)) {
    return {
      candidates: [],
      errors: ["Candidates file must be a JSON array or an object with a candidates array."]
    };
  }

  const candidates = [];
  const errors = [];
  const seenIds = new Set();

  for (let i = 0; i < source.length; i += 1) {
    const raw = source[i];
    if (!isRecord(raw)) {
      errors.push(`candidates[${i}] must be an object.`);
      continue;
    }

    let output = null;
    if (isRecord(raw.output)) output = raw.output;
    if (output === null && raw.output === undefined && asNonEmptyString(raw.scenario_id)) output = raw;

    if (output === null) {
      errors.push(
        `candidates[${i}] must include output as an object (or be a raw output object).`
      );
      continue;
    }

    const scenarioId = asNonEmptyString(raw.scenario_id) ?? asNonEmptyString(output.scenario_id);
    if (!scenarioId) {
      errors.push(`candidates[${i}] is missing scenario_id (top-level or output.scenario_id).`);
      continue;
    }

    const candidateId = asNonEmptyString(raw.id) ?? `candidate_${i + 1}`;
    if (seenIds.has(candidateId)) {
      errors.push(`Duplicate candidate id "${candidateId}" found at candidates[${i}].`);
      continue;
    }
    seenIds.add(candidateId);

    candidates.push({
      id: candidateId,
      scenario_id: scenarioId,
      output
    });
  }

  return { candidates, errors };
}

const mode = getArg("--mode", "fixtures");
const replaysRequested = parsePositiveInteger(getArg("--replays", "1"), "--replays");
const replaysRan = mode === "fixtures" ? 1 : replaysRequested;

const suiteRoot = path.resolve(__dirname, "..", "replay-suite", "v0");
const ciGatePath = path.join(suiteRoot, "ci-gate.json");
const configPath = path.join(suiteRoot, "evaluator-config.json");
const fixturesPath = path.join(suiteRoot, "fixtures", "ci-gate-candidates.json");
const reportDir = path.join(suiteRoot, "reports");
const reportPath = path.join(reportDir, "latest.json");
const packageJsonPath = path.resolve(__dirname, "..", "package.json");

if (!["fixtures", "candidates"].includes(mode)) {
  console.error(`Supported modes: fixtures | candidates (got: ${mode})`);
  process.exit(2);
}

if (mode === "fixtures" && replaysRequested !== 1) {
  console.warn("Mode 'fixtures' is deterministic; forcing --replays to 1.");
}

const candidatesPathArg = getArg("--candidates", null);

const ciGate = await loadJson(ciGatePath);
const config = await loadJson(configPath);
const pkg = await loadJson(packageJsonPath);

let candidatesFilePath = fixturesPath;
if (mode === "candidates") {
  if (!candidatesPathArg) {
    console.error("Mode 'candidates' requires --candidates <path-to-json>.");
    process.exit(2);
  }
  candidatesFilePath = candidatesPathArg;
}

const loaded = await loadJson(candidatesFilePath);
const { candidates: allCandidates, errors: candidateErrors } = normalizeCandidatesPayload(loaded);

if (candidateErrors.length > 0) {
  console.error(`Invalid candidates payload in ${candidatesFilePath}`);
  for (const err of candidateErrors) console.error(`  - ${err}`);
  process.exit(2);
}

const inputSuiteVersion = isRecord(loaded) ? asNonEmptyString(loaded.suite_version) : null;
if (inputSuiteVersion && inputSuiteVersion !== ciGate.suite_version) {
  console.warn(
    `Warning: candidates suite_version "${inputSuiteVersion}" does not match gate suite_version "${ciGate.suite_version}".`
  );
}

const envelopeReproducibility = collectEnvelopeReproducibility(loaded);
const [ciGateSha256, evaluatorConfigSha256, candidatesFileSha256] = await Promise.all([
  sha256File(ciGatePath),
  sha256File(configPath),
  sha256File(candidatesFilePath)
]);
const candidatesNormalizedSha256 = sha256Json(allCandidates);
const candidateIds = allCandidates.map((candidate) => candidate.id);

const mustPass = ciGate.must_pass ?? [];
const scenarios = ciGate.scenarios ?? {};

const report = {
  suite_version: ciGate.suite_version,
  input_suite_version: inputSuiteVersion,
  run_mode: mode,
  replays_requested: replaysRequested,
  replays_ran: replaysRan,
  candidates_file: path.resolve(candidatesFilePath),
  candidates_count: allCandidates.length,
  ran_at: new Date().toISOString(),
  must_pass: mustPass,
  results: {},
  reproducibility_contract: {
    mode: "R0",
    mode_definition: "Replayable operations",
    manifest: {
      runner: {
        name: asNonEmptyString(pkg?.name) ?? "requested-agent-replay-suite",
        version: asNonEmptyString(pkg?.version),
        command: process.argv.join(" "),
        cwd: process.cwd()
      },
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname()
      },
      inputs: {
        ci_gate_path: path.resolve(ciGatePath),
        ci_gate_sha256: ciGateSha256,
        evaluator_config_path: path.resolve(configPath),
        evaluator_config_sha256: evaluatorConfigSha256,
        candidates_path: path.resolve(candidatesFilePath),
        candidates_file_sha256: candidatesFileSha256,
        candidates_normalized_sha256: candidatesNormalizedSha256,
        candidate_ids: candidateIds
      },
      scenario_selection: mustPass,
      external_runtime_metadata: envelopeReproducibility
    },
    selection_outcomes: [],
    posture_transitions: []
  }
};

let suitePass = true;

for (const scenarioId of mustPass) {
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    suitePass = false;
    report.results[scenarioId] = {
      pass: false,
      error: "Missing scenario definition",
      replays_requested: replaysRequested,
      replays_ran: 0,
      reproducibility: emptyScenarioReproducibility(),
      ...emptyReplayStats()
    };
    continue;
  }

  const scCandidates = allCandidates.filter((c) => c.scenario_id === scenarioId);
  if (scCandidates.length === 0) {
    suitePass = false;
    report.results[scenarioId] = {
      pass: false,
      error: "No candidates found in candidates file",
      replays_requested: replaysRequested,
      replays_ran: 0,
      reproducibility: emptyScenarioReproducibility(),
      ...emptyReplayStats()
    };
    continue;
  }

  const { best, evaluated } = pickBestCandidate({ candidates: scCandidates, scenario, config });
  const replayStats = runReplaySet({ candidates: scCandidates, scenario, config, mode, replaysRan });

  report.results[scenarioId] = {
    scenario: { id: scenarioId, name: scenario.name, intent: scenario.intent },
    best,
    evaluated,
    replays_requested: replaysRequested,
    replays_ran: replaysRan,
    reproducibility: scenarioWinnerReproducibility({
      candidates: scCandidates,
      winnerCandidateId: best?.candidate_id ?? null
    }),
    ...replayStats
  };

  if (!best?.pass) suitePass = false;

  const status = best?.pass ? "PASS" : "FAIL";
  const score = best?.scores?.overall?.toFixed(3) ?? "n/a";
  console.log(`${scenarioId}  ${status}  overall=${score}  best=${best?.candidate_id ?? "n/a"}`);
  if (replaysRan > 1) {
    console.log(
      `  replays pass_rate=${replayStats.pass_rate.toFixed(3)} volatility=${replayStats.volatility.toFixed(3)}`
    );
  }
  if (!best?.pass) {
    for (const f of best?.failures ?? []) console.log(`  - ${f}`);
  }
}

report.suite_pass = suitePass;
report.reproducibility_contract.selection_outcomes = mustPass.map((scenarioId) => {
  const result = report.results[scenarioId];
  const repro = result?.reproducibility ?? emptyScenarioReproducibility();
  return {
    scenario_id: scenarioId,
    pass: Boolean(result?.best?.pass ?? result?.pass ?? false),
    winner_candidate_id: repro.winner_candidate_id,
    winner_abstain: repro.winner_abstain,
    winner_tie_mass: repro.winner_tie_mass,
    pass_rate: typeof result?.pass_rate === "number" ? result.pass_rate : null,
    volatility: typeof result?.volatility === "number" ? result.volatility : null
  };
});
report.reproducibility_contract.posture_transitions = mustPass.map((scenarioId) => {
  const repro = report.results[scenarioId]?.reproducibility ?? emptyScenarioReproducibility();
  return {
    scenario_id: scenarioId,
    winner_candidate_id: repro.winner_candidate_id,
    phase: repro.phase,
    posture: repro.posture,
    trace_decisions: repro.trace_decisions
  };
});

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`\nSuite result: ${suitePass ? "PASS" : "FAIL"}`);
console.log(`Report written: ${reportPath}`);
process.exit(suitePass ? 0 : 1);
