// Pre-promotion gate for an isolated release candidate. Every supported
// self-test flag and its result marker must exist in the binary before the
// first child is launched, so a typo or stale executable cannot fall through
// to the normal desktop-app path.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

process.chdir(require("path").join(__dirname, ".."));

const tests = [
  ["input", "--self-test-input-policy", "INPUT POLICY GREEN (23/23)"],
  ["network", "--self-test-network-policy", "NETWORK POLICY GREEN (43/43)"],
  ["save", "--self-test-save-policy", "SAVE POLICY GREEN (105/105)"],
  ["photo", "--self-test-photo-policy", "PHOTO POLICY GREEN (71/71)"],
  ["log", "--self-test-log-policy", "LOG POLICY GREEN (33/33)"],
  ["migration", "--self-test-migration-policy", "MIGRATION POLICY GREEN (24/24)"],
];

function fail(message) {
  console.error(`candidate policy gate failed: ${message}`);
  process.exit(2);
}

function preflightMissing(binary) {
  const missing = [];
  for (const [name, flag, marker] of tests) {
    if (!binary.includes(Buffer.from(flag, "utf8"))) missing.push(`${name} flag`);
    if (!binary.includes(Buffer.from(marker, "utf8"))) missing.push(`${name} marker`);
  }
  return missing;
}

function resultProblem(name, marker, result) {
  if (result.error) return `${name} could not complete: ${result.error.message}`;
  if (result.status !== 0) {
    return `${name} exit=${result.status} signal=${result.signal || "none"}`;
  }
  if (result.stderr.length !== 0) {
    return `${name} wrote ${Buffer.byteLength(result.stderr, "utf8")} stderr bytes`;
  }
  const markerCount = result.stdout.split(marker).length - 1;
  if (markerCount !== 1 || result.stdout.trim() !== marker) {
    return `${name} returned an unexpected success marker`;
  }
  return null;
}

if (process.argv[2] === "--self-test") {
  const allTokens = Buffer.from(tests.flatMap(([, flag, marker]) => [flag, marker]).join("\n"));
  const marker = tests[0][2];
  const exact = { error: null, status: 0, signal: null, stdout: `${marker}\n`, stderr: "" };
  const cases = [
    preflightMissing(Buffer.alloc(0)).length === tests.length * 2,
    preflightMissing(allTokens).length === 0,
    preflightMissing(Buffer.from(allTokens.toString().replace(tests[0][1], ""))).includes("input flag"),
    preflightMissing(Buffer.from(allTokens.toString().replace(tests.at(-1)[2], ""))).includes("migration marker"),
    resultProblem("input", marker, exact) === null,
    resultProblem("input", marker, { ...exact, stdout: `${marker}\n${marker}\n` }) !== null,
    resultProblem("input", marker, { ...exact, stdout: `noise\n${marker}\n` }) !== null,
    resultProblem("input", marker, { ...exact, stderr: "warning" }) !== null,
    resultProblem("input", marker, { ...exact, status: 2 }) !== null,
    resultProblem("input", marker, { ...exact, error: new Error("timeout") }) !== null,
  ];
  if (cases.every(Boolean)) {
    console.log(`CANDIDATE GATE SELF-TEST GREEN (${cases.length}/${cases.length})`);
    process.exit(0);
  }
  fail(`self-test ${cases.filter(Boolean).length}/${cases.length}`);
}

if (process.argv.length !== 3) {
  fail("usage: node _candidatepolicy.cjs <candidate-exe>");
}

const exe = path.resolve(process.argv[2]);
let stat;
try {
  stat = fs.lstatSync(exe);
} catch (error) {
  fail(`candidate is unavailable: ${error.message}`);
}
if (!stat.isFile()) {
  fail("candidate is not a regular file");
}

let binary;
try {
  binary = fs.readFileSync(exe);
} catch (error) {
  fail(`candidate cannot be read: ${error.message}`);
}

// This is intentionally one all-or-nothing preflight before spawnSync. A
// partially current candidate must not run even the policies it happens to
// contain, because the missing argument could otherwise be supplied manually
// and open the real profile as a normal app launch.
const missing = preflightMissing(binary);
if (missing.length) {
  fail(`preflight missing ${missing.join(", ")}; candidate was not launched`);
}

for (const [name, flag, marker] of tests) {
  const result = spawnSync(exe, [flag], {
    cwd: path.dirname(exe),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    stdio: "pipe",
    timeout: 120000,
    windowsHide: true,
  });
  const problem = resultProblem(name, marker, result);
  if (problem) fail(problem);
  console.log(`PASS ${name.padEnd(9)} ${marker}`);
}

console.log(`CANDIDATE POLICY GREEN (${tests.length}/${tests.length})`);
