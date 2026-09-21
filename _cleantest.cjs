// clean-machine first-run test: hide the dev save, boot the real exe with
// no state.json, verify a fresh player profile is written, then restore.
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

const dir = path.join(process.env.APPDATA, "com.jellypal.app");
const exe = path.join(__dirname, "src-tauri", "target", "release", "jellypal.exe");
const files = ["state.json", "state.json.bak"];
const log = (...a) => console.log(...a);
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : ""));
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // a running instance would keep writing to the save we're about to
  // hide — stop it first (dev box: relaunch after the pulse)
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(500);

  // crash.log baseline — fresh boot shouldn't append anything
  const crashPath = path.join(dir, "crash.log");
  const crashBefore = fs.existsSync(crashPath) ? fs.statSync(crashPath).size : 0;

  // 1. move the dev save aside
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) fs.renameSync(p, p + ".keep");
  }
  check("dev save moved aside", !fs.existsSync(path.join(dir, "state.json")));

  // 2. boot the shipped exe with no save present
  const proc = spawn(exe, [], { detached: false, stdio: "ignore" });
  // the first save lands whenever something sets dirty (daily stipend,
  // intro wave) + the 5s persist tick — poll up to 25s instead of a
  // fixed wait
  const sp = path.join(dir, "state.json");
  for (let i = 0; i < 50 && !fs.existsSync(sp); i++) await sleep(500);
  await sleep(500);

  // 3. still running = didn't crash on first boot
  let alive = false;
  try { execSync(`tasklist /FI "PID eq ${proc.pid}"`).toString().includes("jellypal"); alive = true; } catch {}
  check("exe alive after fresh boot", alive, `pid=${proc.pid}`);

  // 4. a state file was written, and it's a FRESH profile
  check("state.json written", fs.existsSync(sp));
  if (fs.existsSync(sp)) {
    const s = JSON.parse(fs.readFileSync(sp, "utf8"));
    check("starter species only", Array.isArray(s.owned) && s.owned.length === 1 && s.owned[0] === "sprout",
      `owned=${JSON.stringify(s.owned)}`);
    check("no accessories owned", !s.accOwned || s.accOwned.length === 0,
      `acc=${JSON.stringify(s.accOwned)}`);
    check("small starting jelly", typeof s.jelly === "number" && s.jelly < 100, `jelly=${s.jelly}`);
    check("no pals summoned", !s.pals || s.pals.length === 0, `pals=${JSON.stringify(s.pals)}`);
    check("no redeemed codes", !s.redeemed || s.redeemed.length === 0);
    check("no accessories equipped", !s.accEquip || Object.keys(s.accEquip).length === 0);
  }

  // 5. nothing new in crash.log
  const crashAfter = fs.existsSync(crashPath) ? fs.statSync(crashPath).size : 0;
  check("no crash.log growth on fresh boot", crashAfter === crashBefore, `+${crashAfter - crashBefore}b`);

  // 6. kill it and restore the dev save
  try { execSync(`taskkill /F /PID ${proc.pid}`); } catch {}
  await sleep(600);
  for (const f of files) {
    const keep = path.join(dir, f + ".keep");
    if (fs.existsSync(keep)) {
      // drop the fresh-boot state, put the dev save back
      const p = path.join(dir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      fs.renameSync(keep, p);
    }
  }
  check("dev save restored", fs.existsSync(path.join(dir, "state.json")));

  console.log(`\n=== cleanboot: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
