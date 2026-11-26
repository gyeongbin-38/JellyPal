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
// Mac App Store screenshots must be an exact 16:10 size and contain no
// alpha channel. Parse the PNG IHDR directly so a generator cannot silently
// reintroduce RGBA files App Store Connect rejects at upload time.
const shotSizes = new Set(["1280x800", "1440x900", "2560x1600", "2880x1800"]);
const shotDir = path.join(root, "assets");
const shots = fs.readdirSync(shotDir).filter((name) => /^store-shot\d+-(?:1280|1440|2560|2880)\.png$/.test(name));
assert.ok(shots.length >= 3, "expected at least three Mac store screenshots");
for (const name of shots) {
  const png = fs.readFileSync(path.join(shotDir, name));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", `${name}: not a PNG`);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR", `${name}: missing IHDR`);
  const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  assert.ok(shotSizes.has(size), `${name}: unsupported screenshot size ${size}`);
  assert.equal(png[24], 8, `${name}: bit depth must be 8`);
  assert.equal(png[25], 2, `${name}: must be opaque RGB, not alpha-capable color type ${png[25]}`);
  assert.equal(png[26], 0, `${name}: unsupported PNG compression`);
  assert.equal(png[27], 0, `${name}: unsupported PNG filter`);
  assert.equal(png[28], 0, `${name}: interlaced screenshots are not accepted`);
}
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
