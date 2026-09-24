const checks = [
  ['https://jellypal.fun', ['drop a treat', 'dexfilter', 'recta']],
  ['https://jellypal.fun/ranch.js', ['held1', 'scurry', 'keys % 12']],
  ['https://jellypal.fun/pals.js', ['i: 215, b: 242', 'held2', 'munch']],
];
(async () => {
  for (const [url, keys] of checks) {
    const t = await (await fetch(url)).text();
    console.log(url.padEnd(42), keys.map(k => `${t.includes(k) ? 'Y' : 'N'}`).join(''));
  }
})();
