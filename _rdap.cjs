const fs = require("fs");
const os = require("os");
const d = JSON.parse(fs.readFileSync(os.tmpdir() + "/jp_rdap.json", "utf8"));
console.log("status:", JSON.stringify(d.status));
for (const e of d.events || []) console.log(e.eventAction, "->", e.eventDate);
for (const n of d.nameservers || []) console.log("ns:", n.ldhName);
