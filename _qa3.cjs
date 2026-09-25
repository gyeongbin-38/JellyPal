// QA round 2: real synthetic drag. Position cursor over a clickable rect
// (inside:true), hold LMB, sweep — clickdbg.dragging must flip true,
// proving pointerdown->set_dragging works end-to-end on the built binary.
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");
const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const DBG = path.join(os.homedir(), "AppData/Roaming/com.jellypal.desktop/clickdbg.json");
const CRASH = path.join(os.homedir(), "AppData/Roaming/com.jellypal.desktop/crash.log");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// mouse helpers via powershell + user32 mouse_event
const ps = cmd => execSync(`powershell -NoProfile -Command "${cmd}"`);
const initMouse = () => ps(
  `Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U -Namespace W -PassThru | Out-Null; ` +
  `Add-Type -AssemblyName System.Windows.Forms`
);
const moveTo = (x, y) => ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})`);
const down = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U2 -Namespace W2; [W2.U2]::mouse_event(2,0,0,0,0)`);
const up = () => ps(`Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);' -Name U3 -Namespace W3; [W3.U3]::mouse_event(4,0,0,0,0)`);
const dbg = () => fs.existsSync(DBG) ? JSON.parse(fs.readFileSync(DBG, "utf8")) : null;

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);
  if (fs.existsSync(DBG)) fs.unlinkSync(DBG);
  const p = spawn(EXE, [], { detached: true, stdio: "ignore" });
  p.unref();
  console.log("[qa3] launched with real save, waiting 12s...");
  await sleep(12000);

  // find a spot where inside:true (bottom strip, pals/props/pet live there)
  let spot = null;
  for (let x = 200; x <= 1720 && !spot; x += 80) {
    moveTo(x, 990); await sleep(650);
    const d = dbg();
    if (d && d.inside) spot = { x, y: 990, d };
  }
  console.log("[qa3] clickable spot:", spot ? `${spot.x},${spot.y} rects:${spot.d.rects}` : "NONE");
  if (!spot) { console.log("[qa3] FAIL no clickable spot"); execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); return; }

  // LMB down, sweep right while watching dragging
  moveTo(spot.x, spot.y); await sleep(400);
  down();
  await sleep(300);
  let sawDrag = false;
  for (let i = 0; i < 12; i++) {
    moveTo(spot.x + i * 30, spot.y - i * 10);
    await sleep(350);
    const d = dbg();
    if (d && d.dragging) { sawDrag = true; console.log(`[qa3] drag step ${i}: dragging:true inside:${d.inside}`); }
  }
  up(); await sleep(300);
  const after = dbg();
  console.log("[qa3] after release:", after ? `dragging:${after.dragging} inside:${after.inside} flipfail:${after.flipfail}` : "n/a");
  console.log("[qa3] DRAG:", sawDrag && after && !after.dragging ? "PASS" : "FAIL");

  if (fs.existsSync(CRASH)) {
    const c = fs.readFileSync(CRASH, "utf8").trim().split("\n").slice(-5);
    console.log("[qa3] crash.log tail:", c.join(" | ") || "(empty)");
  } else console.log("[qa3] crash.log: absent (clean)");

  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
})();
