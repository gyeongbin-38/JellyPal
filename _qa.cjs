// QA: launch built exe with ALL save dirs wiped (incl. legacy identifiers),
// verify true first-run state + clickdbg. Restores every backup at the end.
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");

const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const ROAM = path.join(os.homedir(), "AppData", "Roaming");
const DIRS = ["com.jellypal.desktop", "com.jellypal.app", "com.typet.app"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);

  // back up all three save dirs' state files
  const moved = [];
  for (const d of DIRS) {
    const dir = path.join(ROAM, d);
    for (const name of ["state.json", "state.json.bak"]) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) {
        fs.renameSync(f, f + ".qa-backup");
        moved.push(f);
        console.log("[qa] backed up", f);
      }
    }
    const dbg = path.join(dir, "clickdbg.json");
    if (fs.existsSync(dbg)) fs.unlinkSync(dbg);
  }

  const exeOk = fs.existsSync(EXE);
  console.log("[qa] exe:", exeOk, exeOk ? fs.statSync(EXE).size : 0);
  if (!exeOk) { restore(); return; }
  const p = spawn(EXE, [], { detached: true, stdio: "ignore" });
  p.unref();
  console.log("[qa] launched, sampling clickdbg...");

  const dbg = path.join(ROAM, "com.jellypal.desktop", "clickdbg.json");
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    console.log(`[qa] t=${(i + 1) * 2}s`, fs.existsSync(dbg) ? fs.readFileSync(dbg, "utf8").trim() : "no clickdbg");
  }

  const state = path.join(ROAM, "com.jellypal.desktop", "state.json");
  if (fs.existsSync(state)) {
    const d = JSON.parse(fs.readFileSync(state, "utf8"));
    console.log("[qa] fresh state:", JSON.stringify({
      jelly: d.jelly, pals: (d.pals || []).length,
      propsOut: Object.values(d.props || {}).filter(Boolean).length,
      owned: d.owned, seen: d.seen,
    }));
    const ok = d.jelly === 100 && (d.pals || []).length === 0
      && Object.values(d.props || {}).every(v => v === null);
    console.log("[qa] FIRST-RUN:", ok ? "PASS" : "FAIL");
  } else console.log("[qa] WARN no state.json");

  // check nothing was resurrected into legacy dirs
  for (const d of ["com.jellypal.app", "com.typet.app"]) {
    const f = path.join(ROAM, d, "state.json");
    console.log(`[qa] ${d}/state.json after boot:`, fs.existsSync(f) ? "EXISTS (migration)" : "absent");
  }

  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(500);
  restore();
  function restore() {
    for (const f of moved) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
      fs.renameSync(f + ".qa-backup", f);
      console.log("[qa] restored", f);
    }
  }
})();
