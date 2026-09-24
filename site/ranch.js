/* JellyPal hero — one pal, pure interaction. no buttons. */
(function () {
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const cv = document.getElementById("ranch");
if (!cv) return;
const ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;
const off = document.createElement("canvas");
off.width = 48; off.height = 34;
const octx = off.getContext("2d");
let W = 0, H = 0;
const GY = () => H * 0.8;
function resize() {
  const r = cv.getBoundingClientRect();
  W = cv.width = Math.max(120, r.width | 0);
  H = cv.height = Math.max(80, r.height | 0);
}
addEventListener("resize", resize); resize();

/* ---------- fx state ---------- */
const fxs = [], hearts = [], rings = [], jdrops = [], pops = [], specks = [];
function sparkBurst(x, y, col, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 18 + rng(26); fxs.push({ kind: "sp", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 18, life: 34 + rng(18), t: 0, col }); } }
function pop(x, y, txt, col) { pops.push({ x, y, txt, col, t: 0 }); }
function fxAt(x, y, kind, col) { fxs.push({ kind, x: x + rng(14) - 7, y, vx: 0, vy: 0, life: 30 + rng(40), t: 0, col }); }
function ring(x, y, col, r1 = 18) { rings.push({ x, y, col, t: 0, r1 }); }

/* ---------- sky: moon + stars ---------- */
const stars = []; for (let i = 0; i < 10; i++) stars.push({ x: Math.random(), y: Math.random() * 0.5, ph: rng(7) });
function drawMoon(g) {
  const mx = W * 0.87, my = H * 0.15, u = Math.max(1, W / 320);
  g.fillStyle = "rgba(240,238,255,.92)";
  g.fillRect(mx - 4 * u, my - 5 * u, 8 * u, 10 * u); g.fillRect(mx - 5 * u, my - 4 * u, 10 * u, 8 * u);
  g.fillStyle = "rgba(18,14,38,.9)";
  g.fillRect(mx - 4 * u, my - 5 * u, 7 * u, 9 * u); g.fillRect(mx - 5 * u, my - 3 * u, 8 * u, 7 * u);
}

/* ---------- the pal ---------- */
const p = {
  id: "sprout", spIdx: 0, x: 0, y: 0, vx: 0, vy: 0, face: 0, faceT: 0,
  tx: 0, walkT: null, jumpT: 0, scurry: null, blinkCd: 0, blinkFx: 0,
  blink: false, bt: 0, squash: 0, hapT: 0, lvT: 0, stT: 0, slpT: 0,
  held: false, heldT: 0, ph: rng(7),
};
p.spIdx = SPECIES.findIndex(s => s.id === p.id); if (p.spIdx < 0) p.spIdx = 0;
function land() { p.y = GY() - sprite(p.spIdx).h / 2 + 2; }
p.x = W * 0.5; land(); p.tx = W * 0.5;

let jelly = 0;

function boop() {
  if (p.held) return;
  const prof = animProf(p.spIdx);
  p.squash = 1; p.vy = 0.5 + Math.random() * 0.7;
  p.face = prof.glee < 0.3 ? 4 : prof.glee < 0.7 ? 5 : 9;
  p.faceT = 90;
  for (let i = 0; i < 6; i++) hearts.push({ x: p.x + rng(36) - 18, y: p.y - 16 + rng(10), vy: 0.4 + rng(0.5), life: 60, t: 0 });
  if (SPECIES[p.spIdx].r >= 3) sparkBurst(p.x, p.y - 14, "#ffd76a", 12);
}

/* ---------- pointer: look + boop + drag ---------- */
let mx = -999, my = 0;
function toCv(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener("pointermove", e => { [mx, my] = toCv(e); });
cv.addEventListener("pointerleave", () => { mx = -999; });
cv.addEventListener("pointerdown", e => {
  e.preventDefault(); [mx, my] = toCv(e);
  const spr = sprite(p.spIdx);
  if (!p.held && Math.abs(mx - p.x) < spr.w / 2 + 10 && Math.abs(my - p.y) < spr.h / 2 + 12) {
    p.held = true; p.heldT = 0; p.slpT = 0; p.walkT = null; p.scurry = null;
    cv.setPointerCapture(e.pointerId);
  } else boop();
});
cv.addEventListener("pointerup", () => { if (p.held) { p.held = false; p.vy = 1.2; p.face = 4; p.faceT = 70; } });
cv.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boop(); } });

