const fs = require("fs");
const lines = fs.readFileSync("src/main.js", "utf8").split("\n");
lines.forEach((l, i) => {
  if (/sfx\.\w+\(/.test(l)) {
    const ctx = lines.slice(Math.max(0, i - 8), i + 1).join(" ");
    const m = ctx.match(/(every|interval|Math\.random|dt \*|now >|now -|Until|Cd|setInterval|setTimeout|for \()/g);
    if (m) console.log((i + 1) + ": " + l.trim().slice(0, 75) + "   << " + m.join(","));
  }
});
