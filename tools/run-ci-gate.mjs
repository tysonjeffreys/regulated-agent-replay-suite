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

// candidates file can be { candidates: [...] } OR raw [...]
const allCandidates = Array.isArray(loaded) ? loaded : loaded.candidates ?? loaded ?? [];

const mustPass = ciGate.must_pass ?? [];
const scenarios = ciGate.scenarios ?? {};

const report = {
  suite_version: ciGate.suite_version,
  run_mode: mode,
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
