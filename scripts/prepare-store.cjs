// Prepare a disposable checkout for a macOS-only App Store build.
// Run in CI or a clean worktree; the direct-download flavor needs the originals.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const cargoPath = path.join(root, "src-tauri/Cargo.toml");
const configPath = path.join(root, "src-tauri/tauri.conf.json");
const cargo = fs.readFileSync(cargoPath, "utf8");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const store = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.store.conf.json"), "utf8"));
if (store.app.macOSPrivateApi !== false || store.app.windows.some(w => w.transparent)) {
  throw new Error("Store windows must be opaque and private APIs must be disabled");
}
const prepared = cargo.replace(/,\s*"macos-private-api"/g, "");
if (/features\s*=\s*\[[^\]]*"macos-private-api"/.test(prepared)) {
  throw new Error("Private API dependency could not be removed");
}
config.app.macOSPrivateApi = false;
delete config.bundle.resources;
fs.writeFileSync(cargoPath, prepared);
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Prepared macOS store build (private APIs and Windows loader excluded).");
