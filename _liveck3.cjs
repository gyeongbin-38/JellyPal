const h = require("fs").readFileSync("jp_tmp.html", "utf8");
console.log("deskshot:", h.includes("deskshot"));
console.log("shot-desktop section:", h.includes("shot-desktop.png") && h.includes("your desktop"));
console.log("og:image kept:", h.includes('og:image" content="https://jellypal.fun/shot-desktop.png'));
console.log("300 keys copy:", h.includes("every 300"));
