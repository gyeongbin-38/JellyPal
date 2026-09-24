const checks = [
  ['https://jellypal.fun', ['drop a treat', 'dexfilter', 'recta', 'data-prop', 'data-acc', 'id="breed"', 'hico']],
  ['https://jellypal.fun/ranch.js', ['makeHybrid', 'GOALABLE', 'drawAccRaw', 'napOn', 'breedPicking', 'wingImg']],
  ['https://jellypal.fun/pals.js', ['const SPR =', 'drawAccRaw', 'makeHybrid', 'WING_F', 'cushion']],
];
(async () => {
  for (const [url, keys] of checks) {
    const t = await (await fetch(url)).text();
    console.log(url.padEnd(42), keys.map(k => `${t.includes(k) ? 'Y' : 'N'}`).join(''));
  }
})();
