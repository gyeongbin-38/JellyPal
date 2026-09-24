const urls = [
  "https://jellypal.fun/",
  "https://jellypal.fun/dl/Jellypal_0.2.1_x64-setup.exe",
  "https://jellypal.fun/dl/jellypal-0.2.1-win.zip",
];
(async () => {
  for (const u of urls) {
    const r = await fetch(u, { method: u.endsWith("/") || u.endsWith("fun/") ? "GET" : "HEAD" });
    let extra = "";
    if (u.endsWith("/")) {
      const t = await r.text();
      extra = `links0.2.1=${(t.match(/0\.2\.1/g) || []).length} hash=${/40b61b60/.test(t)}`;
    } else {
      extra = `size=${r.headers.get("content-length")}`;
    }
    console.log(r.status, u, extra);
  }
})();
