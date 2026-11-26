// Exercise the retained clickable-geometry policy inside the shipped binary.
// A marker check ensures an older executable cannot pass merely because it
// ignores an unknown command-line flag.
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
const flag = Buffer.from("--self-test-input-policy", "utf8");
const marker = Buffer.from("INPUT POLICY GREEN (23/23)", "utf8");
if (!binary.includes(flag) || !binary.includes(marker)) {
  console.error("release exe is stale: current input-policy self-test marker missing");
  process.exit(2);
}
const result = spawnSync(exe, ["--self-test-input-policy"], {
  cwd: __dirname,
  stdio: "pipe",
  timeout: 10000,
  windowsHide: true,
});
if (result.error) {
  console.error("input-policy CLI failed:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error(`input-policy CLI exit=${result.status} signal=${result.signal || "none"}`);
  process.exit(2);
}
console.log("INPUT POLICY CLI GREEN (23/23)");
