const { spawn } = require("child_process");
const c = spawn("C:/dev/target/release/jellypal.exe", [], { detached: true, stdio: "ignore" });
c.unref();
setTimeout(() => {
  const { execSync } = require("child_process");
  const out = execSync('tasklist /FI "IMAGENAME eq jellypal.exe" /FO CSV /NH').toString();
  console.log(out.includes("jellypal") ? out.trim() : "not running");
}, 3000);
