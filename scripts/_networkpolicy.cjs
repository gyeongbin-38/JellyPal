// Exercise bounded network input/output policy inside the shipped binary.
// The marker prevents an older executable from passing an unknown flag.
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
const flag = Buffer.from("--self-test-network-policy", "utf8");
const marker = Buffer.from("NETWORK POLICY GREEN (43/43)", "utf8");
if (!binary.includes(flag) || !binary.includes(marker)) {
  console.error("release exe is stale: current network-policy self-test marker missing");
  process.exit(2);
}
const result = spawnSync(exe, ["--self-test-network-policy"], {
  cwd: __dirname,
  stdio: "pipe",
  timeout: 10000,
  windowsHide: true,
});
if (result.error) {
  console.error("network-policy CLI failed:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error(`network-policy CLI exit=${result.status} signal=${result.signal || "none"}`);
  process.exit(2);
}
console.log("NETWORK POLICY CLI GREEN (43/43)");
