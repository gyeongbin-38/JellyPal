// QA3b: sweep ALL clickable spots, attempt a drag on each until one grabs.
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");
const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const DBG = path.join(os.homedir(), "AppData/Roaming/com.jellypal.desktop/clickdbg.json");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ps = c => { try { execSync(`powershell -NoProfile -Command "${c}"`, { stdio: "ignore" }); } catch {} };
const MOUSE = `[W.U]::mouse_event`;
const moveTo = (x, y) => ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})`);
const down = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U -Namespace W; ${MOUSE}(2,0,0,0,0)`);
const up = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U9 -Namespace W9; [W9.U9]::mouse_event(4,0,0,0,0)`);
const dbg = () => fs.existsSync(DBG) ? JSON.parse(fs.readFileSync(DBG, "utf8")) : null;

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);
  if (fs.existsSync(DBG)) fs.unlinkSync(DBG);
  spawn(EXE, [], { detached: true, stdio: "ignore" }).unref();
  console.log("[qa3b] launched, waiting 12s...");
  await sleep(12000);

  // collect inside:true spots across the bottom strip AND a second row
  const spots = [];
  for (const y of [990, 950, 1030]) {
    for (let x = 150; x <= 1770; x += 90) {
      moveTo(x, y); await sleep(400);
      const d = dbg();
      if (d && d.inside) spots.push([x, y]);
    }
  }
  console.log("[qa3b] clickable spots found:", spots.length, JSON.stringify(spots.slice(0, 20)));

  let pass = false;
  for (const [x, y] of spots) {
    moveTo(x, y); await sleep(350);
    down(); await sleep(350);
    for (let i = 0; i < 8; i++) {
      moveTo(x + i * 25, y - i * 8); await sleep(250);
      const d = dbg();
      if (d && d.dragging) { pass = true; console.log(`[qa3b] DRAGGING at ${x},${y}`); break; }
    }
    up(); await sleep(300);
    if (pass) break;
  }
  const fin = dbg();
  console.log("[qa3b] final:", fin ? `dragging:${fin.dragging} inside:${fin.inside} flipfail:${fin.flipfail} rects:${fin.rects}` : "n/a");
  console.log("[qa3b] DRAG:", pass ? "PASS" : "FAIL");
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
})();