/* typing anywhere → jelly drop flies to counter (game loop, demo speed) */
addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (/input|textarea|select/i.test(e.target && e.target.tagName || "")) return;
  jdrops.push({ x: p.x + rng(70) - 35, y: p.y - 20, tx: 16, ty: 11, t: 0, hit: false });
});

/* ---------- tick ---------- */
let last = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(3, (ts - last) / 16.7 || 1); last = ts;
  const t = ts / 16.7;
  const spr = sprite(p.spIdx), sp = SPECIES[p.spIdx];
  const prof = animProf(p.spIdx), leg = LEG[sp.id];
  const T = dt * (RM ? 0.35 : 1);

  /* ambient fx — same table as product */
  if (sp && !p.held && p.slpT <= 0 && Math.random() < T * 0.05) {
    const bx = p.x, by = p.y - spr.h / 2;
    if (sp.trait === "drip") fxAt(bx, by - 4, "drip", "#7ecbff");
    else if (sp.trait === "spark") fxAt(bx, by, "ember", "#ffb35e");
    else if (sp.trait === "bubble") fxAt(bx, by, "bub", "#bfe8ff");
    else if (sp.trait === "glint" && Math.random() < 0.5) fxAt(bx + rng(20) - 10, by + rng(16) - 8, "glint", prof.glint);
    else if (sp.trait === "wisp") fxAt(bx, by, "mote", "#c88dff");
    else if (sp.trait === "gravity" && Math.random() < 0.4) fxAt(bx, by - rng(12), "mote", "#b28dff");
    if (leg === "starmotes") fxAt(bx, by, "mote", "#ffe98a");
    else if (leg === "embers" && Math.random() < 0.7) fxAt(bx, by, "ember", "#ff9e5e");
    else if (leg === "royal" && Math.random() < 0.4) fxAt(bx + rng(20) - 10, by + rng(10), "glint", "#ffd76a");
    else if (leg === "magmotes" && Math.random() < 0.5) fxAt(bx, by, "mote", "#ff8a5e");
    else if (leg === "notes" && Math.random() < 0.35) fxAt(bx, by - 6, "note", "#8ef0ff");
    else if (leg === "drool" && Math.random() < 0.3) fxAt(bx, p.y, "drip", "#9be89b");
    else if (leg === "orbit" && Math.random() < 0.5) fxAt(bx, by, "mote", "#8ef0ff");
    if (leg === "orbit" && Math.random() < T * 0.008) ring(p.x, p.y - spr.h / 2, "#8ef0ff", 16);
  }
  if (leg === "comettrail" && Math.abs(p.vx) > 1 && Math.random() < T * 0.3) fxAt(p.x - p.vx * 4, p.y, "ember", "#ffc46a");
  if (leg === "goldtrail" && Math.abs(p.vx) > 1 && Math.random() < T * 0.2) fxAt(p.x - p.vx * 4, p.y, "glint", "#ffe9a0");

  /* state */
  if (p.held) {
    p.heldT += T;
    p.x += (mx - p.x) * 0.5 * T; p.y += (my - p.y) * 0.5 * T;
    p.y = Math.min(p.y, GY() - spr.h / 2 + 2);
    p.face = ((p.heldT | 0) % 90 < 45) ? 10 : 11;
    if (sp.id === "spidr" && Math.random() < T * 0.08) sparkBurst(p.x, p.y + 10, "#cfc4f5", 2);
  } else {
    /* gravity */
    p.vy -= 0.055 * T; p.y -= p.vy * T;
    const fl = GY() - spr.h / 2 + 2;
    if (p.y > fl) { p.y = fl; if (p.vy < -1.4) { p.squash = Math.max(p.squash, 0.5); p.vy = 0.4; } else p.vy = 0; }

    /* movement style */
    const onG = p.y >= fl - 1;
    if (sp.mv === "blink") {
      p.blinkCd -= T;
      if (p.blinkCd <= 0 && onG && p.slpT <= 0) {
        sparkBurst(p.x, p.y, "#cdb9ff", 8);
        p.x = 16 + spr.w / 2 + Math.random() * (W - 32 - spr.w);
        sparkBurst(p.x, p.y, "#cdb9ff", 8);
        p.blinkCd = 200 + rng(260); p.blinkFx = 14;
      }
    } else if (sp.mv === "scurry") {
      if (p.scurry != null) {
        p.vx += Math.sign(p.scurry - p.x) * 0.45 * T;
        if (Math.abs(p.scurry - p.x) < 6) p.scurry = null;
      } else if (Math.random() < T * 0.004 && p.slpT <= 0) p.scurry = 20 + Math.random() * (W - 40);
    } else if (p.walkT != null) {
      p.vx += Math.sign(p.tx - p.x) * 0.055 * T;
      if (Math.abs(p.tx - p.x) < 4) { p.walkT = null; p.vx *= 0.3; }
    }
    p.vx *= Math.pow(0.9, T); p.x += p.vx * T;
    p.x = Math.max(14 + spr.w / 2, Math.min(W - 14 - spr.w / 2, p.x));

    /* hop */
    if (sp.mv === "hop" && onG && p.walkT != null && p.vy === 0 && Math.random() < T * 0.06) p.vy = 1.1;
    else if (onG && p.jumpT <= 0 && Math.random() < T * 0.0025 * prof.hopF && p.slpT <= 0) { p.vy = 1.3 + rng(1); p.jumpT = 60 + rng(80); }
    if (p.jumpT > 0) p.jumpT -= T;

    /* wander / sleep */
    if (p.slpT > 0) { p.slpT -= T; if (p.slpT <= 0) { p.face = 0; p.faceT = 0; } }
    else if (p.walkT == null && p.scurry == null && Math.random() < T * 0.004) {
      if (Math.random() < 0.12) { p.slpT = 240 + rng(160); p.face = 8; p.faceT = 9999; }
      else { p.tx = 16 + spr.w / 2 + Math.random() * (W - 32 - spr.w); p.walkT = 1; }
    }
    if (p.blinkFx > 0) p.blinkFx -= T;
  }

  /* face: cursor look + blink */
  if (p.faceT > 0) { p.faceT -= T; if (p.faceT <= 0 && p.slpT <= 0) p.face = 0; }
  else if (!p.held) {
    const dx = mx - p.x;
    p.face = Math.abs(dx) < 7 ? 0 : dx > 0 ? 1 : 2;
  }
  if (p.slpT <= 0 && !p.held) { p.bt -= T; if (p.bt <= 0) { p.bt = 150 + rng(240); p.blink = true; } if (p.blink && p.bt % 12 < T) p.blink = false; }
  if (p.squash > 0) p.squash = Math.max(0, p.squash - 0.05 * T);

  /* ---------- draw ---------- */
  ctx.clearRect(0, 0, W, H);
  drawMoon(ctx);
  for (const s of stars) { const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.02 + s.ph)); ctx.fillStyle = `rgba(230,225,255,${a.toFixed(2)})`; ctx.fillRect(s.x * W | 0, s.y * H | 0, s.ph > 5 ? 2 : 1, s.ph > 5 ? 2 : 1); }
  ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(0, GY() | 0, W, 1);
  ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.fillRect(0, (GY() | 0) + 4, W, 1);

  /* shadow */
  const airH = Math.max(0, (GY() - spr.h / 2 + 2) - p.y);
  const shw = spr.w * 0.34 * Math.max(0.4, 1 - airH / 120);
  ctx.fillStyle = `rgba(0,0,0,${(0.28 * Math.max(0.3, 1 - airH / 140)).toFixed(2)})`;
  ctx.beginPath(); ctx.ellipse(p.x, GY() + 2, shw, 3, 0, 0, 7); ctx.fill();

  /* pal */
  const hov = (sp.mv === "hover" && !p.held) ? Math.sin(t * 0.045 + p.ph) * 2.2 - 3 : 0;
  ctx.save(); ctx.translate(p.x, p.y + hov);
  const sq = p.squash, stretch = p.vy > 0.8 ? Math.min(0.22, p.vy * 0.06) : 0;
  ctx.scale(1 + sq * 0.3 - stretch * 0.5, 1 - sq * 0.24 + stretch);
  if (p.blinkFx > 0) ctx.globalAlpha = Math.max(0.25, p.blinkFx / 14);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, -spr.w / 2 | 0, -spr.h / 2 | 0);
  ctx.restore();

  /* wings + orbit ring above pal */
  if (!p.held && p.slpT <= 0 && (leg === "wings" || leg === "wingsgold")) {
    const wimg = wingImg(leg === "wings" ? 0 : 1, (t * 0.12 | 0) % 3);
    const sc = 0.8, wy = p.y + hov - spr.h / 2 + 4;
    ctx.drawImage(wimg, p.x - spr.w / 2 - wimg.width * sc + 4, wy, wimg.width * sc, wimg.height * sc);
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(wimg, -(p.x + spr.w / 2 - 4), wy, wimg.width * sc, wimg.height * sc); ctx.restore();
  }
  if (sp.id === "spidr" && p.held) {
    ctx.strokeStyle = "#3d3655"; ctx.lineWidth = 2;
    for (let s2 = -1; s2 <= 1; s2 += 2) for (let l = 0; l < 4; l++) {
      const wig = Math.sin(t * 0.35 + l) * 4;
      ctx.beginPath(); ctx.moveTo(p.x + s2 * spr.w * 0.3, p.y + 4 + l * 3);
      ctx.quadraticCurveTo(p.x + s2 * (spr.w * 0.3 + 8), p.y + 8 + l * 3 + wig, p.x + s2 * (spr.w * 0.3 + 12), p.y + 14 + l * 3 + wig); ctx.stroke();
    }
  }

  /* hearts / zzz */
  for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i]; h.t += T; h.y -= h.vy * T; if (h.t > h.life) { hearts.splice(i, 1); continue; } ctx.globalAlpha = 1 - h.t / h.life; ctx.fillStyle = "#ff8fb3"; ctx.font = "10px monospace"; ctx.fillText("♥", h.x, h.y); }
  if (p.slpT > 0 && Math.floor(t / 30) % 2 === 0) { ctx.globalAlpha = 0.7; ctx.fillStyle = "#aab3ff"; ctx.font = "10px monospace"; ctx.fillText("z", p.x + 12, p.y - spr.h / 2 - 8 - (t % 30) * 0.3); }
  ctx.globalAlpha = 1;

  /* fx particles */
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]; f.t += T;
    if (f.t > f.life) { fxs.splice(i, 1); continue; }
    const a = 1 - f.t / f.life;
    ctx.globalAlpha = a; ctx.fillStyle = f.col;
    if (f.kind === "drip") { f.y += 0.35 * T; ctx.fillRect(f.x | 0, f.y | 0, 2, 3); }
    else if (f.kind === "ember" || f.kind === "mote") { f.y -= 0.4 * T; f.x += Math.sin(t * 0.1 + i) * 0.3 * T; ctx.fillRect(f.x | 0, f.y | 0, 2, 2); }
    else if (f.kind === "bub") { f.y -= 0.5 * T; ctx.strokeStyle = f.col; ctx.strokeRect(f.x | 0, f.y | 0, 3, 3); }
    else if (f.kind === "glint") { ctx.font = "8px monospace"; ctx.fillText("✦", f.x, f.y); }
    else if (f.kind === "note") { f.y -= 0.5 * T; ctx.font = "9px monospace"; ctx.fillText("♪", f.x, f.y); }
    else { f.x += f.vx * T * 0.05; f.y += f.vy * T * 0.05; f.vy += 0.4 * T; ctx.fillRect(f.x | 0, f.y | 0, 2, 2); }
  }
  ctx.globalAlpha = 1;
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += T; if (r.t > 30) { rings.splice(i, 1); continue; } ctx.globalAlpha = (1 - r.t / 30) * 0.6; ctx.strokeStyle = r.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, 4 + (r.r1 - 4) * (r.t / 30), 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;

  /* jelly drops → counter */
  for (let i = jdrops.length - 1; i >= 0; i--) {
    const j = jdrops[i]; j.t += T * 0.045;
    if (j.t >= 1) { jdrops.splice(i, 1); if (!j.hit) { jelly++; sparkBurst(j.tx + 8, j.ty + 6, "#9dffc4", 5); pop(j.tx + 12, j.ty + 4, "+1", "#9dffc4"); } continue; }
    const e = j.t * j.t;
    const jx = j.x + (j.tx - j.x) * e, jy = j.y + (j.ty - j.y) * e - Math.sin(j.t * Math.PI) * 18;
    ctx.drawImage(jellyImg(), jx - 4, jy - 4, 8, 8);
  }
  ctx.font = "8px 'Press Start 2P',monospace"; ctx.textBaseline = "top";
  ctx.drawImage(jellyImg(), 8, 8, 11, 11);
  ctx.fillStyle = "#9dffc4"; ctx.fillText("JELLY " + jelly, 24, 10);

  /* pops + specks */
  for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.t += T; if (q.t > 50) { pops.splice(i, 1); continue; } ctx.globalAlpha = 1 - q.t / 50; ctx.fillStyle = q.col; ctx.font = "8px 'Press Start 2P',monospace"; ctx.fillText(q.txt, q.x, q.y - q.t * 0.5); }
  ctx.globalAlpha = 1;
  if (!RM && Math.random() < 0.03 && specks.length < 10) specks.push({ x: Math.random() * W, y: GY() - rng(40), t: 0 });
  for (let i = specks.length - 1; i >= 0; i--) { const s = specks[i]; s.t += T; if (s.t > 140) { specks.splice(i, 1); continue; } ctx.fillStyle = `rgba(200,190,255,${(0.1 * (1 - s.t / 140)).toFixed(2)})`; ctx.fillRect(s.x + Math.sin(s.t * 0.02) * 6, s.y - s.t * 0.15, 1, 1); }

  /* ---------- paint pal sprite into offscreen ---------- */
  let face = p.face;
  if (p.blink && (face === 0 || face === 1 || face === 2)) face = 3;
  octx.clearRect(0, 0, 48, 34);
  drawPal(octx, p.spIdx, 0, 0, face, true);
}

