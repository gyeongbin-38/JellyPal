#!/usr/bin/env node
// JellyPal agent bridge — the writer half of the <app-data>/agent.json
// contract. Any local agent (JARVIS, a CI watcher, a shell hook) calls this
// to make the slime react:
//
//   node agent-bridge.mjs done "build ok"
//   node agent-bridge.mjs approve "review PR #42" --app "JARVIS"
//   node agent-bridge.mjs fail "tests red"
//   node agent-bridge.mjs say "good morning" --seq 7
//
// kinds: done (star face), approve (NEEDS YOU — tapping the pet within 30s
// foregrounds the window named by --app, default "JARVIS"), fail (worry),
// say (speech bubble only). seq must increase across notices — the bridge
// persists a counter in <data dir>/.agent-seq so callers don't track it.
//
// The app polls the file every ~3s, so notices land almost instantly.

import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// data dir must match src-tauri: JELLYPAL_TEST_DATA_DIR override first,
// then the platform app-data folder for com.jellypal.desktop.
function dataDir() {
  if (process.env.JELLYPAL_TEST_DATA_DIR) return process.env.JELLYPAL_TEST_DATA_DIR;
  if (process.platform === "win32")
    return join(process.env.APPDATA || join(homedir(), "AppData/Roaming"), "com.jellypal.desktop");
  if (process.platform === "darwin")
    return join(homedir(), "Library/Application Support/com.jellypal.desktop");
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local/share"), "com.jellypal.desktop");
}

const argv = process.argv.slice(2);
const kind = argv[0];
const appFlag = argv.indexOf("--app");
const app = appFlag >= 0 ? argv[appFlag + 1] : undefined;
const seqFlag = argv.indexOf("--seq");
const msg = argv.filter((a, i) => i > 0 && !a.startsWith("--") && i !== appFlag + 1 && i !== seqFlag + 1).join(" ");

if (!["done", "approve", "fail", "say"].includes(kind)) {
  console.error('usage: node agent-bridge.mjs done|approve|fail|say "message" [--app NAME] [--seq N]');
  process.exit(1);
}

const dir = dataDir();
mkdirSync(dir, { recursive: true });
let seq = seqFlag >= 0 ? Number(argv[seqFlag + 1]) : NaN;
if (!Number.isFinite(seq)) {
  try { seq = Number(readFileSync(join(dir, ".agent-seq"), "utf8").trim()) + 1; }
  catch { seq = 1; }
}
const notice = { seq, kind };
if (msg) notice.msg = msg.slice(0, 120);
if (app) notice.app = app.slice(0, 60);
writeFileSync(join(dir, "agent.json"), JSON.stringify(notice));
writeFileSync(join(dir, ".agent-seq"), String(seq));
console.log(`agent.json <- seq=${seq} kind=${kind}${app ? ` app=${app}` : ""}${msg ? ` "${msg}"` : ""}`);
