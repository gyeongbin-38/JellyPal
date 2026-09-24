const checks = [
  ['https://jellypal.fun', ['id="ranch"', 'dexfilter', 'boop it, pick it up']],
  ['https://jellypal.fun/ranch.js', ['no buttons', 'getElementById("ranch")', 'jdrops.push', 'heldT']],
];
(async () => {
  for (const [url, keys] of checks) {
    const t = await (await fetch(url)).text();
    console.log(url.padEnd(42), keys.map(k => `${t.includes(k) ? 'Y' : 'N'}`).join(''),
      '| buttons:', /id="(pull|feed|breed)"/.test(t) ? 'STILL PRESENT' : 'gone');
  }
})();
