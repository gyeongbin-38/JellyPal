// dev heartbeat — one command = full self-check, or --watch to re-pulse
// on every src/ change. writes the latest report to HEALTH.txt so an
// autonomous session can read the last result without re-running.
//   node _pulse.cjs         → single pulse, exit 0 green / 2 red
//   node _pulse.cjs --watch → keeps a pulse rolling on file changes
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Make every command and HEALTH.txt resolve against this checkout even when
// the pulse is launched via an absolute path or from a parent directory.
process.chdir(require("path").join(__dirname, ".."));

// A pulse ends with a real-executable clean-boot check. Two overlapping
// pulses would otherwise race that process and produce false failures (the
// pre-isolation harness could even race the developer save). Keep one runner
// per checkout; a lock left by a killed process is reclaimed automatically.
const LOCK_PATH = path.join(__dirname, ".pulse.lock");
let lockHeld = false;
function pidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function releaseLock() {
  if (!lockHeld) return;
  try {
    const owner = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    if (owner.pid === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch {}
  lockHeld = false;
}
function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(LOCK_PATH, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: Date.now() }) + "\n");
      fs.closeSync(fd);
      lockHeld = true;
      return true;
    } catch (e) {
      if (!e || e.code !== "EEXIST") throw e;
      let owner = {};
      try { owner = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")); } catch {}
      if (pidAlive(owner.pid)) {
        console.error(`heartbeat already running (pid ${owner.pid})`);
        return false;
      }
      try { fs.unlinkSync(LOCK_PATH); } catch {}
    }
  }
  return false;
}

if (!acquireLock()) process.exit(3);
process.on("exit", releaseLock);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => process.exit(128));
}

// scripts live under scripts/ since the root cleanup — paths are repo-relative
const STEPS = [
  ["syntax",  ["--check", "src/main.js"], 300000],
  ["rust",    ["scripts/_rustcheck.cjs"], 300000],
  ["sprites", ["scripts/_sprcheck.cjs"], 300000],
  ["assets",  ["scripts/_audit.cjs"], 300000],
  ["package", ["scripts/dist.cjs", "--check"], 60000],
  ["candidate", ["scripts/_candidatepolicy.cjs", "--self-test"], 60000],
  ["input",   ["scripts/_inputpolicy.cjs"], 60000],
  ["network", ["scripts/_networkpolicy.cjs"], 60000],
  ["savepol", ["scripts/_savepolicy.cjs"], 60000],
  ["photos",  ["scripts/_photopolicy.cjs"], 60000],
  ["logpol",  ["scripts/_logpolicy.cjs"], 60000],
  ["migrate", ["scripts/_migrationpolicy.cjs"], 60000],
  ["unlock",  ["scripts/unlock.cjs", "--self-test"], 60000],
  ["fresh",   ["scripts/_fresh.cjs"], 300000],
  ["freshnull", ["scripts/_fresh.cjs", "null"], 300000],
  ["freshseed", ["scripts/_fresh.cjs", "seeded"], 300000],
  ["freshnarrow", ["scripts/_fresh.cjs", "narrowprop"], 300000],
  ["codes",   ["scripts/_codes.cjs"], 60000],
  ["worker",  ["server/test.cjs"], 60000], // signed grants, license binding, retry/ack idempotency
  ["sitepay", ["scripts/_payck.cjs"], 60000],
  ["site",    ["scripts/_mcheck.cjs"], 60000],
  ["sitejs",  ["scripts/_deps.cjs"], 60000],
  ["verify",  ["scripts/_verify.cjs"], 300000],
  ["volume",  ["scripts/_voltest.cjs"], 300000],
  ["breed",   ["scripts/_breedflow.cjs"], 300000],
  ["props",   ["scripts/_proptest.cjs"], 300000],
  ["eating",  ["scripts/_eatsim.cjs"], 300000],
  ["pals",    ["scripts/_palaudit.cjs"], 720000], // 60 species × a real sim walk each — heavy on a loaded box
  ["sim",     ["scripts/_sim.cjs"], 300000],
  ["fuzz",    ["scripts/_fuzz.cjs", "1200", "424242"], 60000], // deterministic mixed-input/state churn
  ["qa",      ["scripts/qacheck.cjs"], 120000], // floating-pixel sweep; 6 authored floats are the baseline
  ["cleanboot", ["scripts/_cleantest.cjs"], 60000], // isolated profile, real exe, real first-run persistence
];

const WATCH_FILES = [
  "src/main.js", "src/index.html", "src/styles.css",
  "src-tauri/src/lib.rs", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml",
  "scripts/_rustcheck.cjs", "scripts/_candidatepolicy.cjs", "scripts/_inputpolicy.cjs", "scripts/_networkpolicy.cjs", "scripts/_savepolicy.cjs", "scripts/_photopolicy.cjs", "scripts/_logpolicy.cjs", "scripts/_migrationpolicy.cjs", "scripts/dist.cjs", "scripts/unlock.cjs", "README.txt", "DESIGN.md",
  "site/version.txt",
  "server/worker.js", "server/grant.cjs", "server/test.cjs",
  "site/index.html", "site/pals.js", "site/ranch.js", "site/sprite-text.js",
  "scripts/_payck.cjs", "scripts/_mcheck.cjs", "scripts/_deps.cjs",
  "scripts/_sprcheck.cjs", "scripts/_audit.cjs", "scripts/_fresh.cjs", "scripts/_codes.cjs", "scripts/_verify.cjs",
  "scripts/_socsim.cjs", "scripts/_treatsim.cjs", "scripts/_voltest.cjs", "scripts/_breedflow.cjs",
  "scripts/_proptest.cjs", "scripts/_eatsim.cjs", "scripts/_palaudit.cjs", "scripts/_sim.cjs", "scripts/_fuzz.cjs",
  "scripts/qacheck.cjs", "scripts/_cleantest.cjs",
];

function pulse() {
  const t0 = Date.now();
  const lines = [];
  let ok = true;
  let passed = 0;
  for (const [name, args, tmo] of STEPS) {
    const r = spawnSync("node", args, { encoding: "utf8", timeout: tmo });
    const out = ((r.stdout || "") + (r.stderr || "")).trim();
    const good = r.status === 0;
    ok = ok && good;
    if (good) passed++;
    const tail = out.split("\n").filter(Boolean).pop() || "";
    lines.push(`${good ? "PASS" : "FAIL"} ${name.padEnd(7)} ${tail}`);
    if (!good) {
      const bad = out.split("\n").filter((l) => l.includes("FAIL") || l.includes("THREW") || l.includes("Error")).slice(0, 10);
      lines.push(...bad.map((l) => "      " + l));
    }
  }
  const head = `[${new Date().toLocaleTimeString()}] heartbeat ${ok ? "GREEN" : "RED"} ${passed}/${STEPS.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`;
  const report = head + "\n" + lines.join("\n") + "\n";
  console.log(report);
  try { fs.writeFileSync("HEALTH.txt", report); } catch {}
  return ok;
}

if (process.argv.includes("--watch")) {
  let lastSig = "";
  let timer = null;
  console.log(`heartbeat watching ${WATCH_FILES.length} source/gate files — every change gets a pulse`);
  pulse();
  setInterval(() => {
    try {
      const sig = WATCH_FILES
        .map((f) => fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0).join(",");
      if (sig !== lastSig) {
        const first = lastSig === "";
        lastSig = sig;
        if (first) return; // baseline — pulse() already ran
        clearTimeout(timer);
        timer = setTimeout(pulse, 400); // debounce burst saves
      }
    } catch {}
  }, 800);
} else {
  process.exit(pulse() ? 0 : 2);
}
