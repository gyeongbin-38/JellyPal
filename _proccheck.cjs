const { execSync } = require("child_process");
const out = execSync("tasklist").toString();
const lines = out.split(/\r?\n/).filter((l) => /jellypal/i.test(l));
console.log("jellypal processes:", lines.length);
lines.forEach((l) => console.log("  " + l.trim()));
console.log("now:", Date.now());
const fs = require("fs");
const crash = process.env.APPDATA + "/com.jellypal.app/crash.log";
if (fs.existsSync(crash)) {
  const all = fs.readFileSync(crash, "utf8").trim().split(/\r?\n/);
  const last = all.slice(-3);
  console.log("last crash.log lines:");
  last.forEach((l) => console.log("  " + l));
}
