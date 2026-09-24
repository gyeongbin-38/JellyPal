// ranch.js — interactive Jellypal ranch for the site hero.
// Real sprites (pals.js) + real behavior seeds (animProf) + the game's
// pull weight table. Product-parity interactions: pals watch the cursor,
// boop them, pick them up (held faces), drop a treat to feed them
// (munch/chew + crumbs), and type anywhere — they snack on keystrokes
// and squirt jelly into the counter, exactly like the real app.

(function () {
  const cv = document.getElementById("ranch");
  if (!cv || typeof SPECIES === "undefined") return;
  const cx = cv.getContext("2d");
  cx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, GY = 248, SC = 1.75;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PX = '"Press Start 2P", monospace';
  cv.tabIndex = 0;

  // ---- pals on the ranch: a spread across rarities ----
  const STARTERS = ["sprout", "berry", "mochi", "kitty", "aurora", "gold", "stella"];
  const pals = [];
  function addPalIdx(spIdx, x) {
    pals.push({
      spIdx, x: x ?? 40 + Math.random() * (W - 80), y: 0, vy: 0,
      vx: (Math.random() - .5) * 14,
      face: "idle", faceT: 0,
      blinkT: animProf(spIdx).blink * Math.random(),
      sq: 0, hopT: 2 + Math.random() * 7,
      sleepT: 14 + Math.random() * 20, sleeping: 0,
      held: false, heldF: 0, eatT: 0, eatPhase: 0, scurry: null,
      ph: Math.random() * 6.28, burstT: 4 + Math.random() * 10, tpT: 6 + Math.random() * 12,
      ambT: Math.random() * 3, ringT: 4 + Math.random() * 6,
      acc: null, goal: null, napOn: null, picked: false,
    });
    return pals[pals.length - 1];
  }
  const addPal = (id, x) => addPalIdx(spIndex(id), x);
  STARTERS.forEach((id, i) => addPal(id, 55 + i * 78));

  // ---- placed props: {kind -> {x}} on the ground line ----
  const props = {};
  const PROP_X = { cushion: 100, mat: 290, jar: 470, plant: 560 };
  const GOALABLE = { cushion: 1, plant: 1, jar: 1 }; // mat is a trampoline, not a destination
  const propBtn = {};
  document.querySelectorAll("[data-prop]").forEach((b) => {
    propBtn[b.dataset.prop] = b;
    b.addEventListener("click", () => {
      const k = b.dataset.prop;
      if (props[k]) { delete props[k]; b.classList.remove("on"); return; }
      props[k] = { x: PROP_X[k], t: 0 };
      b.classList.add("on");
      // someone notices the new furniture and wanders over
      if (GOALABLE[k]) {
        const awake = pals.filter((p) => !p.sleeping && !p.held && !p.goal && !p.napOn);
        if (awake.length) {
          const p = awake[Math.floor(Math.random() * awake.length)];
          setTimeout(() => { if (!p.napOn && props[k]) { p.goal = { kind: k, x: props[k].x }; p.scurry = p.goal.x; } }, 700 + Math.random() * 1400);
        }
      }
    });
  });

  // ---- accessory bar: click to dress the pal nearest the cursor ----
  let targetPal = pals[0];
  const accBtns = {};
  document.querySelectorAll("[data-acc]").forEach((b) => {
    accBtns[b.dataset.acc] = b;
    b.addEventListener("click", () => {
      const id = b.dataset.acc, p = targetPal || pals[0];
      if (!p) return;
      p.acc = p.acc === id ? null : id;
      p.face = "happy"; p.faceT = 0.9; p.sq = 0.25;
      hearts.push({ x: p.x - 4, y: GY - 26 * SC - 16 - p.y, vy: -36, life: 1 });
    });
  });

  // ---- particles: pixel hearts, zzz, text bangs, jelly drops, crumbs ----
  const hearts = [], zzzs = [], bangs = [], drops = [], crumbs = [], treats = [], specks = [], fxs = [], rings = [];
  const HEART = ["0110110","1111111","1111111","0111110","0011100","0001000"];
  const JDROP = ["..b..", ".bbb.", "bbbbb", "bbbbb", ".bbb.", "..b.."];
  const TREAT = ["..w...", ".kkk..", "kkkkk.", "kkkkk.", "wwwww."];
  function drawMap(c, map, x, y, s, col) {
    c.fillStyle = col;
    for (let r = 0; r < map.length; r++)
      for (let i = 0; i < map[r].length; i++)
        if (map[r][i] !== ".") {
          c.fillStyle = map[r][i] === "w" ? "#fff" : col;
          c.fillRect(x + i * s, y + r * s, s, s);
        }
  }
  for (let i = 0; i < 16; i++)
    specks.push({ x: Math.random() * W, y: 10 + Math.random() * 200, s: 1 + Math.random() * 2, v: 2 + Math.random() * 5, a: 0.04 + Math.random() * 0.08 });

  let jelly = 0, jellyPulse = 0, keys = 0;

  // ---- cursor tracking + drag ----
  let mx = -999, my = -999, heldPal = null;
  const toCv = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  };
  cv.addEventListener("mousemove", (e) => { [mx, my] = toCv(e); });
  cv.addEventListener("mouseleave", () => { mx = my = -999; });
  function palAt(bx, by) {
    for (let i = pals.length - 1; i >= 0; i--) {
      const p = pals[i], w2 = 18 * SC + 6, h2 = 26 * SC;
      if (bx > p.x - w2 && bx < p.x + w2 && by > GY - h2 - p.y - 10 && by < GY - p.y + 8) return p;
    }
    return null;
  }
  cv.addEventListener("pointerdown", (e) => {
    const [bx, by] = toCv(e);
    const p = palAt(bx, by);
    if (p && !p.sleeping && !p.eatT) {
      heldPal = p; p.held = true; p.heldF = 0; p.vy = 0; p.vx = 0;
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  cv.addEventListener("pointermove", (e) => {
    [mx, my] = toCv(e);
    if (heldPal) heldPal.x = Math.max(30, Math.min(W - 30, mx));
    // dress-up targets the pal under the cursor
    let best = null, bd = 70;
    for (const p of pals) {
      const d = Math.hypot(p.x - mx, (GY - 24 - p.y) - my);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) targetPal = best;
  });
  const release = () => {
    if (!heldPal) return;
    heldPal.held = false;
    heldPal.y = Math.max(heldPal.y, 30);
    heldPal.vy = 40;
    heldPal.face = "content"; heldPal.faceT = 0.8;
    heldPal = null;
  };
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", release);

  // ---- boop on click (only when it wasn't a drag) ----
  let downXY = null;
  cv.addEventListener("pointerdown", (e) => { downXY = toCv(e); });
  cv.addEventListener("click", (e) => {
    const [bx, by] = toCv(e);
    if (downXY && Math.hypot(bx - downXY[0], by - downXY[1]) > 8) return; // was a drag
    const p = palAt(bx, by);
    if (!p) return;
    // breed pick mode: tag parents instead of booping
    if (breedPicking) {
      if (!p.picked && breedSel.length < 2) {
        p.picked = true; breedSel.push(p);
        hearts.push({ x: p.x - 4, y: GY - 26 * SC - 18 - p.y, vy: -36, life: 1.2 });
        if (breedSel.length === 2) startBreed();
      }
      return;
    }
    const prof = animProf(p.spIdx);
    p.face = prof.glee > 0.5 ? "love" : "happy";
    p.faceT = 1.3; p.sq = 0.34;
    if (!p.held) p.vy = 120 + Math.random() * 60;
    p.sleeping = 0;
    for (let i = 0; i < 3; i++)
      hearts.push({ x: p.x - 8 + i * 8, y: GY - 26 * SC - 14 - p.y, vy: -34 - i * 8, life: 1 });
  });
  cv.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    const p = pals[Math.floor(Math.random() * pals.length)];
    if (!p || p.sleeping) return;
    p.face = "love"; p.faceT = 1.2; p.sq = 0.3; p.vy = 110;
    hearts.push({ x: p.x - 4, y: GY - 26 * SC - 14 - p.y, vy: -40, life: 1 });
  });

  // ---- feed: drop a treat, a pal scurries over and eats it ----
  const feedBtn = document.getElementById("feed");
  function jellyDrop(fromX, amt) {
    drops.push({ x: fromX, y: GY - 26 * SC - 10, t: 0, amt });
  }
  if (feedBtn) feedBtn.addEventListener("click", () => {
    if (treats.length >= 2) return;
    const tx = 60 + Math.random() * (W - 120);
    treats.push({ x: tx, y: -20, vy: 0 });
    // nearest free pal goes for it
    let best = null, bd = 1e9;
    for (const p of pals)
      if (!p.sleeping && !p.held && !p.eatT && !p.scurry) {
        const d = Math.abs(p.x - tx);
        if (d < bd) { bd = d; best = p; }
      }
    if (best) best.scurry = tx;
  });

  // ---- typing feeds the ranch — the real product loop, live ----
  addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key.length > 1) return;
    keys++;
    const awake = pals.filter((p) => !p.sleeping && !p.held);
    if (!awake.length) return;
    const p = awake[Math.floor(Math.random() * awake.length)];
    if (Math.random() < 0.3 && !p.eatT) { p.face = "happy"; p.faceT = 0.4; }
    if (keys % 12 === 0) jellyDrop(p.x, 1);   // demo rate: every 12 keys (game: 600)
  });

  // ---- breed: pick two pals, they meet, an egg hatches a hybrid ----
  const breedBtn = document.getElementById("breed");
  let breedPicking = false, breedSel = [], breeding = null;
  if (breedBtn) breedBtn.addEventListener("click", () => {
    if (breedPicking || breeding) return;
    if (jelly < 20) {
      breedBtn.textContent = "need 20 jelly — type!";
      setTimeout(() => { breedBtn.textContent = "breed ♥ 20"; }, 1600);
      return;
    }
    breedPicking = true; breedSel = [];
    breedBtn.classList.add("on"); breedBtn.textContent = "pick 2 pals…";
  });
  function startBreed() {
    breedPicking = false;
    breeding = { t: 0, phase: 0, a: breedSel[0], b: breedSel[1], child: null };
    breedBtn.classList.remove("on"); breedBtn.textContent = "breed ♥ 20";
  }

  // ---- the pull: real gacha weights, silhouette reveal ----
  const pullBtn = document.getElementById("pull");
  let pull = null;
  const POOL = SPECIES.map((s, i) => ({ s, i })).filter(({ s }) => !s.season);
  function roll() {
    const tot = POOL.reduce((a, { s }) => a + RARITY_W[s.r], 0);
    let r = Math.random() * tot;
    for (const { s, i } of POOL) { r -= RARITY_W[s.r]; if (r <= 0) return i; }
    return 0;
  }
  if (pullBtn) pullBtn.addEventListener("click", () => { if (!pull) pull = { spIdx: roll(), t: 0 }; });

  // ---- tick ----
  let t0 = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - t0) / 1000 || 0.016); t0 = now;
    cx.clearRect(0, 0, W, H);

    // 2.5D: faint drifting specks behind everything, pals stay crisp
    for (const s of specks) {
      s.x += s.v * dt;
      if (s.x > W) s.x = -4;
      cx.globalAlpha = s.a;
      cx.fillStyle = "#a9d8f7";
      cx.fillRect(s.x, s.y, s.s, s.s);
    }
    cx.globalAlpha = 1;

    // ground
    cx.fillStyle = "#1a1440";
    cx.fillRect(0, GY + 6, W, 8);
    cx.fillStyle = "rgba(143,232,192,.08)";
    cx.fillRect(0, GY + 6, W, 2);

    // jelly counter
    jellyPulse = Math.max(0, jellyPulse - dt * 3);
    cx.font = `8px ${PX}`;
    cx.fillStyle = jellyPulse > 0 ? "#fff" : "#8fe8c0";
    cx.fillText("JELLY " + jelly, 14, 24);
    drawMap(cx, JDROP, 74, 15, 1.4 + jellyPulse * 0.6, "#8fe8c0");

    // night sky: moon + twinkling stars (specks already drift below)
    cx.fillStyle = "#f0ead0";
    cx.beginPath(); cx.arc(W - 60, 42, 16, 0, 7); cx.fill();
    cx.fillStyle = "#0f0b26";
    cx.beginPath(); cx.arc(W - 54, 38, 14, 0, 7); cx.fill();
    for (let i = 0; i < 10; i++) {
      const tw = reduce ? 0.6 : 0.35 + 0.3 * Math.sin(now / 400 + i * 2.1);
      cx.globalAlpha = tw;
      cx.fillStyle = "#e8f0ff";
      cx.fillRect(30 + ((i * 137) % (W - 120)), 16 + ((i * 61) % 90), 2, 2);
    }
    cx.globalAlpha = 1;

    // placed props sit on the ground line, popping in
    for (const k in props) {
      const pr = props[k]; pr.t += dt;
      const img = sprImg(k);
      if (!img) continue;
      const pop = Math.min(1, pr.t * 3.5);
      const syq = (k === "cushion" && pr.occupied) ? 0.75 : 1;
      const s = 2.6 * (0.6 + 0.4 * pop);
      cx.drawImage(img, 0, 0, img.width, img.height,
        Math.round(pr.x - img.width * s / 2), Math.round(GY + 6 - img.height * s * syq),
        img.width * s, img.height * s * syq);
    }

    // treats falling / on the ground
    for (let i = treats.length - 1; i >= 0; i--) {
      const tr = treats[i];
      if (tr.y < GY - 6) { tr.vy += 500 * dt; tr.y = Math.min(GY - 6, tr.y + tr.vy * dt); }
      const bob = tr.y >= GY - 6 && !reduce ? Math.sin(now / 300) * 1.5 : 0;
      drawMap(cx, TREAT, tr.x - 8, tr.y - 16 + bob, 2, "#ff9ec6");
    }

    for (const p of pals) {
      const prof = animProf(p.spIdx);

      // held: dangle + flail frames
      if (p.held) {
        p.heldF += dt;
        p.face = (p.heldF % 0.5) < 0.25 ? "held1" : "held2";
        p.faceT = 99;
        p.y = 60 + Math.sin(p.heldF * 6) * 4;
      } else {
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

        // scurry toward a treat or a furniture goal
        if (p.scurry != null) {
          const dx = p.scurry - p.x;
          if (Math.abs(dx) < 16) {
            p.scurry = null; p.vx = 0;
            if (p.goal && p.goal.kind === "cushion" && props.cushion) {
              p.napOn = { t: 6 + Math.random() * 3 };
              props.cushion.occupied = true;
              for (let i = 0; i < 5; i++) fxs.push({ x: p.x + (i - 2) * 8, y: GY - 6, vx: (i - 2) * 16, vy: -12, life: 0.4, c: "#f0d0e0" });
            } else if (p.goal && p.goal.kind === "plant" && props.plant) {
              p.sniffT = 1.6;
              p.face = p.x < p.goal.x ? "lookR" : "lookL"; p.faceT = 1.5;
              for (let i = 0; i < 4; i++) fxs.push({ x: p.goal.x + (Math.random() - .5) * 12, y: GY - 24, vx: (Math.random() - .5) * 30, vy: -30 - Math.random() * 20, life: 0.5, c: "#9adf8a" });
            } else {
              p.eatT = 1.8; p.eatPhase = 0;
              p.face = "munch"; p.faceT = 0.4;
            }
            p.goal = null;
          } else {
            p.vx = Math.sign(dx) * 90;
            p.face = dx < 0 ? "lookL" : "lookR"; p.faceT = 0.2;
          }
        } else if (!p.sleeping && !p.eatT && !p.napOn && !p.sniffT) {
          if (!reduce && Math.random() < dt * 0.25) p.vx = (Math.random() - .5) * 20;
          // idle pals wander over to check out furniture sometimes
          if (!reduce && !p.goal && Math.random() < dt * 0.04) {
            const ks = Object.keys(props).filter((k) => GOALABLE[k] && !(k === "cushion" && props[k].occupied));
            if (ks.length) {
              const k = ks[(Math.random() * ks.length) | 0];
              p.goal = { kind: k, x: props[k].x };
              p.scurry = p.goal.x;
            }
          }
        }

        // napping on the cushion
        if (p.napOn) {
          p.napOn.t -= dt; p.vx = 0;
          p.face = "sleeping"; p.faceT = 99;
          if (Math.random() < dt * 1.4) zzzs.push({ x: p.x + 18, y: GY - 26 * SC - 8, vy: -16, life: 1.6 });
          if (p.napOn.t <= 0) {
            if (props.cushion) props.cushion.occupied = false;
            p.napOn = null; p.face = "happy"; p.faceT = 0.8; p.vy = 140;
          }
        }
        // sniffing the plant
        if (p.sniffT) {
          p.sniffT -= dt; p.vx = 0;
          if (Math.random() < dt * 3) fxs.push({ x: p.x + (Math.random() - .5) * 10, y: GY - 26, vx: 0, vy: -14, life: 0.5, c: "#9adf8a" });
          if (p.sniffT <= 0) { p.sniffT = null; p.face = "happy"; p.faceT = 0.7; }
        }

        // jelly bounce mat — anything grounded on it gets launched
        if (props.mat && p.y === 0 && !p.sleeping && !p.held && !p.napOn && (p.matCd || 0) <= 0 && Math.abs(p.x - props.mat.x) < 38) {
          p.vy = 240 + Math.random() * 80; p.sq = 0.42; p.matCd = 0.7;
          p.face = "happy"; p.faceT = 0.8;
          for (let i = 0; i < 4; i++) fxs.push({ x: p.x + (i - 1.5) * 10, y: GY - 4, vx: (i - 1.5) * 20, vy: -20, life: 0.4, c: "#a8e8c0" });
        }
        p.matCd = Math.max(0, (p.matCd || 0) - dt);

        // eating animation
        if (p.eatT > 0) {
          p.eatT -= dt; p.vx = 0;
          const ph = p.eatT > 1.4 ? "munch" : p.eatT > 0.5 ? "chew" : "content";
          p.face = ph; p.faceT = 99;
          if (p.eatT > 0.5 && Math.random() < dt * 8)
            crumbs.push({ x: p.x + (Math.random() - .5) * 20, y: GY - 20, vy: 20 + Math.random() * 30, life: 0.7 });
          if (p.eatT <= 0) {
            const ti = treats.findIndex((t) => Math.abs(t.x - p.x) < 24);
            if (ti >= 0) treats.splice(ti, 1);
            jellyDrop(p.x, 5);
          }
        }

        // ambient trait motes — the same fx language the desktop pet uses
        const sp = SPECIES[p.spIdx], tr = sp.trait, lg = LEG[sp.id];
        p.ambT -= dt;
        if (!reduce && !p.sleeping && p.ambT <= 0) {
          p.ambT = 1.2 + Math.random() * 3;
          if (tr === "spark") fxs.push({ x: p.x + Math.random() * 16 - 8, y: GY - 12 - p.y, vx: 0, vy: -30, life: 0.9, c: "#f0a05c" });
          else if (tr === "drip") fxs.push({ x: p.x + Math.random() * 14 - 7, y: GY - 10 - p.y, vx: 0, vy: 50, life: 0.5, c: "#69b7ec" });
          else if (tr === "wisp") fxs.push({ x: p.x + Math.random() * 30 - 15, y: GY - 26 - p.y - Math.random() * 14, vx: Math.random() * 8 - 4, vy: -10, life: 1.2, c: "#c4b2f0" });
          else if (tr === "glint") bangs.push({ x: p.x + Math.random() * 30 - 15, y: GY - 20 - p.y - Math.random() * 30, life: 0.7, t: "✦", c: "#e8f0ff" });
          else if (tr === "bubble") fxs.push({ x: p.x + Math.random() * 16 - 8, y: GY - 18 - p.y, vx: Math.random() * 6 - 3, vy: -28, life: 1, c: "#b8e8f5" });
          else if (tr === "gravity") fxs.push({ x: p.x + Math.random() * 26 - 13, y: GY - 20 - p.y, vx: (Math.random() - .5) * 20, vy: 12, life: 0.8, c: "#b8a8ff" });
          else if (tr === "royal") bangs.push({ x: p.x + Math.random() * 30 - 15, y: GY - 30 - p.y - Math.random() * 20, life: 0.7, t: "✦", c: "#ffd75e" });
        }
        // legendary ambient quirks — every legendary sheds its own signature
        if (!reduce && !p.sleeping && lg) {
          const moving = Math.abs(p.vx) > 6 || p.y > 0;
          if (lg.starburst && Math.random() < dt * 1.8) fxs.push({ x: p.x + (Math.random() - .5) * 34, y: GY - 10 - p.y - Math.random() * 38, vx: 0, vy: -14, life: 0.8, c: "#e8f0ff" });
          if (lg.embers && Math.random() < dt * 1.4) fxs.push({ x: p.x + (Math.random() - .5) * 12, y: GY - 30 - p.y, vx: (Math.random() - .5) * 12, vy: -36, life: 0.7, c: "#e05a3a" });
          if (lg.halo && Math.random() < dt * 1.2) fxs.push({ x: p.x + Math.random() * 30 - 15, y: GY - 8 - p.y - Math.random() * 36, vx: 0, vy: -18, life: 0.8, c: lg.halo });
          if (lg.goldtrail && moving && Math.random() < dt * 10) fxs.push({ x: p.x + (Math.random() - .5) * 26, y: GY - 10 - p.y - Math.random() * 18, vx: (Math.random() - .5) * 10, vy: -8, life: 0.6, c: "#ffe98f" });
          if (lg.glow && Math.random() < dt * 1.6) fxs.push({ x: p.x + Math.random() * 18 - 9, y: GY - 6 - p.y, vx: Math.random() * 6 - 3, vy: -30, life: 0.8, c: lg.glow });
          if (lg.trail && moving && Math.random() < dt * 14) fxs.push({ x: p.x, y: GY - 12 - p.y, vx: (Math.random() - .5) * 16, vy: 36, life: 0.4, c: lg.trail });
          if (lg.drool && Math.random() < dt * 0.6) fxs.push({ x: p.x + 8, y: GY - 20 - p.y, vx: 0, vy: 26, life: 0.7, c: "#8ad4f0" });
          if (lg.chips && moving && Math.random() < dt * 3) fxs.push({ x: p.x + (Math.random() - .5) * 20, y: GY - 6 - p.y, vx: (Math.random() - .5) * 40, vy: -30, life: 0.5, c: "#c8b8a0" });
          if (lg.notes && Math.random() < dt * 0.35) bangs.push({ x: p.x + (Math.random() - .5) * 30, y: GY - 54 - p.y, life: 1.1, t: "♪", c: "#ffd9ea" });
          if (lg.pulse) { p.ringT -= dt; if (p.ringT <= 0) { p.ringT = 5 + Math.random() * 4; rings.push({ x: p.x, y: GY - 24 - p.y, r: 44, life: 1 }); } }
        }

        // movement styles: hover pals float, scurry pals burst, blink pals teleport
        if (!p.sleeping && !p.eatT && p.scurry == null) {
          if (sp.mv === "scurry") {
            p.burstT -= dt;
            if (p.burstT <= 0) { p.burstT = 5 + Math.random() * 8; p.vx = (Math.random() < .5 ? -1 : 1) * (110 + Math.random() * 60); }
          } else if (sp.mv === "blink") {
            p.tpT -= dt;
            if (!reduce && p.tpT <= 0) {
              p.tpT = 7 + Math.random() * 10;
              for (let i = 0; i < 5; i++) fxs.push({ x: p.x + (Math.random() - .5) * 20, y: GY - 14 - Math.random() * 24, vx: 0, vy: -10, life: 0.5, c: "#e8f0ff" });
              p.x = 40 + Math.random() * (W - 80);
              for (let i = 0; i < 5; i++) fxs.push({ x: p.x + (Math.random() - .5) * 20, y: GY - 14 - Math.random() * 24, vx: 0, vy: -10, life: 0.5, c: "#e8f0ff" });
            }
          }
          p.hopT -= dt * (reduce ? 0 : 1);
          if (p.hopT <= 0 && p.y === 0) {
            p.vy = (sp.mv === "hop" ? 200 : 120) + 110 * prof.hop; p.hopT = 3 + Math.random() * 8;
          }
        }
        p.x += p.vx * dt;
        const half = 18 * SC;
        if (p.x < half + 6) { p.x = half + 6; p.vx = Math.abs(p.vx); }
        if (p.x > W - half - 6) { p.x = W - half - 6; p.vx = -Math.abs(p.vx); }

        // face selection
        p.faceT -= dt;
        if (p.faceT <= 0) {
          p.blinkT -= dt * 1000;
          if (p.sleeping > 0) p.face = "sleeping";
          else if (p.blinkT <= 0) { p.face = "blink"; p.faceT = prof.blinkLen / 1000; p.blinkT = prof.blink; }
          else if (mx > -900) p.face = mx < p.x - 30 ? "lookL" : mx > p.x + 30 ? "lookR" : "idle";
          else p.face = "idle";
        }
      }

      // gravity (held pals float, everyone else falls)
      if (!p.held && (p.y > 0 || p.vy > 0)) {
        p.y += p.vy * dt;
        p.vy -= 420 * dt;
        if (p.y <= 0) { p.y = 0; if (p.vy < -80) p.sq = 0.3; p.vy = 0; }
      }
      p.sq *= Math.pow(0.02, dt);

      // breathing squash
      const br = reduce ? 0 : Math.sin(now / 600 * prof.breathe) * 0.03;
      const sx = 1 + p.sq - br * 0.4, sy = 1 - p.sq * 0.8 + br;
      const spr = sprite(p.face, p.spIdx);
      const pw = SW * SC * sx, ph = SH * SC * sy;
      // hover species drift above the ground like they do on the desktop
      const phov = SPECIES[p.spIdx].mv === "hover" && !p.held ? 10 + Math.sin(now / 450 + p.ph) * 6 : 0;
      const feetY = GY - p.y - phov;
      // legendary wings flap behind the body
      const lgq = LEG[SPECIES[p.spIdx].id];
      if (lgq && lgq.wings) {
        const wph = now / 1000 * (p.y > 0 ? 14 : 5);
        const wf = Math.min(2, Math.floor(((Math.sin(wph) + 1) / 2) * 3));
        const img = wingImg(wf, lgq.wings);
        const ww = img.width * SC * sx, wh = img.height * SC * sy;
        const wbob = Math.sin(wph - 0.6) * (p.y > 0 ? 1.6 : 0.8);
        for (const m of [-1, 1]) {
          cx.save();
          cx.translate(p.x + m * SW * SC * sx * 0.3, feetY - SH * SC * sy * 0.56 + wbob);
          cx.scale(m, 1);
          cx.rotate(-0.12 + Math.sin(wph - 0.9) * (p.y > 0 ? 0.16 : 0.07));
          cx.drawImage(img, 0, -wh, ww, wh);
          cx.restore();
        }
      }
      cx.globalAlpha = SPECIES[p.spIdx].trait === "wisp" ? 0.85 : 1;
      cx.drawImage(spr, 0, 0, SW * 2, SH * 2, p.x - pw / 2, feetY - ph, pw, ph);
      cx.globalAlpha = 1;
      // equipped accessory rides the head — same anchor math as the game
      if (p.acc) drawAccRaw(cx, p.acc, p.x, feetY - ph + 4, Math.max(1.2, SC * sy * 0.82));
      // breed pick marker
      if (p.picked) {
        cx.font = `10px ${PX}`; cx.fillStyle = "#ff8fb0"; cx.textAlign = "center";
        cx.fillText("♥", p.x, feetY - ph - 8);
        cx.textAlign = "left";
      }
      // webby kicks her little legs while you carry her
      if (p.held && lgq && lgq.legs) {
        const t9 = now / 1000 * 9;
        for (const m of [-1, 1]) for (let l = 0; l < 2; l++) {
          const k = Math.sin(t9 + l * 2.1 + (m < 0 ? 1.4 : 0));
          cx.save();
          cx.translate(p.x + m * (SW * SC * sx * 0.3 + l * 4), feetY - SH * SC * sy * (0.32 - l * 0.14));
          cx.scale(m, 1);
          cx.rotate(0.5 + k * 0.45);
          drawMap(cx, LEG_SPR, 0, 0, 2.2, "#3a3048");
          cx.restore();
        }
      }
      // pulsar's orbiting motes
      if (lgq && lgq.orbit && !reduce) {
        for (let o = 0; o < 2; o++) {
          const a = now / 900 + p.ph + o * 3.14;
          cx.fillStyle = "#b8a8ff";
          cx.fillRect(p.x + Math.cos(a) * 30 - 1.5, feetY - 20 + Math.sin(a) * 10 - 1.5, 3, 3);
        }
      }
    }

    // particles
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.y += h.vy * dt; h.life -= dt;
      if (h.life <= 0) { hearts.splice(i, 1); continue; }
      drawMap(cx, HEART, h.x, h.y, 2.2, "#ff8fb0");
      cx.globalAlpha = 1;
    }
    for (let i = zzzs.length - 1; i >= 0; i--) {
      const z = zzzs[i]; z.y += z.vy * dt; z.life -= dt;
      if (z.life <= 0) { zzzs.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, z.life);
      cx.font = `9px ${PX}`; cx.fillStyle = "#9c92d0";
      cx.fillText("z", z.x, z.y);
      cx.globalAlpha = 1;
    }
    for (let i = crumbs.length - 1; i >= 0; i--) {
      const c = crumbs[i]; c.y += c.vy * dt; c.life -= dt;
      if (c.life <= 0 || c.y > GY) { crumbs.splice(i, 1); continue; }
      cx.fillStyle = "#ffd9ea";
      cx.fillRect(c.x, c.y, 2, 2);
    }
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i]; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
      if (f.life <= 0 || f.y > GY) { fxs.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, f.life * 2);
      cx.fillStyle = f.c;
      cx.fillRect(f.x, f.y, 2.5, 2.5);
    }
    cx.globalAlpha = 1;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life -= dt * 1.2; r.r -= 38 * dt;
      if (r.life <= 0 || r.r < 4) { rings.splice(i, 1); continue; }
      cx.globalAlpha = r.life * 0.6;
      cx.strokeStyle = "#b8a8ff";
      cx.lineWidth = 2;
      cx.strokeRect(r.x - r.r, r.y - r.r * 0.5, r.r * 2, r.r);
    }
    cx.globalAlpha = 1;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.t += dt * 1.4;
      if (d.t >= 1) { jelly += d.amt; jellyPulse = 1; drops.splice(i, 1); continue; }
      const t2 = d.t * d.t * (3 - 2 * d.t);
      const dx = 60 + (d.x - 60) * (1 - t2), dy = 20 + (d.y - 20) * (1 - t2) - Math.sin(t2 * Math.PI) * 60;
      drawMap(cx, JDROP, dx, dy, 1.6, "#8fe8c0");
    }

    // ---- breed sequence: parents meet at midfield, egg, hybrid hatches ----
    if (breeding) {
      breeding.t += dt;
      const { a, b } = breeding, mid = (a.x + b.x) / 2;
      if (breeding.phase === 0) {
        a.scurry = mid - 16; b.scurry = mid + 16;
        breeding.phase = 1;
      } else if (breeding.phase === 1 && a.scurry == null && b.scurry == null) {
        breeding.phase = 2; breeding.t = 0;
        a.face = b.face = "love"; a.faceT = b.faceT = 1.4;
        for (let i = 0; i < 6; i++)
          hearts.push({ x: mid - 10 + i * 4, y: GY - 30 * SC - i * 6, vy: -30 - i * 6, life: 1.2 });
      } else if (breeding.phase === 2 && breeding.t > 1.1) {
        breeding.phase = 3; breeding.t = 0;
        breeding.child = makeHybrid(SPECIES[a.spIdx], SPECIES[b.spIdx]);
      } else if (breeding.phase === 3) {
        // the egg sits mid-ranch and wobbles before it pops
        const wob = reduce ? 0 : Math.sin(breeding.t * 14) * Math.min(4, breeding.t * 3);
        drawMap(cx, ["..ww..", ".wkkk.", "wkkwwk", "wkkwkk", ".wkkk.", "..ww.."], mid - 9 + wob, GY - 24, 3, "#f4ead8");
        if (breeding.t > 1.7) {
          jelly -= 20;
          SPECIES.push(breeding.child);
          const np = addPalIdx(SPECIES.length - 1, mid);
          np.face = "star"; np.faceT = 1.6; np.vy = 190;
          bangs.push({ x: mid, y: 80, life: 1.8, t: "+ " + breeding.child.name.toUpperCase() + "!", c: RARITY_COLOR[breeding.child.r] });
          for (let i = 0; i < 8; i++)
            fxs.push({ x: mid + (Math.random() - .5) * 30, y: GY - 20 - Math.random() * 30, vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 30, life: 0.7, c: "#f4ead8" });
          a.picked = b.picked = false;
          breedSel = []; breeding = null;
        }
      }
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
        const sil = sprite("idle", pull.spIdx, true);
        const s = SC * 1.6 * (0.5 + grow * 0.5);
        cx.globalAlpha = Math.min(1, grow * 1.5);
        cx.drawImage(sil, 0, 0, SW * 2, SH * 2, cxp - SW * s / 2 + wob, GY - SH * s - 40 * grow, SW * s, SH * s);
        cx.globalAlpha = 1;
      } else {
        if (pull.t - dt < 1) {
          bangs.push({ x: cxp, y: 70, life: 1.6, t: `+ ${sp.name.toUpperCase()}!`, c: RARITY_COLOR[sp.r] });
          // higher rarity, bigger fanfare — epic+ sheds a ring, legendary bursts
          if (sp.r >= 2) rings.push({ x: cxp, y: GY - 50, r: 60, life: 1 });
          if (sp.r >= 3)
            for (let i = 0; i < 12; i++)
              fxs.push({ x: cxp + (Math.random() - .5) * 80, y: GY - 20 - Math.random() * 70, vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 40, life: 0.9, c: i % 2 ? "#ffd75e" : "#e8f0ff" });
          if (pals.length < 10 && !pals.some((p) => p.spIdx === pull.spIdx)) {
            addPal(sp.id, cxp);
            const np = pals[pals.length - 1];
            np.face = "star"; np.faceT = 1.6; np.vy = 170;
          } else {
            jellyDrop(cxp, 20);
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

  // ---- shared: fit a sprite (72x52) into a box, bottom-anchored ----
  function fit(cc, spr, bw, bh, pad = 0) {
    const sw = SW * 2, sh = SH * 2;
    const s = Math.min((bw - pad * 2) / sw, (bh - pad * 2) / sh);
    const dw = sw * s, dh = sh * s;
    cc.imageSmoothingEnabled = false;
    cc.drawImage(spr, 0, 0, sw, sh, (bw - dw) / 2, bh - dh - pad, dw, dh);
  }
  window.palSprite = (face, idx) => sprite(face, idx);
  window.palFit = fit;

  // ---- species dex: filter + featured first, real sprites ----
  const dex = document.getElementById("dex");
  if (dex) {
    const FEATURED = ["sprout", "kitty", "aurora", "gold", "drago", "mochi", "void", "frost", "waffle", "siren", "frog", "ninja"];
    const FEATURED_SET = new Set(FEATURED.map(spIndex));
    let filter = -1, expanded = false;
    const cells = [];
    SPECIES.forEach((sp, i) => {
      const cell = document.createElement("div");
      cell.className = "cell pxframe r" + sp.r;
      const cnv = document.createElement("canvas");
      cnv.width = 66; cnv.height = 44;
      fit(cnv.getContext("2d"), sprite("idle", i), 66, 44);
      const nm = document.createElement("div");
      nm.className = "nm"; nm.textContent = sp.name;
      const rr = document.createElement("div");
      rr.className = "rr"; rr.textContent = RARITY_NAME[sp.r];
      rr.style.color = RARITY_COLOR[sp.r];
      cell.append(cnv, nm, rr);
      if (sp.sig) {
        const sg = document.createElement("div");
        sg.className = "sg"; sg.textContent = "◆ " + sp.sig.toUpperCase();
        sg.title = "signature move";
        cell.appendChild(sg);
      }
      if (sp.season) {
        const sn = document.createElement("div");
        sn.className = "sn"; sn.textContent = "★";
        cell.appendChild(sn);
      }
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      const react = () => {
        if (cell._anim) return;
        cell._anim = true;
        const prof = animProf(i), cc = cnv.getContext("2d"), t00 = performance.now();
        const face = prof.glee > 0.5 ? "love" : "happy";
        (function fr(now) {
          const t = (now - t00) / 1000;
          if (t > 1.1) { cell._anim = false; fit(cc, sprite("idle", i), 66, 44); return; }
          requestAnimationFrame(fr);
          cc.clearRect(0, 0, 66, 44);
          const hop = Math.abs(Math.sin(t * 7)) * 6, sq = Math.sin(t * 14) * 0.12;
          const spr = sprite(t < 0.8 ? face : "idle", i);
          const s = Math.min(58 / (SW * 2), 40 / (SH * 2));
          const dw = SW * 2 * s * (1 + sq), dh = SH * 2 * s * (1 - sq);
          cc.imageSmoothingEnabled = false;
          cc.drawImage(spr, 0, 0, SW * 2, SH * 2, (66 - dw) / 2, 44 - dh - hop, dw, dh);
        })(t00);
      };
      cell.addEventListener("click", react);
      cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); react(); } });
      cells.push({ el: cell, r: sp.r, feat: FEATURED_SET.has(i) });
      dex.appendChild(cell);
    });
    const applyDex = () => {
      for (const c of cells) {
        const ok = (filter < 0 || c.r === filter) && (expanded || c.feat || filter >= 0);
        c.el.style.display = ok ? "" : "none";
      }
      const more = document.getElementById("dexmore");
      if (more) more.style.display = expanded ? "none" : "";
    };
    document.querySelectorAll(".dexfilter button").forEach((b) => {
      b.addEventListener("click", () => {
        filter = b.dataset.r === "all" ? -1 : +b.dataset.r;
        document.querySelectorAll(".dexfilter button").forEach((x) => x.classList.toggle("on", x === b));
        applyDex();
      });
    });
    const more = document.getElementById("dexmore");
    if (more) more.addEventListener("click", () => { expanded = true; applyDex(); });
    applyDex();
  }

  // ---- pack icons + loop-step icons ----
  const PACK_SP = ["sprout", "berry", "gold", "stella"];
  document.querySelectorAll(".jellypic").forEach((el, i) => {
    fit(el.getContext("2d"), sprite("idle", spIndex(PACK_SP[i] || "sprout")), el.width, el.height, 2);
  });
  document.querySelectorAll(".lico").forEach((el) => {
    const cc = el.getContext("2d");
    if (el.dataset.lico === "pal") {
      fit(cc, sprite("happy", spIndex("sprout")), el.width, el.height, 2);
    } else {
      cc.imageSmoothingEnabled = false;
      drawMap(cc, JDROP, el.width / 2 - 9, 4, 3.4, "#8fe8c0");
    }
  });

  // ---- toybox icons: real prop sprites + real accessory art ----
  document.querySelectorAll(".pico").forEach((el) => {
    const img = sprImg(el.dataset.pico);
    if (!img) return;
    const cc = el.getContext("2d");
    cc.imageSmoothingEnabled = false;
    const s = Math.min((el.width - 4) / img.width, (el.height - 4) / img.height);
    cc.drawImage(img, 0, 0, img.width, img.height,
      (el.width - img.width * s) / 2, el.height - img.height * s - 1,
      img.width * s, img.height * s);
  });
  document.querySelectorAll(".aico").forEach((el) => {
    const cc = el.getContext("2d");
    cc.imageSmoothingEnabled = false;
    drawAccRaw(cc, el.dataset.aico, el.width / 2, el.height * 0.68, 1.15);
  });

  // ---- section icons: real sprites marking each chapter ----
  document.querySelectorAll(".hico").forEach((el) => {
    const cc = el.getContext("2d");
    cc.imageSmoothingEnabled = false;
    const k = el.dataset.ico;
    if (k === "jelly") drawMap(cc, JDROP, 2, 2, 3, "#8fe8c0");
    else if (k === "pal") fit(cc, sprite("happy", spIndex("frog")), el.width, el.height, 1);
    else if (k === "hybrid") fit(cc, sprite("love", spIndex("mochi")), el.width, el.height, 1);
    else {
      const img = sprImg(k);
      if (img) {
        const s = Math.min((el.width - 2) / img.width, (el.height - 2) / img.height);
        cc.drawImage(img, 0, 0, img.width, img.height,
          (el.width - img.width * s) / 2, el.height - img.height * s - 1, img.width * s, img.height * s);
      }
    }
  });
})();
