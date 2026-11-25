const fs = require("fs");
const s = fs.readFileSync("C:/dev/mini/typet/src-tauri/target/release/jellypal.exe", "latin1");
for (const p of ["C:/dev", "C:\\dev", "Desktop", "typet", "panic.log", "hook.log"]) {
  let n = 0, i = -1;
  while ((i = s.indexOf(p, i + 1)) !== -1) n++;
  console.log(p, ":", n);
}
// show context of any dev paths
for (const m of s.matchAll(/[A-Za-z]:[\\/][A-Za-z0-9 _\-\\/.]{3,80}/g)) {
  const v = m[0];
  if (/dev|Desktop|Users/i.test(v)) console.log("  ctx:", JSON.stringify(v));
}
