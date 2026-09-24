(async () => {
  for (const [url, keys] of [
    ['https://jellypal.fun', ['shot-desktop.png', 'og:image', 'favicon.png', 'deskshot']],
    ['https://jellypal.fun/shot-desktop.png', []],
    ['https://jellypal.fun/favicon.png', []],
    ['https://jellypal.fun/nonexistent-page', ['404', 'wandered off']],
  ]) {
    const r = await fetch(url, { cache: 'no-store' });
    const t = keys.length ? await r.text() : '';
    console.log(url.padEnd(50), r.status, keys.map(k => t.includes(k) ? 'Y' : 'N').join(''));
  }
})();
