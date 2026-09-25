// hover QA: launch 0.2.4, sweep the real cursor across the bottom strip
// (where the pet lives), and watch clickdbg "inside" flip to true.
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");
const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const DBG = path.join(os.homedir(), "AppData/Roaming/com.jellypal.desktop/clickdbg.json");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const moveTo = (x, y) => execSync(
  `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})"`
);

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);
  if (fs.existsSync(DBG)) fs.unlinkSync(DBG);
  const p = spawn(EXE, [], { detached: true, stdio: "ignore" });
  p.unref();
  console.log("[qa2] launched; waiting 12s for webview boot...");
  await sleep(12000);

  // sweep the bottom strip (pet ground line ~ y=980 on a 1080p screen at
  // 100% scale; cursor coords are physical px)
  const H = 1080, W = 1920;
  let sawInside = false, sawRects = 0;
  for (let x = 200; x <= W - 200; x += 120) {
    moveTo(x, H - 90);
    await sleep(700);
    if (fs.existsSync(DBG)) {
      const d = JSON.parse(fs.readFileSync(DBG, "utf8"));
      if (d.rects > sawRects) sawRects = d.rects;
      if (d.inside) { sawInside = true; console.log(`[qa2] x=${x} -> inside:true rects:${d.rects} cursor:${d.cursor}`); }
    }
  }
  console.log("[qa2] sweep done. inside seen:", sawInside, "| rects:", sawRects);
  console.log("[qa2] HOVER:", sawInside ? "PASS" : "FAIL (pet never became interactive)");
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
})();
