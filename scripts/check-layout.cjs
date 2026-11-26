// Render the real frontend in Chromium. Native IPC is stubbed, canvas is real.
// This checks layout and pointer routing; native macOS/StoreKit still need a Mac.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../src");
const output = process.env.JELLYPAL_LAYOUT_OUTPUT || path.join(os.tmpdir(), "jellypal-store-layout");
const cases = [
  { name: "store-standard", width: 480, height: 560, dpr: 1, store: true },
  { name: "store-retina", width: 480, height: 560, dpr: 2, store: true },
  { name: "store-small-desktop", width: 480, height: 484, dpr: 1, store: true },
  { name: "store-scaled-retina", width: 480, height: 493, dpr: 2, store: true },
  { name: "store-classic-scrollbars", width: 480, height: 560, dpr: 1, store: true, classicScrollbars: true },
  { name: "store-narrow", width: 448, height: 400, dpr: 2, store: true },
  { name: "desktop-1280", width: 1280, height: 720, dpr: 1, store: false },
  { name: "desktop-1440-retina", width: 1440, height: 900, dpr: 2, store: false },
  { name: "desktop-1920-scaled", width: 1920, height: 1080, dpr: 1.5, store: false },
];
const server = http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  const files = { "/": "index.html", "/styles.css": "styles.css", "/main.js": "main.js" };
  if (!files[name]) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(path.join(root, files[name]), "utf8");
  if (name === "/main.js") body += "\nwindow.__qa = (expression) => eval(expression);";
  res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "text/html");
  res.end(body);
});
const inside = (r, w, h) => r.x >= -0.5 && r.y >= -0.5 && r.right <= w + 0.5 && r.bottom <= h + 0.5;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const item of cases) {
      const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: item.dpr,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150.0 Safari/537.36" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(({ store, width, height }) => {
        window.__ipcErrors = [];
        window.__TAURI__ = {
          core: { invoke: async (cmd, args) => {
            if (cmd === "is_store_build") return store;
            if (cmd === "load_state") return "{}";
            if (cmd === "is_demo" || cmd === "autostart_available") return false;
            if (cmd === "get_monitors") return [[0, 0, width, height]];
            if (cmd === "iap_products" || cmd === "iap_drain" || cmd === "list_photos") return [];
            if (cmd === "log_crash") window.__ipcErrors.push(args.msg);
            return null;
          } },
          event: { listen: async () => () => {} },
          window: { getCurrentWindow: () => ({ startDragging: async () => {}, show: async () => {}, setFocus: async () => {} }) },
        };
      }, item);
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.__qa && window.__qa("saveReady"));
      if (item.classicScrollbars) await page.addStyleTag({ content: `
        #ranch, #nursery, #card { scrollbar-gutter: stable; }
        #ranch::-webkit-scrollbar, #nursery::-webkit-scrollbar, #card::-webkit-scrollbar { width: 16px; }
      ` });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(output, `${item.name}-pet.png`) });
      await page.evaluate(() => window.__qa("toggleRanch(true)"));
      await page.waitForTimeout(80);
      const ranch = await page.locator("#ranch").evaluate(el => el.getBoundingClientRect().toJSON());
      assert.ok(inside(ranch, item.width, item.height), `${item.name}: ranch clipped ${JSON.stringify(ranch)}`);
      await page.screenshot({ path: path.join(output, `${item.name}-ranch.png`) });
      // Hit the actual close button at its displayed canvas coordinates.
      const close = await page.evaluate(() => window.__qa("[CLOSE_R[0] + CLOSE_R[2]/2, CLOSE_R[1] + CLOSE_R[3]/2]"));
      const canvas = await page.locator("#rc").boundingBox();
      const canvasScale = await page.locator("#rc").evaluate(el => {
        const r = el.getBoundingClientRect();
        return [r.width / el.width, r.height / el.height];
      });
      await page.mouse.click(canvas.x + close[0] * canvasScale[0], canvas.y + close[1] * canvasScale[1]);
      assert.equal(await page.evaluate(() => window.__qa("ranchOpen")), false, `${item.name}: close hit area`);
      await page.evaluate(() => window.__qa("openCard('pet')"));
      const card = await page.locator("#card").evaluate(el => el.getBoundingClientRect().toJSON());
      assert.ok(inside(card, item.width, item.height), `${item.name}: status card clipped`);
      await page.screenshot({ path: path.join(output, `${item.name}-status.png`) });
      await page.evaluate(() => window.__qa("closeCard(); settingsOpen = true"));
      await page.waitForTimeout(80);
      const settings = await page.evaluate(() => window.__qa("settingsRect()"));
      assert.ok(settings[0] >= 0 && settings[1] >= 0 && settings[0] + settings[2] <= item.width && settings[1] + settings[3] <= item.height);
      await page.screenshot({ path: path.join(output, `${item.name}-settings.png`) });
      // A large nursery must scroll rather than hide its last row below the card.
      await page.evaluate(() => window.__qa(`settingsOpen = false;
        for (let n = 0; n < 40; n++) {
          const child = makeHybrid(SPECIES[0], SPECIES[1]);
          if (child) { SPECIES.push(child); owned.push(child.id); }
        }
        toggleNursery(true);`));
      await page.waitForTimeout(80);
      const nursery = await page.locator("#nursery").evaluate(el => ({
        rect: el.getBoundingClientRect().toJSON(), scroll: el.scrollHeight, height: el.clientHeight,
      }));
      assert.ok(inside(nursery.rect, item.width, item.height), `${item.name}: nursery clipped ${JSON.stringify(nursery.rect)}`);
      assert.ok(nursery.scroll > nursery.height, `${item.name}: nursery should scroll`);
      await page.locator("#nursery").evaluate(el => { el.scrollTop = el.scrollHeight; });
      const babyInfo = await page.evaluate(() => window.__qa("[babyCell(babyIdx().length - 1), babyIdx().at(-1)]"));
      const ncanvas = await page.locator("#nc").boundingBox();
      const nurseryScale = await page.locator("#nc").evaluate(el => {
        const r = el.getBoundingClientRect();
        return [r.width / el.width, r.height / el.height];
      });
      await page.mouse.click(ncanvas.x + (babyInfo[0].x + 90) * nurseryScale[0], ncanvas.y + (babyInfo[0].y + 9) * nurseryScale[1]);
      assert.equal(await page.evaluate(() => window.__qa("infoPick")), babyInfo[1], `${item.name}: scrolled nursery hit area`);
      await page.evaluate(() => window.__qa("infoPick = null"));
      await page.screenshot({ path: path.join(output, `${item.name}-nursery.png`) });
      await page.evaluate(() => window.__qa("toggleNursery(false)"));
      // Restore a saved position from a disconnected monitor, then resize live.
      await page.evaluate(() => window.__qa("settingsOpen = false; panelPos.ranch = {x: 9000, y: -4000}; toggleRanch(true)"));
      await page.setViewportSize({ width: item.width, height: item.height - 40 });
      await page.waitForTimeout(80);
      const after = await page.locator("#ranch").evaluate(el => el.getBoundingClientRect().toJSON());
      assert.ok(inside(after, item.width, item.height - 40), `${item.name}: resize left panel outside viewport`);
      const ipcErrors = await page.evaluate(() => window.__ipcErrors.filter(e => /JSERR|JSREJ|FRAME/.test(e)));
      assert.deepEqual([...errors, ...ipcErrors], [], `${item.name}: runtime errors`);
      results.push({ ...item, passed: true, ranch, card });
      console.log(`PASS ${item.name} (${item.width}x${item.height}, DPR ${item.dpr})`);
      await context.close();
    }
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
    console.log(`Screenshots and results: ${output}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
