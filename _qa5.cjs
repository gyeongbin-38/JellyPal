// QA5: confirm dragging clears after a real release (not stale dbg read)
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");
const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const DBG = path.join(os.homedir(), "AppData/Roaming/com.jellypal.desktop/clickdbg.json");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ps = c => { try { execSync(`powershell -NoProfile -Command "${c}"`, { stdio: "ignore" }); } catch {} };
const moveTo = (x, y) => ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})`);
const down = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U -Namespace W; [W.U]::mouse_event(2,0,0,0,0)`);
const up = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U9 -Namespace W9; [W9.U9]::mouse_event(4,0,0,0,0)`);
const dbg = () => fs.existsSync(DBG) ? JSON.parse(fs.readFileSync(DBG, "utf8")) : null;

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);
  if (fs.existsSync(DBG)) fs.unlinkSync(DBG);
  spawn(EXE, [], { detached: true, stdio: "ignore" }).unref();
  console.log("[qa5] launched, waiting 12s...");
  await sleep(12000);

  // find grabbable spot (same coords as before known to work)
  let spot = null;
  for (const y of [990, 950]) for (let x = 150; x <= 1770 && !spot; x += 60) {
    moveTo(x, y); await sleep(400);
    const d = dbg(); if (d && d.inside) spot = [x, y];
  }
  console.log("[qa5] spot:", spot);
  if (!spot) { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); return; }

  moveTo(spot[0], spot[1]); await sleep(400);
  down(); await sleep(400);
  let grabbed = false;
  for (let i = 0; i < 8; i++) {
    moveTo(spot[0] + i * 20, spot[1] - i * 6); await sleep(250);
    const d = dbg(); if (d && d.dragging) { grabbed = true; break; }
  }
  console.log("[qa5] grabbed:", grabbed);
  up();
  // wait >2s for next clickdbg writes
  for (let i = 0; i < 4; i++) {
    await sleep(1200);
    const d = dbg();
    console.log(`[qa5] post-release t+${(i + 1) * 1.2}s:`, d ? `dragging:${d.dragging} inside:${d.inside}` : "n/a");
  }
  const fin = dbg();
  console.log("[qa5] RELEASE-CLEAR:", fin && fin.dragging === false ? "PASS" : grabbed ? "FAIL(stuck)" : "N/A(no grab)");
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
})();
