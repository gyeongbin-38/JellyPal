(async () => {
  const r = await fetch("https://jellypal.fun/");
  const t = await r.text();
  const v = await fetch("https://jellypal.fun/version.txt");
  console.log("index:", r.status,
    "| exe link:", /Jellypal_0\.2\.3_x64-setup\.exe/.test(t),
    "| zip link:", /jellypal-0\.2\.3-win\.zip/.test(t),
    "| exe hash:", /f6a0d4da/.test(t),
    "| zip hash:", /d860af60/.test(t),
    "| version.txt:", (await v.text()).trim());
})();
