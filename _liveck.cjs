(async () => {
  const r = await fetch("https://jellypal.fun/");
  const t = await r.text();
  const v = await fetch("https://jellypal.fun/version.txt");
  console.log("index:", r.status,
    "| exe link:", /Jellypal_0\.2\.4_x64-setup\.exe/.test(t),
    "| zip link:", /jellypal-0\.2\.4-win\.zip/.test(t),
    "| exe hash:", /e908e2c3/.test(t),
    "| zip hash:", /60a6c5ab/.test(t),
    "| version.txt:", (await v.text()).trim());
})();
