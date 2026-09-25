// QA4 migration regression: legacy save exists, new save absent ->
// app must copy it forward (feature, kept intentionally).
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, spawn } = require("child_process");
const EXE = "C:/build/typet/src-tauri/target/release/jellypal.exe";
const ROAM = os.homedir() + "/AppData/Roaming";
const NEW = path.join(ROAM, "com.jellypal.desktop/state.json");
const OLD = path.join(ROAM, "com.jellypal.app/state.json");
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(800);
  fs.renameSync(NEW, NEW + ".q4bak");
  const oldJelly = JSON.parse(fs.readFileSync(OLD, "utf8")).jelly;
  console.log("[qa4] desktop save moved away; legacy jelly:", oldJelly);

  spawn(EXE, [], { detached: true, stdio: "ignore" }).unref();
  await sleep(14000);
  try { execSync("taskkill /F /IM jellypal.exe", { stdio: "ignore" }); } catch {}
  await sleep(600);

  if (fs.existsSync(NEW)) {
    const d = JSON.parse(fs.readFileSync(NEW, "utf8"));
    console.log("[qa4] migrated save jelly:", d.jelly, "pals:", (d.pals || []).length);
    console.log("[qa4] MIGRATION:", d.jelly === oldJelly ? "PASS (still works)" : "PARTIAL");
  } else console.log("[qa4] MIGRATION: FAIL — nothing copied forward");

  if (fs.existsSync(NEW)) fs.unlinkSync(NEW);
  fs.renameSync(NEW + ".q4bak", NEW);
  console.log("[qa4] real save restored");
})();
