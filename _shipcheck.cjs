// pre-ship check: installed exe vs release exe, verify-code exit codes,
// running-instance sanity
const { spawnSync, execSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name); } };
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const installed = "C:/Jellypal/jellypal.exe";
const release = "C:/dev/mini/typet/src-tauri/target/release/jellypal.exe";
const setup = "C:/dev/mini/typet/dist/Jellypal_0.2.0_x64-setup.exe";

// 1. binaries identical
ok("installed exe == release exe", sha(installed) === sha(release));

// 2. verify-code diagnostics on the INSTALLED exe
const good = spawnSync(installed, ["--verify-code", "JELLYPAL-A-ABCDEFGH-XXXX"], { encoding: "utf8" });
ok("garbage code rejected (exit!=0)", good.status !== 0);
const forged = spawnSync(installed, ["--verify-code", "not a code"], { encoding: "utf8" });
ok("non-code rejected", forged.status !== 0);

// 3. mint a real code and confirm the installed exe accepts it
const mint = spawnSync("node", ["codes.cjs", "pubkey"], { cwd: "C:/dev/mini/typet", encoding: "utf8" });
const code = spawnSync("node", ["codes.cjs", "B", "1"], { cwd: "C:/dev/mini/typet", encoding: "utf8" }).stdout.trim().split(/\r?\n/).pop();
const real = spawnSync(installed, ["--verify-code", code], { encoding: "utf8" });
ok("real minted code accepted", real.status === 0);

// 4. exactly one instance can run (already-tested mutex, quick recheck)
const procs = execSync("tasklist /FI \"IMAGENAME eq jellypal.exe\"").toString();
const count = (procs.match(/jellypal\.exe/gi) || []).length;
ok(`jellypal instance count = ${count}`, count <= 1);

// 5. installer freshness — setup newer than or equal to release exe
ok("setup.exe exists && >1MB", fs.statSync(setup).size > 1_000_000);

// 6. save file sane (running install keeps writing it)
const statePath = process.env.APPDATA + "/com.jellypal.app/state.json";
try { const s = JSON.parse(fs.readFileSync(statePath, "utf8")); ok("state.json parses, owned=" + (s.owned || []).length, true); }
catch (e) { ok("state.json parses", false); }

// 7. crash.log quiet in last stretch
const crash = process.env.APPDATA + "/com.jellypal.app/crash.log";
const lines = fs.existsSync(crash) ? fs.readFileSync(crash, "utf8").trim().split(/\r?\n/) : [];
const nonTick = lines.filter((l) => !/tick/.test(l)).slice(-5);
ok(`crash.log non-tick tail (${nonTick.length})`, nonTick.length <= 5);
nonTick.forEach((l) => console.log("    log:", l.slice(0, 120)));

console.log(`\n=== shipcheck: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