/* ---------- helpers ---------- */
function fit(img, dw, dh) {
  const s = Math.min(dw / img.width, dh / img.height);
  const w = img.width * s | 0 || 1, h = img.height * s | 0 || 1;
  return [(dw - w) / 2 | 0, (dh - h) / 2 | 0, w, h];
}
function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawStar(g, cx, cy, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill(); }

/* ---------- section icons (real game sprites) ---------- */
document.querySelectorAll(".hico").forEach(c => {
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  const k = c.dataset.hico;
  if (k === "jelly") g.drawImage(jellyImg(), ...fit(jellyImg(), 20, 20));
  else if (k === "jar" || k === "mirror" || k === "cushion") { const im = sprImg(k); g.drawImage(im, ...fit(im, 22, 18)); }
  else { const i = SPECIES.findIndex(s => s.id === k); if (i >= 0) { const im = sprite(i); g.drawImage(im, ...fit(im, 24, 18)); } }
});
document.querySelectorAll("[data-lico]").forEach(c => {
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  const k = c.dataset.lico;
  const im = k === "jelly" ? jellyImg() : sprite(SPECIES.findIndex(s => s.id === k));
  g.drawImage(im, ...fit(im, 26, 22));
});
const jp = document.getElementById("jellypic");
if (jp) { const g = jp.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(jellyImg(), ...fit(jellyImg(), 34, 34)); }

