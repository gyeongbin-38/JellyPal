// ranch.js — interactive Jellypal ranch for the site hero.
// Real sprites (pals.js) + real behavior seeds (animProf) + the game's
// pull weight table. Cursor-tracking faces, boops, hops, sleep, hearts,
// and a working gacha pull that adds the pal to the ranch.

(function () {
  const cv = document.getElementById("ranch");
  if (!cv || typeof SPECIES === "undefined") return;
  const cx = cv.getContext("2d");
  cx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, GY = 248, SC = 1.75;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PX = '"Press Start 2P", monospace';

  // ---- pals on the ranch: a spread across rarities ----
  const STARTERS = ["sprout", "berry", "mochi", "kitty", "aurora", "gold", "stella"];
  const pals = [];
  function addPal(id, x) {
    const spIdx = spIndex(id);
    pals.push({
      spIdx, x: x ?? 40 + Math.random() * (W - 80), y: 0, vy: 0,
      vx: (Math.random() - .5) * 14,           // px/s wander
      face: "idle", faceT: 0,
      blinkT: animProf(spIdx).blink * Math.random(),
      sq: 0, hopT: 2 + Math.random() * 7,
      sleepT: 14 + Math.random() * 20, sleeping: 0,
      lookT: 0,
    });
  }
  STARTERS.forEach((id, i) => addPal(id, 55 + i * 78));

  // ---- particles: pixel hearts, zzz, text bangs ----
  const hearts = [], zzzs = [], bangs = [];
  const HEART = ["0110110","1111111","1111111","0111110","0011100","0001000"];
  function drawHeart(c, x, y, s, a) {
    c.globalAlpha = a; c.fillStyle = "#ff8fb0";
    for (let r = 0; r < HEART.length; r++)
      for (let i = 0; i < 7; i++)
        if (HEART[r][i] === "1") c.fillRect(x + i * s, y + r * s, s, s);
    c.globalAlpha = 1;
  }
  let jelly = 0;

  // ---- cursor: pals track it with real look faces ----
  let mx = -999;
  cv.addEventListener("mousemove", (e) => {
    const r = cv.getBoundingClientRect();
    mx = (e.clientX - r.left) * (W / r.width);
  });
  cv.addEventListener("mouseleave", () => { mx = -999; });

  // ---- boop ----
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect();
    const bx = (e.clientX - r.left) * (W / r.width);
    const by = (e.clientY - r.top) * (H / r.height);
    for (const p of pals) {
      const w2 = 36 * SC / 2 + 6, h2 = 26 * SC;
      if (bx > p.x - w2 && bx < p.x + w2 && by > GY - h2 - p.y - 10 && by < GY + 8) {
        const prof = animProf(p.spIdx);
        p.face = prof.glee > 0.5 ? "love" : "happy";
        p.faceT = 1.3;
        p.sq = 0.34;
        p.vy = 120 + Math.random() * 60;
        p.sleeping = 0;
        for (let i = 0; i < 3; i++)
          hearts.push({ x: p.x - 8 + i * 8, y: GY - 26 * SC - 14, vy: -34 - i * 8, life: 1 });
        return;
      }
    }
  });

  // ---- the pull: real gacha weights, silhouette reveal ----
  const pullBtn = document.getElementById("pull");
  let pull = null; // {spIdx, t}
  const POOL = SPECIES.map((s, i) => ({ s, i })).filter(({ s }) => !s.season);
  function roll() {
    const pool = POOL.filter(({ s }) => true);
    const tot = pool.reduce((a, { s }) => a + RARITY_W[s.r], 0);
    let r = Math.random() * tot;
    for (const { s, i } of pool) { r -= RARITY_W[s.r]; if (r <= 0) return i; }
    return 0;
  }
  if (pullBtn) pullBtn.addEventListener("click", () => {
    if (pull) return;
    pull = { spIdx: roll(), t: 0 };
  });

  // ---- tick ----
  let t0 = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - t0) / 1000 || 0.016); t0 = now;
    cx.clearRect(0, 0, W, H);

    // ground
    cx.fillStyle = "#1a1440";
    cx.fillRect(0, GY + 6, W, 8);
    cx.fillStyle = "rgba(143,232,192,.08)";
    cx.fillRect(0, GY + 6, W, 2);

    // jelly counter
    cx.font = `8px ${PX}`;
    cx.fillStyle = "#8fe8c0";
    cx.fillText("JELLY " + jelly, 14, 24);

    for (const p of pals) {
      const prof = animProf(p.spIdx);

      // sleep cycle
      if (!reduce && !p.sleeping) {
        p.sleepT -= dt;
        if (p.sleepT <= 0) { p.sleeping = 5 + Math.random() * 4; p.sleepT = 16 + Math.random() * 22; }
      }
      if (p.sleeping > 0) {
        p.sleeping -= dt;
        if (Math.random() < dt * 1.4)
          zzzs.push({ x: p.x + 18, y: GY - 26 * SC - 8, vy: -16, life: 1.6 });
      }

      // wander + hops
      if (!p.sleeping) {
        if (!reduce && Math.random() < dt * 0.25) p.vx = (Math.random() - .5) * 20;
        p.x += p.vx * dt;
        const half = 18 * SC;
        if (p.x < half + 6) p.vx = Math.abs(p.vx);
        if (p.x > W - half - 6) p.vx = -Math.abs(p.vx);
        p.hopT -= dt * (reduce ? 0 : 1);
        if (p.hopT <= 0 && p.y === 0) {
          p.vy = 120 + 110 * prof.hop; p.hopT = 3 + Math.random() * 8;
        }
      }
      if (p.y > 0 || p.vy > 0) {
        p.y += p.vy * dt;
        p.vy -= 420 * dt;
        if (p.y <= 0) { p.y = 0; if (p.vy < -80) p.sq = 0.3; p.vy = 0; }
      }
      p.sq *= Math.pow(0.02, dt);

      // face selection
      p.faceT -= dt;
      if (p.faceT <= 0) {
        p.blinkT -= dt * 1000;
        if (p.sleeping > 0) p.face = "sleeping";
        else if (p.blinkT <= 0) { p.face = "blink"; p.faceT = prof.blinkLen / 1000; p.blinkT = prof.blink; }
        else if (mx > -900) p.face = mx < p.x - 30 ? "lookL" : mx > p.x + 30 ? "lookR" : "idle";
        else p.face = "idle";
      }

      // breathing squash
      const br = reduce ? 0 : Math.sin(now / 600 * prof.breathe) * 0.03;
      const sx = 1 + p.sq - br * 0.4, sy = 1 - p.sq * 0.8 + br;
      const spr = sprite(p.face, p.spIdx);
      const pw = SW * SC * sx, ph = SH * SC * sy;
      cx.drawImage(spr, 0, 0, SW * 2, SH * 2, p.x - pw / 2, GY - ph - p.y, pw, ph);
    }

    // particles
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.y += h.vy * dt; h.life -= dt;
      if (h.life <= 0) { hearts.splice(i, 1); continue; }
      drawHeart(cx, h.x, h.y, 2.2, Math.min(1, h.life * 1.4));
    }
    for (let i = zzzs.length - 1; i >= 0; i--) {
      const z = zzzs[i]; z.y += z.vy * dt; z.life -= dt;
      if (z.life <= 0) { zzzs.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, z.life);
      cx.font = `9px ${PX}`; cx.fillStyle = "#9c92d0";
      cx.fillText("z", z.x, z.y);
      cx.globalAlpha = 1;
    }

    // ---- pull sequence ----
    if (pull) {
      pull.t += dt;
      const sp = SPECIES[pull.spIdx];
      const dim = pull.t < 1 ? Math.min(0.55, pull.t) : Math.max(0, 0.55 - (pull.t - 1) * 2);
      cx.fillStyle = `rgba(10,8,26,${dim})`;
      cx.fillRect(0, 0, W, H);
      const cxp = W / 2, grow = Math.min(1, pull.t / 0.8);
      const wob = reduce ? 0 : Math.sin(pull.t * 22) * 3 * (1 - grow);
      if (pull.t < 1) {
        // silhouette rising
        const sil = sprite("idle", pull.spIdx, true);
        const s = SC * 1.6 * (0.5 + grow * 0.5);
        cx.globalAlpha = Math.min(1, grow * 1.5);
        cx.drawImage(sil, 0, 0, SW * 2, SH * 2, cxp - SW * s / 2 + wob, GY - SH * s - 40 * grow, SW * s, SH * s);
        cx.globalAlpha = 1;
      } else {
        // reveal
        if (pull.t - dt < 1) {
          bangs.push({ x: cxp, y: 70, life: 1.6, t: `+ ${sp.name.toUpperCase()}!`, c: RARITY_COLOR[sp.r] });
          if (pals.length < 10 && !pals.some((p) => p.spIdx === pull.spIdx)) {
            addPal(sp.id, cxp);
            const np = pals[pals.length - 1];
            np.face = "star"; np.faceT = 1.6; np.vy = 170;
          } else {
            jelly += 20;
            bangs.push({ x: cxp, y: 92, life: 1.6, t: "DUP +20 JELLY", c: "#8fe8c0" });
          }
        }
        const real = sprite("star", pull.spIdx);
        const s = SC * 1.6;
        const pop = 1 + Math.max(0, 0.25 - (pull.t - 1)) * 0.8;
        cx.drawImage(real, 0, 0, SW * 2, SH * 2, cxp - SW * s * pop / 2, GY - SH * s * pop - 40, SW * s * pop, SH * s * pop);
        if (pull.t > 1.9) pull = null;
      }
    }
    for (let i = bangs.length - 1; i >= 0; i--) {
      const b = bangs[i]; b.y -= 14 * dt; b.life -= dt;
      if (b.life <= 0) { bangs.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, b.life);
      cx.font = `9px ${PX}`; cx.textAlign = "center";
      cx.fillStyle = b.c || "#ece8fb";
      cx.fillText(b.t, b.x, b.y);
      cx.textAlign = "left"; cx.globalAlpha = 1;
    }
  }
  requestAnimationFrame(tick);

  // ---- species strip: real sprites ----
  const strip = document.getElementById("strip");
  if (strip) {
    SPECIES.forEach((sp, i) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.style.borderLeft = "3px solid " + RARITY_COLOR[sp.r];
      const cnv = document.createElement("canvas");
      cnv.width = 48; cnv.height = 36; cnv.className = "mini";
      const cc = cnv.getContext("2d");
      cc.imageSmoothingEnabled = false;
      const s = 0.68;
      cc.drawImage(sprite("idle", i), 0, 0, SW * 2, SH * 2, 24 - SW * s, 35 - SH * s, SW * 2 * s, SH * 2 * s);
      const label = document.createElement("div");
      label.innerHTML = `${sp.name}<small>${RARITY_NAME[sp.r].toLowerCase()}${sp.season ? " · seasonal" : ""}</small>`;
      chip.append(cnv, label);
      strip.appendChild(chip);
    });
  }

  // ---- pack icons: real pals per tier ----
  const PACK_SP = ["sprout", "berry", "gold", "stella"];
  document.querySelectorAll(".jellypic").forEach((el, i) => {
    const cc = el.getContext("2d");
    cc.imageSmoothingEnabled = false;
    const idx = spIndex(PACK_SP[i] || "sprout");
    const s = 0.62;
    cc.drawImage(sprite("idle", idx), 0, 0, SW * 2, SH * 2, el.width / 2 - SW * s, el.height - 2 - SH * s, SW * 2 * s, SH * 2 * s);
  });
})();
