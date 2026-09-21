// packaging helper: build the itch.io zip from the release exe.
// usage: node dist.cjs          -> jellypal-<ver>-win.zip   (full version)
//        node dist.cjs --demo   -> jellypal-<ver>-demo-win.zip (adds demo.flag)
// run after: cargo build --release
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = "C:\\dev\\mini\\typet";
const EXE = path.join(ROOT, "src-tauri", "target", "release", "jellypal.exe");
const DIST = path.join(ROOT, "dist");
const VER = "0.2.0";
const DEMO = process.argv.includes("--demo");

if (!fs.existsSync(EXE)) {
  console.error("release exe missing — run cargo build --release first");
  process.exit(1);
}
fs.mkdirSync(DIST, { recursive: true });

const tag = DEMO ? `jellypal-${VER}-demo-win` : `jellypal-${VER}-win`;
const stage = path.join(DIST, tag);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage);
fs.copyFileSync(EXE, path.join(stage, "jellypal.exe"));
fs.copyFileSync(path.join(ROOT, "README.txt"), path.join(stage, "README.txt"));
// the exe checks for this marker next to itself to enable demo mode
if (DEMO) fs.writeFileSync(path.join(stage, "demo.flag"), "free demo — see README\n");

const zip = `${stage}.zip`;
try { fs.rmSync(zip); } catch {}
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}'"`,
  { stdio: "inherit" }
);
fs.rmSync(stage, { recursive: true, force: true });
const mb = (fs.statSync(zip).size / 1048576).toFixed(1);
console.log(`packed: ${zip} (${mb} MB)`);
console.log("upload with: butler push " + zip + ` <user>/jellypal:windows${DEMO ? "-demo" : ""}`);
