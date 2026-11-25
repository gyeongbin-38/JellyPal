const fs = require("fs");
for (const p of ["C:/Jellypal/jellypal.exe", "C:/dev/mini/typet/src-tauri/target/release/jellypal.exe"]) {
  const b = fs.readFileSync(p);
  console.log(p, b.length, "JellypalSingleInstance:", b.includes(Buffer.from("JellypalSingleInstance")));
  for (const s of ["single-instance", "SingleInstance", "jellypal", "Local\\"]) {
    console.log("  ", s, ":", b.includes(Buffer.from(s)));
  }
}
