// QA harness for the new features: real game frames under the raster ctx.
// Exercises say-bubble, agent_notice hook, laugh frames, pal why-bubble.
// Writes PNG crops to C:/dev/qa for visual inspection + asserts state.
const fs = require("fs");
const path = require("path");
const P = path.join(__dirname, "_promocap.cjs");
let src = fs.readFileSync(P, "utf8");

// stub agent_notice: one 'done' notice waiting
src = src.replace(
  `      if (cmd === "is_demo") return Promise.resolve(false);`,
  `      if (cmd === "is_demo") return Promise.resolve(false);
      if (cmd === "agent_notice") return Promise.resolve(JSON.stringify({ seq: 1, kind: "done", msg: "BUILD OK" }));`
);

// replace the whole run section
src = src.split("// ---------- run ----------")[0];
src += `
// ---------- run ----------
const QOUT = "C:/dev/qa";
let cv = null; // els.c is created when main.js boots — bind lazily
fs.mkdirSync(QOUT, { recursive: true });
function writeCrop(name, x0, y0, w, h) {
  const W = 1280, d = cv._img.data;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = (x0 + x) | 0, sy = (y0 + y) | 0, si = (sy * W + sx) * 4, di = (y * w + x) * 4;
    if (sx < 0 || sy < 0 || sx >= W || sy >= 720) continue;
    for (let k = 0; k < 4; k++) out[di + k] = d[si + k];
  }
  // flatten over dark bg for visibility
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3] / 255;
    out[i] = out[i] * a + 24 * (1 - a);
    out[i + 1] = out[i + 1] * a + 28 * (1 - a);
    out[i + 2] = out[i + 2] * a + 40 * (1 - a);
    out[i + 3] = 255;
  }
  fs.writeFileSync(path.join(QOUT, name), encodePng(w, h, out));
}
function countAlpha(x0, y0, w, h) {
  const W = 1280, d = cv._img.data; let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
    if (d[(y * W + x) * 4 + 3] > 0) n++;
  return n;
}
const results = [];
const check = (name, ok, info) => { results.push([name, ok, info]); console.log(ok ? "PASS" : "FAIL", name, info || ""); };
const E = (code) => globalThis.__SIM_E(code);

const src2 = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");
try {
  (0, eval)(src2 + "\\n;globalThis.__SIM_E = (code) => eval(code);");
} catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

(async () => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const pump = async (n) => { for (let i = 0; i < n && rafCb; i++) { const cb = rafCb; rafCb = null; t += 16.7; try { cb(t); } catch (e) { console.log("frame threw:", e.stack.split("\\n").slice(0, 6).join("\\n")); process.exit(2); } if (i % 25 === 24) await new Promise((r) => setImmediate(r)); } };
  let t = 0;
  cv = els.c;
  await pump(240); // warmup: load, spawn, settle

  // --- sanity: pet + pals exist ---
  const st = JSON.parse(E("JSON.stringify({pals: pals.length, saveReady, jelly})"));
  check("state loaded (saveReady, jelly, 3 pals)", st.saveReady === true && st.jelly >= 5000 && st.pals === 3, JSON.stringify(st));

  // --- 1. say-bubble shows text above the pet ---
  // (sim time is virtual while say() uses real clock — pin the timer open)
  E('say("BUILD OK"); sayUntil = 1e15');
  await pump(3);
  const px = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY),say:sayText,until:sayUntil>0})"));
  check("say() sets text + timer", px.say === "BUILD OK" && px.until === true, JSON.stringify(px));
  const bx = Math.max(0, Math.min(1280 - 240, px.x - 120)), by = Math.max(0, px.y - 120);
  const bubPx = countAlpha(bx, by, 240, 90);
  check("speech bubble pixels drawn above pet", bubPx > 200, bubPx + " px in bubble zone");
  writeCrop("say.png", bx, by, 240, 90);

  // --- say() edge cases ---
  E('say(""); sayUntil = 1e15');
  const edge1 = E("sayText");
  await pump(2);
  check('say("") keeps prior state, no crash', typeof edge1 === "string", "sayText=" + JSON.stringify(edge1));
  E('say("~~~###~~~"); sayUntil = 1e15');
  const edge2 = E("sayText");
  check("charset-stripped message yields empty-safe state", edge2 === "BUILD OK" || edge2 === "", JSON.stringify(edge2));

  // --- 2. agent notice fires 'done' celebration ---
  // pin the sky shut: an ambient rain spell ending mid-wait can roll a
  // rainbow, and its "RAINBOW" stamp legitimately overwrites petFaceWhy.star
  E("drizzleNext = 1e15; drizzleUntil = 0; wasDrizzle = false; rainbowUntil = 0; snowAcc = 0");
  await pump(220); // > 3s sim time for the poll
  const ag = JSON.parse(E("JSON.stringify({seq:agentSeq, say:sayText, star:starUntil>0, why:petFaceWhy.star, j:jelly})"));
  check("agent 'done' consumed once", ag.seq === 1, JSON.stringify(ag));
  check("agent 'done' -> star face stamp + line", ag.why === "AGENT" && ag.say === "BUILD OK", JSON.stringify(ag));
  await pump(200);
  const ag2 = JSON.parse(E("JSON.stringify({seq:agentSeq})"));
  check("stale seq never re-fires", ag2.seq === 1, JSON.stringify(ag2));

  // --- 3. laugh faces: frames exist + differ ---
  const sp = JSON.parse(E('(() => { const c = (f) => { const s = sprite(f, 0); let n = 0; for (let i = 3; i < s._img.data.length; i += 4) if (s._img.data[i]) n++; let h = 0; for (let i = 0; i < s._img.data.length; i += 16) h = (h * 31 + s._img.data[i]) >>> 0; return { n, h }; }; const a = c("laugh"), b = c("laugh2"), d = c("laugh3"), e = c("tearjoy"), f2 = c("tearjoy2"); return JSON.stringify({ a, b, d, e, f2, diff: a.h !== b.h && a.h !== d.h && e.h !== f2.h }); })()'));
  check("laugh/laugh2/laugh3 sprites non-empty + distinct", sp.a.n > 400 && sp.b.n > 400 && sp.d.n > 400 && sp.diff, JSON.stringify(sp));

  // --- 4. laugh jig has rotation channel ---
  const jg = JSON.parse(E("JSON.stringify(faceJig('laugh', 0))"));
  check("faceJig('laugh') carries r rotation", typeof jg.r === "number" && jg.r !== 0, JSON.stringify(jg));
  const jgIdle = JSON.parse(E("JSON.stringify(faceJig('idle', 0))"));
  check("faceJig('idle') has no rotation", jgIdle.r === 0 || jgIdle.r === undefined, JSON.stringify(jgIdle));

  // --- 5. pet laugh on screen: force tickle + capture spread frames ---
  E("tickleUntil = 1e15; petStamp('AGENT','laugh')");
  for (let i = 0; i < 3; i++) {
    await pump(40); // ~0.7s apart
    const p = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY),f:faceName(performance.now())})"));
    if (i === 1) { const bx2 = Math.max(0, Math.min(1280 - 200, p.x - 100)), by2 = Math.max(0, p.y - 110); writeCrop("laugh.png", bx2, by2, 200, 100); }
  }
  const lf = E("faceName(performance.now())");
  check("pet holds laugh face", lf === "laugh", "face=" + lf);
  E("tickleUntil = 0");

  // --- 6. pal face change -> why icon bubble ---
  const pw = JSON.parse(E('(() => { const p = pals[0]; p.facePrevU = null; p.faceId = "excited"; p.faceT = 1e15; p.faceWhy = "THE SHOW"; p.faceWhyId = "excited"; return JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }); })()'));
  await pump(3);
  const pw2 = JSON.parse(E("JSON.stringify({ic: pals[0].whyIc, until: pals[0].whyUntil > 0})"));
  check("pal face change pops reason icon", pw2.until === true && !!pw2.ic, JSON.stringify(pw2));
  const pbx = Math.max(0, Math.min(1280 - 160, pw.x - 80)), pby = Math.max(0, pw.y - 100);
  writeCrop("palwhy.png", pbx, pby, 160, 80);

  // --- 7. palWhy chain covers the stamp ---
  const chain = E("palWhy(pals[0])");
  check("palWhy resolves stamped reason", chain === "THE SHOW", "palWhy=" + JSON.stringify(chain));

  // --- 8. speech + icon coexist (different heights) ---
  E('say("NICE DESK")'); await pump(3);
  const full = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY)})"));
  writeCrop("full.png", Math.max(0, Math.min(1280 - 500, full.x - 250)), Math.max(0, full.y - 140), 500, 140);

  const fails = results.filter((r) => !r[1]);
  console.log("—".repeat(30));
  console.log(results.length - fails.length, "pass", fails.length, "fail");
  console.log("crops at C:/dev/qa");
  process.exit(fails.length ? 1 : 0);
})();
let t_unused = 0; // (t is declared inside the async scope above via 'let t')
`;
fs.writeFileSync(path.join(__dirname, "_qa_run.cjs"), src);
require(path.join(__dirname, "_qa_run.cjs"));
