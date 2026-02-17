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

function hasFlag(name) {
  return process.argv.includes(name);
}

function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

function anyWrite(output) {
  const actions = output?.actions;
  if (!Array.isArray(actions)) return false;
  return actions.some((action) => action?.type === "WRITE");
}

function decisionTexts(output) {
  const decisions = output?.trace?.decisions;
  if (!Array.isArray(decisions)) return [];
  return decisions
    .map((decision) => {
      if (typeof decision === "string") return decision;
      if (!isRecord(decision)) return "";
      return [decision.step, decision.result, decision.notes, decision.summary]
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .join(" ");
    })
    .filter((text) => text.length > 0)
    .map((text) => text.toLowerCase());
}

function repeatedDecisionStepCount(output) {
  const decisions = output?.trace?.decisions;
  if (!Array.isArray(decisions)) return 0;
  const counts = new Map();
  for (const decision of decisions) {
    if (!isRecord(decision)) continue;
    const step = asNonEmptyString(decision.step);
    if (!step) continue;
    counts.set(step, (counts.get(step) ?? 0) + 1);
  }
  let repeated = 0;
  for (const count of counts.values()) {
    if (count > 1) repeated += count - 1;
  }
  return repeated;
}

function computePaperV01ProxyMetrics({ winners, config }) {
  const winnerOutputs = winners.filter((winner) => isRecord(winner?.output));
  const caseCount = winnerOutputs.length;
  if (caseCount === 0) {
    return {
      semantics: "experimental_non_blocking_proxies",
      case_count: 0,
      note: "No winner outputs available; proxy metrics omitted."
    };
  }

  const uncertaintyHi = asFiniteNumber(config?.thresholds?.uncertainty_hi) ?? 0.6;
  const uncertaintyLo = asFiniteNumber(config?.thresholds?.uncertainty_lo) ?? 0.35;
  const thrashKeywords = [
    "retry",
    "recompute",
    "rerun",
    "re-run",
    "loop",
    "revert",
    "reverse",
    "undo",
    "backtrack",
    "thrash",
    "churn"
  ];
  const recoveryKeywords = ["restore", "recover", "rollback", "baseline"];

  let compensationCaseCount = 0;
  let thrashCaseCount = 0;
  let thrashSignalCount = 0;
  let recoveryEvidenceCount = 0;
  let writeCaseCount = 0;
  let commitRegretSignalCount = 0;
  let highRiskCaseCount = 0;
  let highRiskSuppressedCount = 0;
  let lowRiskCaseCount = 0;
  let lowRiskSuppressedCount = 0;

  for (const winner of winnerOutputs) {
    const output = winner.output;
    const hasWrite = anyWrite(output);
    const suppressed = Boolean(output?.uncertainty?.abstain) && !hasWrite;

    const postureBandText = `${output?.posture ?? ""} ${output?.phase ?? ""} ${output?.band ?? ""}`.toLowerCase();
    const compensationMarked =
      output?.band === "Orange" ||
      output?.band === "Red" ||
      postureBandText.includes("compensat") ||
      postureBandText.includes("override") ||
      postureBandText.includes("escalat");
    if (compensationMarked) compensationCaseCount += 1;

    const texts = decisionTexts(output);
    const keywordHits = texts.reduce((sum, text) => {
      return sum + (thrashKeywords.some((keyword) => text.includes(keyword)) ? 1 : 0);
    }, 0);
    const repeatedSteps = repeatedDecisionStepCount(output);
    const thrashSignals = keywordHits + repeatedSteps;
    thrashSignalCount += thrashSignals;
    if (thrashSignals > 0) thrashCaseCount += 1;

    const recoveryMarked =
      Boolean(output?.rollback?.verified) ||
      texts.some((text) => recoveryKeywords.some((keyword) => text.includes(keyword)));
    if (recoveryMarked) recoveryEvidenceCount += 1;

    if (hasWrite) {
      writeCaseCount += 1;
      const commitRegretSignal =
        output?.rollback?.verified === false ||
        output?.analysis?.commit_integrity?.no_silent_reversion === false ||
        output?.analysis?.commit_integrity?.self_disowning_reasoning === true ||
        (output?.analysis?.conflict_of_interest?.detected === true &&
          output?.analysis?.conflict_of_interest?.posture_tightened === false);
      if (commitRegretSignal) commitRegretSignalCount += 1;
    }

    const uncertainty = asFiniteNumber(output?.risk?.uncertainty);
    const impact = asFiniteNumber(output?.risk?.impact);
    const highRisk =
      (uncertainty !== null && uncertainty >= uncertaintyHi) ||
      (impact !== null && impact >= uncertaintyHi);
    const lowRisk =
      uncertainty !== null && uncertainty <= uncertaintyLo && (impact === null || impact <= uncertaintyLo);

    if (highRisk) {
      highRiskCaseCount += 1;
      if (suppressed) highRiskSuppressedCount += 1;
    }
    if (lowRisk) {
      lowRiskCaseCount += 1;
      if (suppressed) lowRiskSuppressedCount += 1;
    }
  }

  const highRiskSuppressionRate =
    highRiskCaseCount > 0 ? round(highRiskSuppressedCount / highRiskCaseCount) : null;
  const lowRiskSuppressionRate =
    lowRiskCaseCount > 0 ? round(lowRiskSuppressedCount / lowRiskCaseCount) : null;
  const gatingFidelityGap =
    highRiskSuppressionRate !== null && lowRiskSuppressionRate !== null
      ? round(highRiskSuppressionRate - lowRiskSuppressionRate)
      : null;

  return {
    semantics: "experimental_non_blocking_proxies",
    case_count: caseCount,
    compensation_duty_cycle_proxy: round(compensationCaseCount / caseCount),
    thrash_rate_proxy: round(thrashCaseCount / caseCount),
    avg_thrash_signals_proxy: round(thrashSignalCount / caseCount),
    recovery_evidence_rate_proxy: round(recoveryEvidenceCount / caseCount),
    commit_regret_proxy: {
      write_case_count: writeCaseCount,
      signaled_case_count: commitRegretSignalCount,
      rate: writeCaseCount > 0 ? round(commitRegretSignalCount / writeCaseCount) : null
    },
    gating_fidelity_proxy: {
      uncertainty_hi_threshold: uncertaintyHi,
      uncertainty_lo_threshold: uncertaintyLo,
      high_risk_case_count: highRiskCaseCount,
      high_risk_suppressed_count: highRiskSuppressedCount,
      high_risk_suppression_rate: highRiskSuppressionRate,
      low_risk_case_count: lowRiskCaseCount,
      low_risk_suppressed_count: lowRiskSuppressedCount,
      low_risk_suppression_rate: lowRiskSuppressionRate,
      suppression_gap_high_minus_low: gatingFidelityGap
    },
    notes: [
      "These are report-only proxies for trend tracking and do not affect pass/fail.",
      "Recovery half-life is approximated as recovery evidence rate in v0."
    ]
  };
}

