// dev heartbeat — one command = full self-check, or --watch to re-pulse
// on every src/ change. writes the latest report to HEALTH.txt so an
// autonomous session can read the last result without re-running.
//   node _pulse.cjs         → single pulse, exit 0 green / 2 red
//   node _pulse.cjs --watch → keeps a pulse rolling on file changes
const { spawnSync } = require("child_process");
const fs = require("fs");

const STEPS = [
  ["syntax",  ["--check", "src/main.js"], 300000],
  ["sprites", ["_sprcheck.cjs"], 300000],
  ["fresh",   ["_fresh.cjs"], 300000],
  ["freshnull", ["_fresh.cjs", "null"], 300000],
  ["freshseed", ["_fresh.cjs", "seeded"], 300000],
  ["codes",   ["_codes.cjs"], 60000],
  ["verify",  ["_verify.cjs"], 300000],
  ["pals",    ["_palaudit.cjs"], 720000], // 60 species × a real sim walk each — heavy on a loaded box
  ["sim",     ["_sim.cjs"], 300000],
  ["qa",      ["qacheck.cjs"], 120000], // floating-pixel sweep; 6 authored floats are the baseline
  ["cleanboot", ["_cleantest.cjs"], 60000], // hides dev save, boots real exe, checks fresh profile
];

function pulse() {
  const t0 = Date.now();
  const lines = [];
  let ok = true;
  for (const [name, args, tmo] of STEPS) {
    const r = spawnSync("node", args, { encoding: "utf8", timeout: tmo });
    const out = ((r.stdout || "") + (r.stderr || "")).trim();
    const good = r.status === 0;
    ok = ok && good;
    const tail = out.split("\n").filter(Boolean).pop() || "";
    lines.push(`${good ? "PASS" : "FAIL"} ${name.padEnd(7)} ${tail}`);
    if (!good) {
      const bad = out.split("\n").filter((l) => l.includes("FAIL") || l.includes("THREW") || l.includes("Error")).slice(0, 10);
      lines.push(...bad.map((l) => "      " + l));
    }
  }
  const head = `[${new Date().toLocaleTimeString()}] heartbeat ${ok ? "GREEN" : "RED"} (${((Date.now() - t0) / 1000).toFixed(0)}s)`;
  const report = head + "\n" + lines.join("\n") + "\n";
  console.log(report);
  try { fs.writeFileSync("HEALTH.txt", report); } catch {}
  return ok;
}

if (process.argv.includes("--watch")) {
  let lastSig = "";
  let timer = null;
  console.log("heartbeat watching src/ + _verify.cjs — every change gets a pulse");
  pulse();
  setInterval(() => {
    try {
      const sig = ["src/main.js", "src/index.html", "src/styles.css", "_verify.cjs"]
        .map((f) => fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0).join(",");
      if (sig !== lastSig) {
        const first = lastSig === "";
        lastSig = sig;
        if (first) return; // baseline — pulse() already ran
        clearTimeout(timer);
        timer = setTimeout(pulse, 400); // debounce burst saves
      }
    } catch {}
  }, 800);
} else {
  process.exit(pulse() ? 0 : 2);
}
