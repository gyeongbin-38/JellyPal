// Jellypal's in-game 5x7 bitmap font, exposed as accessible canvas text.
// The original words remain in visually-hidden spans for screen readers.
(function () {
  const FONT = {
    " ":[".....",".....",".....",".....",".....",".....","....."],
    A:[".###.","#...#","#...#","#####","#...#","#...#","#...#"], B:["####.","#...#","#...#","####.","#...#","#...#","####."],
    C:[".###.","#...#","#....","#....","#....","#...#",".###."], D:["###..","#..#.","#...#","#...#","#...#","#..#.","###.."],
    E:["#####","#....","#....","####.","#....","#....","#####"], F:["#####","#....","#....","####.","#....","#....","#...."],
    G:[".###.","#...#","#....","#.###","#...#","#...#",".###."], H:["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
    I:["#####","..#..","..#..","..#..","..#..","..#..","#####"], J:["..###","...#.","...#.","...#.","#..#.","#..#.",".##.."],
    K:["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"], L:["#....","#....","#....","#....","#....","#....","#####"],
    M:["#...#","##.##","#.#.#","#.#.#","#...#","#...#","#...#"], N:["#...#","##..#","#.#.#","#..##","#...#","#...#","#...#"],
    O:[".###.","#...#","#...#","#...#","#...#","#...#",".###."], P:["####.","#...#","#...#","####.","#....","#....","#...."],
    Q:[".###.","#...#","#...#","#...#","#.#.#","#..#.",".##.#"], R:["####.","#...#","#...#","####.","#.#..","#..#.","#...#"],
    S:[".####","#....","#....",".###.","....#","....#","####."], T:["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
    U:["#...#","#...#","#...#","#...#","#...#","#...#",".###."], V:["#...#","#...#","#...#","#...#","#...#",".#.#.","..#.."],
    W:["#...#","#...#","#...#","#.#.#","#.#.#","##.##","#...#"], X:["#...#",".#.#.","..#..","..#..","..#..",".#.#.","#...#"],
    Y:["#...#",".#.#.","..#..","..#..","..#..","..#..","..#.."], Z:["#####","....#","...#.","..#..",".#...","#....","#####"],
    "0":[".###.","#...#","#..##","#.#.#","##..#","#...#",".###."], "1":["..#..",".##..","..#..","..#..","..#..","..#..","#####"],
    "2":[".###.","#...#","....#","..##.",".#...","#....","#####"], "3":["####.","....#","....#",".###.","....#","....#","####."],
    "4":["...#.","..##.",".#.#.","#####","...#.","...#.","...#."], "5":["#####","#....","####.","....#","....#","#...#",".###."],
    "6":[".###.","#....","####.","#...#","#...#","#...#",".###."], "7":["#####","....#","...#.","..#..",".#...",".#...",".#..."],
    "8":[".###.","#...#","#...#",".###.","#...#","#...#",".###."], "9":[".###.","#...#","#...#",".####","....#","....#",".###."],
    "?":[".###.","#...#","...#.","..#..","..#..",".....","..#.."], "!":["..#..","..#..","..#..","..#..","..#..",".....","..#.."],
    "+":[".....","..#..","..#..","#####","..#..","..#..","....."], "-":[".....",".....",".....","#####",".....",".....","....."],
    ".":[".....",".....",".....",".....",".....","..##.","..##."], ",":[".....",".....",".....",".....","..##.","..##.",".##.."],
    "(":["...##","..#..",".#...",".#...",".#...","..#..","...##"], ")":["##...","..#..","...#.","...#.","...#.","..#..","##..."],
    "=":[".....",".....","#####",".....","#####",".....","....."], "/":["....#","....#","...#.","..#..",".#...","#....","#...."],
    ">":["#....",".#...","..#..","...#.","..#..",".#...","#...."], "<":["....#","...#.","..#..",".#...","..#..","...#.","....#"],
    ":[":[".....","..##.","..##.",".....","..##.","..##.","....."], "*":[".....",".#.#.","..###","#####","..###",".#.#.","....."],
    "%":["##..#","##.#.","...#.","..#..",".#...","#..##","#..##"], "_":[".....",".....",".....",".....",".....",".....","#####"],
    "·":[".....",".....",".....","..#..",".....",".....","....."],
    "'":["..#..","..#..",".#...",".....",".....",".....","....."], "\"":[".#.#.",".#.#.","#.#.#",".....",".....",".....","....."]
  };

  const SKIP = new Set(["SCRIPT", "STYLE", "CANVAS", "NOSCRIPT", "TEXTAREA", "INPUT"]);

  function clean(text) {
    return String(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
  }

  function textWidth(text, scale) { return Math.max(0, String(text).length * 6 * scale - scale); }

  function wrap(text, scale, maxWidth) {
    if (!maxWidth || textWidth(text, scale) <= maxWidth) return [text];
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, scale) > maxWidth) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawLine(context, text, x, y, scale, color, bold) {
    context.fillStyle = color;
    let cursor = x;
    for (const raw of text.toUpperCase()) {
      const glyph = FONT[raw] || FONT["?"];
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== "#") continue;
        context.fillRect(cursor + col * scale, y + row * scale, scale, scale);
        if (bold) context.fillRect(cursor + col * scale + 1, y + row * scale, scale, scale);
      }
      cursor += 6 * scale;
    }
  }

  function render(wrapper) {
    const source = wrapper.querySelector(".sprite-text-source");
    const canvas = wrapper.querySelector(".sprite-text-canvas");
    const text = clean(source.textContent);
    const parent = wrapper.parentElement;
    const style = getComputedStyle(parent);
    const fontSize = parseFloat(style.fontSize) || 14;
    // Slightly denser than the in-app HUD: large web headings keep the same
    // 5x7 alphabet but use smaller cells, so the pixels read as detail.
    const scale = Math.max(1, Math.min(8, Math.round(fontSize / 10)));
    const padding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
    const blockText = /^(P|H1|H2|H3|SUMMARY)$/.test(parent.tagName) || parent.classList.contains("jp-lede") || parent.classList.contains("jp-pal-card__copy");
    const maxWidth = blockText ? Math.max(80, parent.clientWidth - padding - 4) : 0;
    const lines = wrap(text, scale, maxWidth);
    const lineHeight = 9 * scale;
    const width = Math.max(...lines.map((line) => textWidth(line, scale)), scale) + 2;
    const height = lines.length * lineHeight - 2 * scale + 2;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    const color = style.color;
    const bold = Number(style.fontWeight) >= 800;
    const shadow = /^H[1-3]$/.test(parent.tagName);
    lines.forEach((line, index) => {
      const x = style.textAlign === "center" ? Math.floor((width - textWidth(line, scale)) / 2) : 0;
      const y = index * lineHeight;
      if (shadow) drawLine(context, line, x + Math.max(1, Math.floor(scale / 2)), y + Math.max(1, Math.floor(scale / 2)), scale, "rgba(9,6,20,.72)", bold);
      drawLine(context, line, x, y, scale, color, bold);
    });
  }

  function spritefy(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement || SKIP.has(node.parentElement.tagName) || node.parentElement.closest(".sprite-text-wrap") || !clean(node.textContent)) continue;
      nodes.push(node);
    }
    for (const node of nodes) {
      const wrapper = document.createElement("span");
      wrapper.className = "sprite-text-wrap";
      const source = document.createElement("span");
      source.className = "sprite-text-source";
      source.textContent = clean(node.textContent);
      const canvas = document.createElement("canvas");
      canvas.className = "sprite-text-canvas";
      canvas.setAttribute("aria-hidden", "true");
      wrapper.append(source, canvas);
      node.replaceWith(wrapper);
      render(wrapper);
    }
  }

  function setSpriteText(element, text) {
    const wrapper = element.querySelector(":scope > .sprite-text-wrap");
    if (!wrapper) { element.textContent = text; spritefy(element); return; }
    wrapper.querySelector(".sprite-text-source").textContent = clean(text);
    render(wrapper);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => document.querySelectorAll(".sprite-text-wrap").forEach(render), 100);
  });

  window.spritefy = spritefy;
  window.setSpriteText = setSpriteText;
})();
