(async () => {
  for (const url of ['https://21e6a9f4.jellypal.pages.dev', 'https://jellypal.fun']) {
    const r = await fetch(url, { cache: 'no-store' });
    const t = await r.text();
    console.log(url.padEnd(44), 'safe:', t.includes('id="safe"'), 'mot:', t.includes('id="mot"'), 'cf-age:', r.headers.get('age'));
  }
})();
