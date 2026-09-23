const fs = require("fs");
const b = fs.readFileSync("src-tauri/target/release/jellypal.exe");
for (const needle of ["JP2G", "ack_grants", "claim_grants", "redeem_bound", "JP2"]) {
  console.log(needle, "->", b.includes(needle));
}
