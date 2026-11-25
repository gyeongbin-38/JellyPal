const { execSync } = require("child_process");
for (const t of ["scripts/_socsim.cjs", "scripts/_cardball.cjs"]) {
  try {
    const out = execSync(`node ${t}`, { cwd: "C:/dev/mini/typet", encoding: "utf8", timeout: 120000 });
    console.log(`=== ${t} ===\n` + out.trim().split("\n").slice(-6).join("\n"));
  } catch (e) {
    console.log(`=== ${t} FAILED ===\n` + String(e.stdout || e.message).slice(-2000));
  }
}
