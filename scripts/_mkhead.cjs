const fs = require("fs");
const path = require("path");
let s = fs.readFileSync(path.join(__dirname, "_proptest.cjs"), "utf8");
s = s.replace('readFileSync("src/main.js"', 'readFileSync(require("path").join(__dirname, "_head_main.js")');
fs.writeFileSync(path.join(__dirname, "_proptest_head.cjs"), s);
console.log("written");
