// packaging helper: build the itch.io zip from the release exe.
// usage: node dist.cjs          -> jellypal-<ver>-win.zip   (full version)
//        node dist.cjs --demo   -> jellypal-<ver>-demo-win.zip (adds demo.flag)
// run after: cargo build --release
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const EXE = path.join(ROOT, "src-tauri", "target", "release", "jellypal.exe");
const LOADER = path.join(ROOT, "src-tauri", "target", "release", "WebView2Loader.dll");
const README = path.join(ROOT, "README.txt");
const DIST = path.join(ROOT, "dist");
// One version authority: the binary/bundlers already use tauri.conf.json.
// Reading it here prevents a current exe from being shipped in a stale
// filename (this was still producing jellypal-0.2.0 at app v0.2.16).
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, "src-tauri", "tauri.conf.json"), "utf8")).version;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(VER)) {
  console.error(`invalid app version in tauri.conf.json: ${VER}`);
  process.exit(1);
}
const DEMO = process.argv.includes("--demo");
const CHECK_ONLY = process.argv.includes("--check");

for (const [label, file] of [["release exe", EXE], ["WebView2 loader", LOADER], ["package README", README]]) {
  if (!fs.existsSync(file)) {
    console.error(`${label} missing: ${file}`);
    process.exit(1);
  }
}
if (fs.statSync(EXE).size < 1_000_000 || fs.statSync(LOADER).size < 10_000) {
  console.error("release exe or WebView2 loader is unexpectedly small");
  process.exit(1);
}
const readmeHead = fs.readFileSync(README, "utf8").split(/\r?\n/, 1)[0];
if (!readmeHead.includes(`JELLYPAL v${VER} `)) {
  console.error(`README version does not match app ${VER}: ${readmeHead}`);
  process.exit(1);
}
const cargoToml = fs.readFileSync(path.join(ROOT, "src-tauri", "Cargo.toml"), "utf8");
const mainJs = fs.readFileSync(path.join(ROOT, "src", "main.js"), "utf8");
const siteVersion = fs.readFileSync(path.join(ROOT, "site", "version.txt"), "utf8").trim();
const siteIndex = fs.readFileSync(path.join(ROOT, "site", "index.html"), "utf8");
const design = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
const macDmgLink = siteIndex.match(/dl\/(Jellypal_[\d.]+_aarch64\.dmg)/);
const macTarLink = siteIndex.match(/dl\/(jellypal-[\d.]+-mac\.tar\.gz)/);
const versionChecks = [
  ["Cargo.toml", cargoToml.includes(`version = "${VER}"`)],
  ["frontend APP_VER", mainJs.includes(`const APP_VER = "${VER}"`)],
  ["site/version.txt", siteVersion === VER],
  ["site Windows installer link", siteIndex.includes(`dl/Jellypal_${VER}_x64-setup.exe`)],
  ["site Windows portable link", siteIndex.includes(`dl/jellypal-${VER}-win.zip`)],
  ["site macOS dmg link", !!(macDmgLink && fs.existsSync(path.join(ROOT, "site", "dl", macDmgLink[1])))],
  ["site macOS tar link", !!(macTarLink && fs.existsSync(path.join(ROOT, "site", "dl", macTarLink[1])))],
  ["site footer", siteIndex.includes(`v${VER} · early release`)],
  ["DESIGN installer", design.includes(`Jellypal_${VER}_x64-setup.exe`)],
  ["DESIGN portable", design.includes(`jellypal-${VER}-win.zip`)],
];
const stale = versionChecks.filter(([, ok]) => !ok).map(([name]) => name);
if (stale.length) {
  console.error(`version mismatch for ${VER}: ${stale.join(", ")}`);
  process.exit(1);
}
const productSources = [
  "src/main.js", "src/index.html", "src/styles.css", "src-tauri/src/lib.rs",
  "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml",
].map((file) => path.join(ROOT, file));
const newestSource = Math.max(...productSources.map((file) => fs.statSync(file).mtimeMs));
if (fs.statSync(EXE).mtimeMs + 2000 < newestSource) {
  console.error("release exe is older than product source — rebuild before packaging");
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log(`PACKAGE INPUTS GREEN v${VER} (${versionChecks.length} version checks)`);
  process.exit(0);
}
fs.mkdirSync(DIST, { recursive: true });

const tag = DEMO ? `jellypal-${VER}-demo-win` : `jellypal-${VER}-win`;
const stage = path.join(DIST, tag);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage);
fs.copyFileSync(EXE, path.join(stage, "jellypal.exe"));
// GNU target links the WebView2 loader dynamically — without this DLL
// next to the exe the app exits instantly with 0xC0000135
fs.copyFileSync(
  LOADER,
  path.join(stage, "WebView2Loader.dll")
);
fs.copyFileSync(README, path.join(stage, "README.txt"));
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
