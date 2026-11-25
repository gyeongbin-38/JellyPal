// Rust backend compile gate. The GNU Windows linker cannot consume object
// paths containing non-ASCII user names, so use the same ASCII target root as
// release builds when the configured/default target would be unsafe.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

process.chdir(require("path").join(__dirname, ".."));
const env = { ...process.env };
if (process.platform === "win32") {
  const configured = env.CARGO_TARGET_DIR && path.resolve(env.CARGO_TARGET_DIR);
  if (!configured || /[^\x00-\x7f]/.test(configured)) {
    env.CARGO_TARGET_DIR = "C:\\build\\jellypal-target";
  }
  fs.mkdirSync(env.CARGO_TARGET_DIR, { recursive: true });
  env.TEMP = "C:\\build\\jellypal-tmp";
  env.TMP = env.TEMP;
  fs.mkdirSync(env.TEMP, { recursive: true });
}

function cargo(args, label) {
  const result = spawnSync("cargo", [...args, "--manifest-path", "src-tauri/Cargo.toml"], {
    cwd: path.join(__dirname, ".."),
    env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stdout.write(result.stderr);
  if (result.error) {
    console.error(`${label} could not start:`, result.error.message);
    process.exit(2);
  }
  if (result.status !== 0) process.exit(result.status || 2);
}
cargo(["check"], "cargo check");
console.log("RUST CHECK GREEN");
