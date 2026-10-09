// clean-machine first-run test: boot the real exe under an isolated profile,
// verify a fresh player profile is written, then remove only that sandbox.
// Never move or write the developer's real save: pulse runs may overlap or be
// interrupted, and a test must not put player data at risk.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn } = require("child_process");

const exe = path.join(__dirname, "src-tauri", "target", "release", "jellypal.exe");
const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jellypal-cleanboot-"));
const dir = path.join(sandboxRoot, "profile");
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, ".jellypal-test-profile"), "cleanboot\n");
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : ""));
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let proc = null;
  // The app has a single-instance mutex, so stop a dev instance before the
  // isolated boot. Its save remains untouched and no restore dance is needed.
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(500);
  try {
    // Boot the shipped exe with no save present. The marker-gated override is
    // handled by the app itself, including its rollback checkpoint and logs.
    proc = spawn(exe, [], {
      detached: false,
      stdio: "ignore",
      env: { ...process.env, JELLYPAL_TEST_DATA_DIR: dir },
    });
    const sp = path.join(dir, "state.json");
    for (let i = 0; i < 50 && !fs.existsSync(sp); i++) await sleep(500);
    await sleep(500);

    let alive = false;
    try { execSync(`tasklist /FI "PID eq ${proc.pid}"`).toString().includes("jellypal"); alive = true; } catch {}
    check("exe alive after fresh boot", alive, `pid=${proc.pid}`);
    check("state.json written in sandbox", fs.existsSync(sp), `root=${sandboxRoot}`);
    if (fs.existsSync(sp)) {
      let s = null;
      try { s = JSON.parse(fs.readFileSync(sp, "utf8")); } catch {}
      check("sandbox save is readable", !!s);
      if (s) {
        check("starter species only", Array.isArray(s.owned) && s.owned.length === 1 && s.owned[0] === "sprout",
          `owned=${JSON.stringify(s.owned)}`);
        check("starter cap owned", Array.isArray(s.accOwned) && s.accOwned.length === 1 && s.accOwned[0] === "cap",
          `acc=${JSON.stringify(s.accOwned)}`);
        check("starts with 500 jelly", s.jelly === 500, `jelly=${s.jelly}`);
        check("no pals summoned", !s.pals || s.pals.length === 0, `pals=${JSON.stringify(s.pals)}`);
        check("no redeemed codes", !s.redeemed || s.redeemed.length === 0);
        check("no accessories equipped", !s.accEquip || Object.keys(s.accEquip).length === 0);
      }
    }

    const crashPath = path.join(dir, "crash.log");
    const crashSize = fs.existsSync(crashPath) ? fs.statSync(crashPath).size : 0;
    check("no crash.log on fresh boot", crashSize === 0, `size=${crashSize}b`);
  } finally {
    if (proc) {
      try { execSync(`taskkill /F /PID ${proc.pid}`, { stdio: "ignore" }); } catch {}
      await sleep(600);
    }
    // sandboxRoot is the exact mkdtemp result above, never a computed parent.
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }

  check("sandbox removed", !fs.existsSync(sandboxRoot));
  console.log(`\n=== cleanboot: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
