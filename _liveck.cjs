const checks = [
  ['https://jellypal.fun', ['id="safe"', 'id="mot"', 'navdl', 'e0964204', '600 keys = 1 jelly', 'itch.io — soon']],
  ['https://jellypal.fun/ranch.js', ['getElementById("dex")', 'dataset.ico', 'leg.starburst', 'paused']],
];
(async () => {
  for (const [url, keys] of checks) {
    const t = await (await fetch(url)).text();
    console.log(url.padEnd(42), keys.map(k => `${t.includes(k) ? 'Y' : 'N'}`).join(''));
  }
})();
