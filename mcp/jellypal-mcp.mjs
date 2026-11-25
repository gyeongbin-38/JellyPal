#!/usr/bin/env node
// JellyPal MCP server — plug the desktop slime into any MCP orchestrator
// (Paseo, Orca, Claude Desktop, ...). Zero dependencies: speaks MCP's
// stdio transport (newline-delimited JSON-RPC) over the same drop-file
// contract agent-bridge.mjs uses — writes <app-data>/agent.json notices,
// reads <app-data>/status.json for live pet state.
//
// Register it with your orchestrator, e.g.:
//   "mcpServers": {
//     "jellypal": { "command": "node", "args": ["<repo>/mcp/jellypal-mcp.mjs"] }
//   }
//
// Tools:
//   jellypal_status       {}                -> live pet state (v, state, face, jelly, ...)
//   jellypal_say          {message}         -> speech bubble
//   jellypal_done         {message}         -> task finished, celebrate (star face)
//   jellypal_attention    {message, app?}   -> NEEDS YOU; tapping the slime jumps to `app`
//   jellypal_fail         {message}         -> task failed, worry face
//   jellypal_focus        {app}             -> foreground the named window (Windows)

import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

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

// serverInfo version tracks the app — read tauri.conf.json when the script
// lives in the repo, otherwise fall back gracefully
function appVersion() {
  try {
    const conf = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "tauri.conf.json"), "utf8"));
    return conf.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// writer half of the agent.json contract — seq must increase across
// notices, persisted in <data dir>/.agent-seq (same as agent-bridge.mjs)
function writeNotice(kind, msg, app) {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  let seq;
  try { seq = Number(readFileSync(join(dir, ".agent-seq"), "utf8").trim()) + 1; }
  catch { seq = 1; }
  const notice = { seq, kind };
  if (msg) notice.msg = String(msg).slice(0, 120);
  if (app) notice.app = String(app).slice(0, 60);
  writeFileSync(join(dir, "agent.json"), JSON.stringify(notice));
  writeFileSync(join(dir, ".agent-seq"), String(seq));
  return notice;
}

function readStatus() {
  try {
    const raw = readFileSync(join(dataDir(), "status.json"), "utf8");
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

const TOOLS = [
  {
    name: "jellypal_status",
    description: "Read live JellyPal state: version, app state, current face, energy, jelly currency, level, pal count, pomodoro phase, hide mode, last consumed notice seq. Fresh to ~3s.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "jellypal_say",
    description: "Show a speech bubble over the desktop slime. Korean text is supported.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Text to display (<= ~120 chars)" } },
      required: ["message"],
    },
  },
  {
    name: "jellypal_done",
    description: "Report a finished task — the slime celebrates (star face) and says the message.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Short completion line, e.g. 'build ok'" } },
      required: ["message"],
    },
  },
  {
    name: "jellypal_attention",
    description: "Ask the user for attention — shows NEEDS YOU over the slime; tapping it within 30s foregrounds the window named by `app`.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Why attention is needed, e.g. 'approve deploy'" },
        app: { type: "string", description: "Window title substring to jump to when the slime is tapped" },
      },
      required: ["message"],
    },
  },
  {
    name: "jellypal_fail",
    description: "Report a failed task — the slime shows a worry face and says the message.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Short failure line, e.g. 'tests red'" } },
      required: ["message"],
    },
  },
  {
    name: "jellypal_focus",
    description: "Foreground the first visible window whose title contains `app` (Windows only; elsewhere the notice lands but the hop no-ops).",
    inputSchema: {
      type: "object",
      properties: { app: { type: "string", description: "Window title substring, e.g. 'Paseo' or 'notepad'" } },
      required: ["app"],
    },
  },
];

const text = (s) => ({ content: [{ type: "text", text: s }] });

function callTool(name, args = {}) {
  switch (name) {
    case "jellypal_status": {
      const s = readStatus();
      return s
        ? text(JSON.stringify(s))
        : text("no status.json — JellyPal is not running or hasn't written its status board yet (writes every ~3s once running)");
    }
    case "jellypal_say": {
      if (!args.message) return { content: [{ type: "text", text: "message is required" }], isError: true };
      const n = writeNotice("say", args.message);
      return text(`said: "${n.msg}" (seq ${n.seq})`);
    }
    case "jellypal_done": {
      if (!args.message) return { content: [{ type: "text", text: "message is required" }], isError: true };
      const n = writeNotice("done", args.message);
      return text(`celebrated: "${n.msg}" (seq ${n.seq})`);
    }
    case "jellypal_attention": {
      if (!args.message) return { content: [{ type: "text", text: "message is required" }], isError: true };
      const n = writeNotice("approve", args.message, args.app);
      return text(`NEEDS YOU: "${n.msg}"${args.app ? ` -> ${args.app}` : ""} (seq ${n.seq})`);
    }
    case "jellypal_fail": {
      if (!args.message) return { content: [{ type: "text", text: "message is required" }], isError: true };
      const n = writeNotice("fail", args.message);
      return text(`flagged: "${n.msg}" (seq ${n.seq})`);
    }
    case "jellypal_focus": {
      if (!args.app) return { content: [{ type: "text", text: "app is required" }], isError: true };
      const n = writeNotice("focus", null, args.app);
      return text(`focus requested for "${args.app}" (seq ${n.seq})`);
    }
    default:
      return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
  }
}

// ---------- stdio transport: newline-delimited JSON-RPC ----------
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function replyErr(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handle(msg) {
  if (msg.id === undefined || msg.id === null) return; // notification — no response
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: (params && params.protocolVersion) || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "jellypal", version: appVersion() },
      });
      break;
    case "ping":
      reply(id, {});
      break;
    case "tools/list":
      reply(id, { tools: TOOLS });
      break;
    case "tools/call": {
      const r = callTool(params && params.name, (params && params.arguments) || {});
      reply(id, r);
      break;
    }
    case "shutdown":
      reply(id, {});
      break;
    default:
      replyErr(id, -32601, `method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  try {
    handle(JSON.parse(s));
  } catch {
    replyErr(null, -32700, "parse error");
  }
});
rl.on("close", () => process.exit(0));
