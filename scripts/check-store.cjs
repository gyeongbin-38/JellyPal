const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const store = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.store.conf.json"), "utf8"));
assert.equal(store.identifier, "com.jellypal.store");
assert.equal(store.app.macOSPrivateApi, false);
assert.ok(store.app.windows.every(w => !w.transparent));
assert.deepEqual(store.bundle.targets, ["app"]);
assert.equal(store.bundle.macOS.minimumSystemVersion, "12.0");
assert.match(fs.readFileSync(path.join(root, "src-tauri/macos-store/entitlements.plist"), "utf8"),
  /<key>com\.apple\.security\.app-sandbox<\/key>\s*<true\/>/);
// Exercise preparation twice in isolation; the working checkout stays intact.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "jellypal-store-"));
try {
  for (const file of ["scripts/prepare-store.cjs", "src-tauri/Cargo.toml", "src-tauri/tauri.conf.json", "src-tauri/tauri.store.conf.json"]) {
    const dest = path.join(temp, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, file), dest);
  }
  for (let n = 0; n < 2; n++) execFileSync(process.execPath, [path.join(temp, "scripts/prepare-store.cjs")]);
  const config = JSON.parse(fs.readFileSync(path.join(temp, "src-tauri/tauri.conf.json"), "utf8"));
  assert.equal(config.app.macOSPrivateApi, false);
  assert.equal(config.bundle.resources, undefined);
  assert.doesNotMatch(fs.readFileSync(path.join(temp, "src-tauri/Cargo.toml"), "utf8"), /features\s*=\s*\[[^\]]*"macos-private-api"/);
} finally {
  // mkdtemp owns this directory; no project or user files are removed.
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log("Store configuration and repeatable build preparation passed.");
