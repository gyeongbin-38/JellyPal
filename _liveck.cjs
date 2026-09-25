(async () => {
  const r = await fetch("https://jellypal.fun/");
  const t = await r.text();
  const v = await fetch("https://jellypal.fun/version.txt");
  console.log("index:", r.status,
    "| exe link:", /Jellypal_0\.2\.5_x64-setup\.exe/.test(t),
    "| zip link:", /jellypal-0\.2\.5-win\.zip/.test(t),
    "| exe hash:", /db8ec931/.test(t),
    "| zip hash:", /589488a3/.test(t),
    "| version.txt:", (await v.text()).trim());
})();