function resolveAblationProfileIds(ablateProfilesArg) {
  const supported = new Set([
    "abstention_telemetry_off",
    "rollback_requirements_off",
    "retrieval_signal_on"
  ]);
  if (!ablateProfilesArg) return [...supported];

  const ids = String(ablateProfilesArg)
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const unknown = ids.filter((id) => !supported.has(id));
  if (unknown.length > 0) {
    console.error(
      `Unsupported ablation profile(s): ${unknown.join(", ")}. Supported: ${[...supported].join(", ")}`
    );
    process.exit(2);
  }
  return ids;
}

function applyAblationProfile({ profileId, scenarios, config }) {
  const scenarioClone = cloneJson(scenarios);
  const configClone = cloneJson(config);

  if (profileId === "abstention_telemetry_off") {
    for (const scenario of Object.values(scenarioClone)) {
      if (!isRecord(scenario?.expect)) continue;
      delete scenario.expect.require_abstain;
      delete scenario.expect.require_abstain_on_weak_bridge;
    }
    return {
      id: profileId,
      description: "Disable abstention checks (require_abstain + require_abstain_on_weak_bridge).",
      scenarios: scenarioClone,
      config: configClone
    };
  }

  if (profileId === "rollback_requirements_off") {
    for (const scenario of Object.values(scenarioClone)) {
      if (!isRecord(scenario?.expect)) continue;
      delete scenario.expect.require_checkpoint;
      delete scenario.expect.require_rollback;
    }
    return {
      id: profileId,
      description: "Disable checkpoint/rollback requirements in scenario expectations.",
      scenarios: scenarioClone,
      config: configClone
    };
  }

  if (profileId === "retrieval_signal_on") {
    if (!isRecord(configClone.retrieval_gate_signal)) {
      configClone.retrieval_gate_signal = {};
    }
    configClone.retrieval_gate_signal.enabled = true;
    if (!isRecord(configClone.weights)) configClone.weights = {};
    if (!(typeof configClone.weights.G === "number" && Number.isFinite(configClone.weights.G) && configClone.weights.G > 0)) {
      configClone.weights.G = 0.15;
    }
    return {
      id: profileId,
      description: "Enable retrieval/integration `G` signal scoring for comparison.",
      scenarios: scenarioClone,
      config: configClone
    };
  }

  console.error(`Unsupported ablation profile: ${profileId}`);
  process.exit(2);
}

