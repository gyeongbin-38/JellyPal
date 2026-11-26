// Exercise bounded single-record crash logging and tail-preserving rotation
// inside the shipped executable. The embedded marker rejects stale binaries.
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
const flag = Buffer.from("--self-test-log-policy", "utf8");
const marker = Buffer.from("LOG POLICY GREEN (33/33)", "utf8");
if (!binary.includes(flag) || !binary.includes(marker)) {
  console.error("release exe is stale: current log-policy self-test marker missing");
  process.exit(2);
}
const result = spawnSync(exe, ["--self-test-log-policy"], {
  cwd: __dirname,
  stdio: "pipe",
  timeout: 10000,
  windowsHide: true,
});
if (result.error) {
  console.error("log-policy CLI failed:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error(`log-policy CLI exit=${result.status} signal=${result.signal || "none"}`);
  process.exit(2);
}
console.log("LOG POLICY CLI GREEN (33/33)");
