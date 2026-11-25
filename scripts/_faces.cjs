// preview the new faces on a few species
const { slime, makeCanvas, savePng, text, textW, hexRgb } = require("./assets.cjs");
const faces = ["star", "wink", "cry", "pout", "content", "love"];
const picks = ["sprout", "bites", "cliff", "stella", "shade", "yule"];
const cv = makeCanvas(picks.length * 110 + 70, faces.length * 90 + 10, hexRgb("#2a2038"));
faces.forEach((f, fy) => {
  text(cv, f, 6, fy * 90 + 40, 1, hexRgb("#fff2dc"));
  picks.forEach((id, ix) => {
    slime(cv, id, 70 + ix * 110 + 45, fy * 90 + 76, 2.4, f);
  });
});
savePng(cv, "C:/Users/박남표/Desktop/mini/typet/assets/faces-new.png");
console.log("saved faces-new.png");
