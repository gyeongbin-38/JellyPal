const fs = require("fs");
const lines = fs.readFileSync("C:/dev/mini/typet/src/main.js", "utf8").split("\n");
for (let i = 486; i <= 780; i++) {
  const l = lines[i - 1] || "";
  if (/[^a-zA-Z_$0-9]t[^a-zA-Z_$0-9]/.test(l) && !/=>|\.t|first|latest|\bt\s*=|\bt:/.test(l))
    console.log(i + ": " + l.trim());
}
// also scan whole file for suspicious bare ' t ' math usage
console.log("--- global scan ---");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/[^a-zA-Z_$0-9.]t\s*[\*\+\-\/]/.test(l) && !/=>|\bget|\bset|const|let|var/.test(l))
    console.log(i + 1 + ": " + l.trim());
}
