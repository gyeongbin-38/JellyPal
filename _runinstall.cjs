// launch the installed exe, watch it for 10s, report
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const exe = path.join(__dirname, "_installtest", "jellypal.exe");
const crashPath = path.join(process.env.APPDATA, "com.jellypal.app", "crash.log");
const crashBefore = fs.existsSync(crashPath) ? fs.statSync(crashPath).size : 0;

const proc = spawn(exe, [], { stdio: "ignore" });
console.log("spawned pid", proc.pid);
proc.on("exit", (c) => console.log("EXITED early, code", c));
proc.on("error", (e) => console.log("SPAWN ERROR", e.message));

setTimeout(() => {
  try {
    const out = execSync(`tasklist /FI "PID eq ${proc.pid}"`).toString();
    console.log(out.includes("jellypal") ? "ALIVE after 10s" : "NOT RUNNING after 10s\n" + out);
  } catch (e) { console.log("tasklist failed", e.message); }
  const crashAfter = fs.existsSync(crashPath) ? fs.statSync(crashPath).size : 0;
  console.log("crash.log delta:", crashAfter - crashBefore, "bytes");
  if (crashAfter > crashBefore) {
    const t = fs.readFileSync(crashPath, "utf8");
    console.log("crash tail:\n" + t.trim().split(/\r?\n/).slice(-8).join("\n"));
  }
  try { execSync(`taskkill /F /PID ${proc.pid}`); } catch {}
  process.exit(0);
}, 10000);
