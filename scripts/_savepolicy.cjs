// Exercise the save-generation policy inside the shipped executable. Exit
// status is the oracle because a Windows-subsystem binary cannot reliably
// pipe attached-console text back to Node.
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

process.chdir(require("path").join(__dirname, ".."));
const exe = path.join(__dirname, "..", "src-tauri", "target", "release", "jellypal.exe");
if (!fs.existsSync(exe)) {
  console.error("release exe missing");
  process.exit(2);
}
const binary = fs.readFileSync(exe);
const flag = Buffer.from("--self-test-save-policy", "utf8");
const resultMarker = Buffer.from("SAVE POLICY GREEN (105/105)", "utf8");
if (!binary.includes(flag) || !binary.includes(resultMarker)) {
  console.error("release exe is stale: current save-policy self-test marker missing");
  process.exit(2);
}
const result = spawnSync(exe, ["--self-test-save-policy"], {
  cwd: __dirname,
  stdio: "pipe",
  timeout: 10000,
  windowsHide: true,
});
if (result.error) {
  console.error("save-policy CLI failed:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error(`save-policy CLI exit=${result.status} signal=${result.signal || "none"}`);
  process.exit(2);
}
console.log("SAVE POLICY CLI GREEN (105/105)");

function unseal(txt) {
  if (!txt.startsWith("JPENC1:")) return txt;
  if (process.platform !== "win32") throw new Error("cannot audit a Windows DPAPI save on this platform");
  const ps = [
    "Add-Type -AssemblyName System.Security",
    "$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())",
    "$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))",
  ].join("; ");
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    input: txt.slice("JPENC1:".length),
    encoding: "utf8",
    windowsHide: true,
  });
}

function fnv64(txt) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(txt, "utf8")) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash;
}

function field(raw, name, optional = false) {
  const match = raw.match(new RegExp(`"${name}"\\s*:\\s*(null|\\d+)`));
  if (!match) throw new Error(`checkpoint field missing: ${name}`);
  if (match[1] === "null") return optional ? null : 0n;
  return BigInt(match[1]);
}

function auditRealProfile() {
  if (!process.env.APPDATA) throw new Error("APPDATA is unavailable");
  const dir = path.join(process.env.APPDATA, "com.jellypal.desktop");
  const chkPath = path.join(dir, "state.chk");

  let regSeq = 0n;
  if (process.platform === "win32") {
    try {
      const out = execFileSync("reg.exe", ["QUERY", "HKCU\\Software\\JellyPal", "/v", "sv"], {
        encoding: "utf8", windowsHide: true,
      });
      const match = out.match(/REG_SZ\s+(\d+)/);
      if (match) regSeq = BigInt(match[1]);
    } catch {}
  }

  let seq = 0n;
  let cur = null;
  let prev = null;
  if (fs.existsSync(chkPath)) {
    const chkRaw = unseal(fs.readFileSync(chkPath, "utf8"));
    JSON.parse(chkRaw);
    seq = field(chkRaw, "seq");
    cur = field(chkRaw, "cur");
    prev = field(chkRaw, "prev", true);
  }

  const candidates = [];
  for (const name of ["state.json", "state.json.bak"]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    try {
      const txt = fs.readFileSync(file, "utf8");
      const raw = unseal(txt);
      JSON.parse(raw);
      const hash = fnv64(raw);
      let generation = "checkpointless";
      let gen = null;
      if (cur !== null) {
        if (hash === cur) { generation = "current"; gen = seq; }
        else if (prev !== null && hash === prev) { generation = "previous"; gen = seq > 0n ? seq - 1n : 0n; }
        else generation = "unknown";
      }
      const allowed = cur === null
        ? regSeq === 0n
        : gen !== null ? gen + 1n >= regSeq : regSeq === 0n && seq <= 2n;
      candidates.push({ name, generation, allowed, hash, format: txt.startsWith("JPENC1:") ? "sealed" : "plaintext-legacy" });
    } catch (e) {
      candidates.push({ name, generation: `invalid:${e.message}`, allowed: false, format: "invalid" });
    }
  }
  const selected = candidates.find((candidate) => candidate.allowed);
  const detail = candidates.map((candidate) => `${candidate.name}=${candidate.generation}/${candidate.format}/${candidate.allowed ? "allow" : "reject"}/fnv=${candidate.hash ?? "n/a"}`).join(", ");
  if (!selected) throw new Error(`no acceptable real save; seq=${seq} watermark=${regSeq} chkCur=${cur} chkPrev=${prev}; ${detail || "no candidates"}`);
  console.log(`REAL SAVE POLICY GREEN selected=${selected.name} generation=${selected.generation} seq=${seq} watermark=${regSeq} chkCur=${cur} chkPrev=${prev}; ${detail}`);
}

if (process.argv.includes("--audit-real")) {
  try { auditRealProfile(); }
  catch (e) { console.error(`REAL SAVE POLICY FAILED: ${e.message}`); process.exit(2); }
}
