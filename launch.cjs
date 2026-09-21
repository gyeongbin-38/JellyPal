const { spawn } = require("child_process");
const p = spawn("src-tauri/target/release/jellypal.exe", [], { detached: true, stdio: "ignore" });
p.unref();
console.log("spawned", p.pid);
