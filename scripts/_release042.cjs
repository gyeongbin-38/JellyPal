const { execFileSync } = require("child_process");
const path = require("path");
const DIR = path.join(__dirname, "..");
const DL = path.join(DIR, "site", "dl");
const args = [
  "release", "create", "v0.4.2",
  path.join(DL, "Jellypal_0.4.2_x64-setup.exe"),
  path.join(DL, "jellypal-0.4.2-win.zip"),
  "--title", "JellyPal v0.4.2 — prop placement hotfix",
  "--notes-file", path.join(DIR, "_relbody042.txt"),
];
const out = execFileSync("gh", args, { cwd: DIR, encoding: "utf8" });
console.log(out);