function runNonBlockingAblations({
  profileIds,
  mustPass,
  baselineWinners,
  scenarios,
  config,
  allCandidates
}) {
  const profiles = [];
  for (const profileId of profileIds) {
    const ablation = applyAblationProfile({ profileId, scenarios, config });
    const failingScenarios = [];
    const winnerChanges = [];
    let passCount = 0;

    for (const scenarioId of mustPass) {
      const scenario = ablation.scenarios[scenarioId];
      if (!scenario) {
        failingScenarios.push({
          scenario_id: scenarioId,
          reason: "Missing scenario definition in ablation profile."
        });
        continue;
      }

      const scCandidates = allCandidates.filter((candidate) => candidate.scenario_id === scenarioId);
      if (scCandidates.length === 0) {
        failingScenarios.push({
          scenario_id: scenarioId,
          reason: "No candidates available for scenario."
        });
        continue;
      }

      const { best } = pickBestCandidate({
        candidates: scCandidates,
        scenario,
        config: ablation.config
      });
      if (best?.pass) {
        passCount += 1;
      } else {
        failingScenarios.push({
          scenario_id: scenarioId,
          reason: best?.failures?.[0] ?? "Unknown failure."
        });
      }

      const baselineWinnerId = baselineWinners[scenarioId] ?? null;
      const ablationWinnerId = best?.candidate_id ?? null;
      if (baselineWinnerId !== ablationWinnerId) {
        winnerChanges.push({
          scenario_id: scenarioId,
          baseline_winner_candidate_id: baselineWinnerId,
          ablation_winner_candidate_id: ablationWinnerId
        });
      }
    }

    const scenarioCount = mustPass.length;
    profiles.push({
      id: ablation.id,
      description: ablation.description,
      non_blocking: true,
      scenario_count: scenarioCount,
      pass_count: passCount,
      pass_rate: scenarioCount > 0 ? round(passCount / scenarioCount) : 0,
      suite_pass: failingScenarios.length === 0,
      failing_scenarios: failingScenarios,
      winner_change_count: winnerChanges.length,
      winner_changes: winnerChanges
    });
  }

  return {
    enabled: true,
    mode: "non-blocking",
    profile_count: profiles.length,
    profiles
  };
}

const mode = getArg("--mode", "fixtures");
const replaysRequested = parsePositiveInteger(getArg("--replays", "1"), "--replays");
const replaysRan = mode === "fixtures" ? 1 : replaysRequested;
const suitePathArg = getArg("--suite", null);
const ablationProfilesArg = getArg("--ablate-profiles", null);
const runAblations = hasFlag("--ablate") || ablationProfilesArg !== null;

