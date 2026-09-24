const h = require("fs").readFileSync("jp_tmp.html", "utf8");
for (const s of ["PAY_LINKS", 'id="myid"', "client_reference_id", "checkout", "packbuy", "jellypic"])
  console.log((h.includes(s) ? "OK  " : "MISS") + " " + s);
