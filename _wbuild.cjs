// local Windows build helper: tauri-winres/windres can't open the icon
// under this machine's Korean user path (Illegal byte sequence). tauri.conf
// keeps portable relative paths; TAURI_CONFIG overrides it at build time
// with an ASCII-absolute .ico. usage: node _wbuild.cjs
const fs = require("fs");
const { execSync } = require("child_process");
const conf = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.bundle.icon[0] = "C:/dev/icon.ico"; // ASCII path for windres only
fs.copyFileSync("src-tauri/icons/icon.ico", "C:/dev/icon.ico");
process.env.TAURI_CONFIG = JSON.stringify(conf);
execSync("cargo build --release", { cwd: "src-tauri", stdio: "inherit", env: process.env });
