const { spawn, execSync } = require("child_process");
const exe = process.argv[2] || "C:/Jellypal/jellypal.exe";
const p = spawn(exe, [], { detached: true, stdio: "ignore" });
p.unref();
console.log("spawned pid", p.pid);
setTimeout(() => {
  try {
    const out = execSync(`tasklist /FI "PID eq ${p.pid}"`).toString();
    console.log(out.includes("jellypal") ? "ALIVE" : "DEAD\n" + out);
  } catch (e) { console.log("check fail", e.message); }
}, 4000);
