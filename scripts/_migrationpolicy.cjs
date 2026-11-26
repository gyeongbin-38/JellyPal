// Exercise bounded, reparse-safe legacy profile migration inside the shipped
// executable. The embedded marker prevents stale binaries from passing.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

process.chdir(require("path").join(__dirname, ".."));
const exe = path.join(__dirname, "..", "src-tauri", "target", "release", "jellypal.exe");
if (!fs.existsSync(exe)) {
  console.error("release exe missing");
  process.exit(2);
}
const binary = fs.readFileSync(exe);
const flag = Buffer.from("--self-test-migration-policy", "utf8");
const marker = Buffer.from("MIGRATION POLICY GREEN (24/24)", "utf8");
if (!binary.includes(flag) || !binary.includes(marker)) {
  console.error("release exe is stale: current migration-policy self-test marker missing");
  process.exit(2);
}
const result = spawnSync(exe, ["--self-test-migration-policy"], {
  cwd: __dirname,
  stdio: "pipe",
  timeout: 10000,
  windowsHide: true,
});
if (result.error) {
  console.error("migration-policy CLI failed:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error(`migration-policy CLI exit=${result.status} signal=${result.signal || "none"}`);
  process.exit(2);
}
console.log("MIGRATION POLICY CLI GREEN (24/24)");