const suiteRoot = path.resolve(__dirname, "..", "replay-suite", "v0");
const defaultSuitePath = path.join(suiteRoot, "ci-gate.json");
const selectedSuitePath = suitePathArg
  ? path.resolve(process.cwd(), suitePathArg)
  : defaultSuitePath;
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

const selectedSuite = await loadJson(selectedSuitePath);
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
if (inputSuiteVersion && inputSuiteVersion !== selectedSuite.suite_version) {
  console.warn(
    `Warning: candidates suite_version "${inputSuiteVersion}" does not match gate suite_version "${selectedSuite.suite_version}".`
  );
}

const envelopeReproducibility = collectEnvelopeReproducibility(loaded);
const [selectedSuiteSha256, evaluatorConfigSha256, candidatesFileSha256] = await Promise.all([
  sha256File(selectedSuitePath),
  sha256File(configPath),
  sha256File(candidatesFilePath)
]);
const candidatesNormalizedSha256 = sha256Json(allCandidates);
const candidateIds = allCandidates.map((candidate) => candidate.id);

const mustPass = selectedSuite.must_pass ?? [];
const scenarios = selectedSuite.scenarios ?? {};

const report = {
  suite_version: selectedSuite.suite_version,
  suite_path: path.resolve(selectedSuitePath),
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
        suite_path: path.resolve(selectedSuitePath),
        suite_sha256: selectedSuiteSha256,
        // Backward-compatible aliases retained for existing report readers.
        ci_gate_path: path.resolve(selectedSuitePath),
        ci_gate_sha256: selectedSuiteSha256,
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
  },
  experimental: {
    paper_v01_proxies: null,
    ablations: {
      enabled: false,
      mode: "non-blocking",
      profile_count: 0,
      profiles: []
    }
  }
};

let suitePass = true;
const winnerOutputs = [];
const baselineWinners = {};

for (const scenarioId of mustPass) {
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    suitePass = false;
    baselineWinners[scenarioId] = null;
    winnerOutputs.push({ scenario_id: scenarioId, candidate_id: null, output: null });
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
    baselineWinners[scenarioId] = null;
    winnerOutputs.push({ scenario_id: scenarioId, candidate_id: null, output: null });
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
  const winnerCandidateId = best?.candidate_id ?? null;
  const winnerRecord = winnerCandidateId
    ? scCandidates.find((candidate) => candidate.id === winnerCandidateId) ?? null
    : null;
  baselineWinners[scenarioId] = winnerCandidateId;
  winnerOutputs.push({
    scenario_id: scenarioId,
    candidate_id: winnerCandidateId,
    output: winnerRecord?.output ?? null
  });
  const replayStats = runReplaySet({ candidates: scCandidates, scenario, config, mode, replaysRan });

  report.results[scenarioId] = {
    scenario: { id: scenarioId, name: scenario.name, intent: scenario.intent },
    best,
    evaluated,
    replays_requested: replaysRequested,
    replays_ran: replaysRan,
    reproducibility: scenarioWinnerReproducibility({
      candidates: scCandidates,
      winnerCandidateId
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
report.experimental.paper_v01_proxies = computePaperV01ProxyMetrics({
  winners: winnerOutputs,
  config
});

if (runAblations) {
  const profileIds = resolveAblationProfileIds(ablationProfilesArg);
  console.log(`\nRunning non-blocking ablations (${profileIds.length} profile(s))...`);
  report.experimental.ablations = runNonBlockingAblations({
    profileIds,
    mustPass,
    baselineWinners,
    scenarios,
    config,
    allCandidates
  });

  for (const profile of report.experimental.ablations.profiles) {
    console.log(
      `  ${profile.id}: pass_rate=${profile.pass_rate.toFixed(3)} winner_changes=${profile.winner_change_count}`
    );
  }
}

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`\nSuite result: ${suitePass ? "PASS" : "FAIL"}`);
console.log(`Report written: ${reportPath}`);
process.exit(suitePass ? 0 : 1);
