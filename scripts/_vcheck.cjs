const fs = require("fs"), vm = require("vm"), path = require("path");
const root = __dirname;
const src = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
new vm.Script(src, { filename: "main.js" });
console.log("SYNTAX_OK");
