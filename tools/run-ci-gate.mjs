import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

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

const suiteRoot = path.resolve(__dirname, "..", "replay-suite", "v0");
const ciGatePath = path.join(suiteRoot, "ci-gate.json");
const configPath = path.join(suiteRoot, "evaluator-config.json");
const fixturesPath = path.join(suiteRoot, "fixtures", "ci-gate-candidates.json");
const reportDir = path.join(suiteRoot, "reports");
const reportPath = path.join(reportDir, "latest.json");

if (!["fixtures", "candidates"].includes(mode)) {
  console.error(`Supported modes: fixtures | candidates (got: ${mode})`);
  process.exit(2);
}

const candidatesPathArg = getArg("--candidates", null);

const ciGate = await loadJson(ciGatePath);
const config = await loadJson(configPath);

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

const mustPass = ciGate.must_pass ?? [];
const scenarios = ciGate.scenarios ?? {};

const report = {
  suite_version: ciGate.suite_version,
  input_suite_version: inputSuiteVersion,
  run_mode: mode,
  candidates_file: path.resolve(candidatesFilePath),
  candidates_count: allCandidates.length,
  ran_at: new Date().toISOString(),
  must_pass: mustPass,
  results: {}
};

let suitePass = true;

for (const scenarioId of mustPass) {
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    suitePass = false;
    report.results[scenarioId] = { pass: false, error: "Missing scenario definition" };
    continue;
  }

  const scCandidates = allCandidates.filter((c) => c.scenario_id === scenarioId);
  if (scCandidates.length === 0) {
    suitePass = false;
    report.results[scenarioId] = { pass: false, error: "No candidates found in candidates file" };
    continue;
  }

  const { best, evaluated } = pickBestCandidate({ candidates: scCandidates, scenario, config });

  report.results[scenarioId] = {
    scenario: { id: scenarioId, name: scenario.name, intent: scenario.intent },
    best,
    evaluated
  };

  if (!best?.pass) suitePass = false;

  const status = best?.pass ? "PASS" : "FAIL";
  const score = best?.scores?.overall?.toFixed(3) ?? "n/a";
  console.log(`${scenarioId}  ${status}  overall=${score}  best=${best?.candidate_id ?? "n/a"}`);
  if (!best?.pass) {
    for (const f of best?.failures ?? []) console.log(`  - ${f}`);
  }
}

report.suite_pass = suitePass;

await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`\nSuite result: ${suitePass ? "PASS" : "FAIL"}`);
console.log(`Report written: ${reportPath}`);
process.exit(suitePass ? 0 : 1);