/* ---------- dex (compendium) ---------- */
const dexgrid = document.getElementById("dexgrid");
const dexcells = [];
if (dexgrid) {
  const FEATURED = ["mochi", "sprout", "pep", "drop", "berry", "frog", "beebop", "toxi", "ghoo", "magma", "goldie", "stella"];
  let rarF = null, showAll = false;
  function cell(i, big) {
    const d = document.createElement("div"); d.className = "dexcell r" + SPECIES[i].r;
    if (big) d.classList.add("big");
    d.tabIndex = 0; d.setAttribute("role", "button");
    d.setAttribute("aria-label", SPECIES[i].n + " — " + RARITY_COLOR[SPECIES[i].r][1] + " pal");
    const c = document.createElement("canvas"); c.width = big ? 48 : 34; c.height = big ? 36 : 28;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    const im = sprite(i); const f = fit(im, c.width - 4, c.height - (big ? 6 : 4));
    g.drawImage(im, f[0], f[1] - (big ? 4 : 0), f[2], f[3]);
    d.appendChild(c);
    const nm = document.createElement("span"); nm.textContent = SPECIES[i].n; d.appendChild(nm);
    const tg = document.createElement("i"); tg.textContent = RARITY_COLOR[SPECIES[i].r][1]; tg.style.color = RARITY_COLOR[SPECIES[i].r][0]; d.appendChild(tg);
    if (SPECIES[i].sig) { const sg = document.createElement("b"); sg.textContent = "◆ SIG"; d.appendChild(sg); }
    dexcells[i] = { el: d, t: 0 };
    d.addEventListener("click", () => dexreact(i));
    d.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dexreact(i); } });
    return d;
  }
  function dexreact(i) {
    const dc = dexcells[i]; if (!dc) return;
    dc.t = 18;
    const c = dc.el.querySelector("canvas"), g = c.getContext("2d"), im = sprite(i);
    const face = [4, 5, 9][i % 3];
    const f = fit(im, c.width - 4, c.height - (c.width > 40 ? 6 : 4));
    const anim = () => {
      dc.t -= 1;
      g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
      const sq = dc.t > 9 ? (dc.t - 9) / 9 * 0.3 : 0;
      const hop = dc.t > 0 ? Math.sin(dc.t / 18 * Math.PI) * 5 : 0;
      g.save(); g.translate(c.width / 2, c.height - (c.width > 40 ? 6 : 4) - hop);
      g.scale(1 + sq, 1 - sq * 0.7);
      drawPal(g, i, 0, 0, dc.t > 0 ? face : 0, true);
      g.restore();
      if (dc.t > 0) requestAnimationFrame(anim);
      else { g.clearRect(0, 0, c.width, c.height); g.drawImage(im, f[0], f[1] - (c.width > 40 ? 4 : 0), f[2], f[3]); }
    };
    anim();
  }
  function dexrender() {
    dexgrid.innerHTML = "";
    let idx = SPECIES.map((_, i) => i);
    if (rarF != null) idx = idx.filter(i => SPECIES[i].r === rarF);
    else if (!showAll) { const f = FEATURED.map(id => SPECIES.findIndex(s => s.id === id)).filter(i => i >= 0); idx = f; }
    idx.forEach(i => dexgrid.appendChild(cell(i, FEATURED.includes(SPECIES[i].id) && rarF == null)));
    dexgrid.classList.toggle("feat", rarF == null && !showAll);
    const mb = document.getElementById("dexmore"); if (mb) mb.hidden = rarF != null || showAll;
  }
  document.querySelectorAll(".dfbtn").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".dfbtn").forEach(x => x.classList.toggle("on", x === b));
    rarF = b.dataset.r === "" ? null : +b.dataset.r; showAll = false; dexrender();
  }));
  const mb = document.getElementById("dexmore");
  if (mb) mb.addEventListener("click", () => { showAll = true; dexrender(); });
  dexrender();
}

requestAnimationFrame(tick);
})();
