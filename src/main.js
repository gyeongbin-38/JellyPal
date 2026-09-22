const { listen } = window.__TAURI__.event;
const { invoke } = window.__TAURI__.core;

// surface silent failures: a throw inside a setInterval callback (like the
// clickable-rect updater) would otherwise die with zero log evidence and
// leave the whole overlay click-through. beforeunload marks clean teardown —
// ticks stopping with no UNLOAD means the process was killed externally
window.addEventListener("error", (e) => {
  try { invoke("log_crash", { msg: "JSERR " + (e.message || "?") + " @" + String(e.filename || "").split("/").pop() + ":" + e.lineno }); } catch {}
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  try { invoke("log_crash", { msg: "JSREJ " + String((r && (r.stack || r.message)) || r).slice(0, 400) }); } catch {}
});
window.addEventListener("beforeunload", () => {
  try { invoke("log_crash", { msg: "UNLOAD" }); } catch {}
});

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");

let winW = innerWidth;
let winH = innerHeight;
let dpr = devicePixelRatio || 1;
function fit() {
  winW = innerWidth;
  winH = innerHeight;
  dpr = devicePixelRatio || 1;
  cv.width = Math.round(winW * dpr);
  cv.height = Math.round(winH * dpr);
  cv.style.width = `${winW}px`;
  cv.style.height = `${winH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
fit();
addEventListener("resize", fit);

// ---------- sprite engine (36x26 logical grid) ----------
const SW = 36;
const SH = 26;
const CX = 18;
const HW_ROUND = [0, 4, 6, 8, 9, 10, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 12];
const HW_TALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 10];
const HW_FLAT = [0, 0, 0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 13];
const HW_SQUARE = [0, 5, 9, 11, 12, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13];
const HW_PUDDLE = [0, 0, 0, 0, 1, 3, 5, 8, 11, 13, 14, 15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 15];
const SHAPES = { round: HW_ROUND, tall: HW_TALL, flat: HW_FLAT, square: HW_SQUARE, puddle: HW_PUDDLE };

// rarity: 0 common, 1 rare, 2 epic, 3 legendary
const SPECIES = [
  { id: "sprout", name: "Sprout", r: 0, shape: "round", kr: "SNACKS ON KEYSTROKES",
    pal: { o:"#35704f",b:"#6fdca0",l:"#a9f0cb",s:"#4cb07e",e:"#23332c",w:"#ffffff",m:"#23332c",k:"#ff9fb0" },
    top: [[17,0,"l"],[19,0,"l"],[18,1,"l"]] },
  { id: "berry", name: "Berry", r: 0, shape: "round",
    pal: { o:"#7d3a56",b:"#f78fb3",l:"#ffc2d4",s:"#d4608c",e:"#33232c",w:"#ffffff",m:"#33232c",k:"#ff7f96" },
    top: [[18,0,"b"],[17,1,"b"],[19,1,"b"]] },
  { id: "pebble", name: "Pebble", r: 0, shape: "flat",
    pal: { o:"#4a5560",b:"#9aa7b0",l:"#c8d2d8",s:"#7b8892",e:"#2a3036",w:"#ffffff",m:"#2a3036",k:"#f0a0b0" },
    top: [] },
  { id: "tide", name: "Droplet", r: 1, shape: "tall", trait: "drip",
    pal: { o:"#2f5d7d",b:"#69b7ec",l:"#a9d8f7",s:"#4a90c4",e:"#1f2f3c",w:"#ffffff",m:"#1f2f3c",k:"#ffa8c0" },
    top: [[18,0,"b"],[18,1,"b"]] },
  { id: "ember", name: "Ember", r: 1, shape: "tall", trait: "spark",
    pal: { o:"#8a4b2f",b:"#f0975c",l:"#ffcfa8",s:"#d1743f",e:"#33231c",w:"#ffffff",m:"#33231c",k:"#ff6b6b" },
    top: [[18,0,"k"],[17,1,"k"],[19,1,"k"]] },
  { id: "mochi", name: "Mochi", r: 1, shape: "round", kr: "NIBBLES KEYSTROKES",
    pal: { o:"#9a7f88",b:"#f5e6ea",l:"#ffffff",s:"#d9c2ca",e:"#3a2f33",w:"#ffffff",m:"#3a2f33",k:"#ff9fb0" },
    top: [[25,2,"v"],[26,3,"v"],[25,4,"v"],[29,2,"v"],[28,3,"v"],[29,4,"v"],[27,3,"v"]] },
  { id: "shade", name: "Shade", r: 2, shape: "flat", trait: "wisp", sig: "umbral",
    pal: { o:"#43346b",b:"#9b86d9",l:"#c4b2f0",s:"#7a62b8",e:"#1e1830",w:"#ffffff",m:"#1e1830",k:"#c08497" },
    top: [[7,2,"b"],[28,2,"b"],[6,3,"b"],[29,3,"b"]] },
  { id: "prism", name: "Prism", r: 2, shape: "round", trait: "glint", sig: "spectrum",
    pal: { o:"#6b4a8a",b:"#b9a5f0",l:"#e0d4ff",s:"#8a72c4",e:"#241c33",w:"#ffffff",m:"#241c33",k:"#ffb0d0" },
    top: [[9,9,"g"],[10,9,"g"],[11,9,"g"],[12,9,"g"],[13,9,"g"],[14,9,"g"],
          [21,9,"g"],[22,9,"g"],[23,9,"g"],[24,9,"g"],[25,9,"g"],[26,9,"g"],
          [9,10,"g"],[9,14,"g"],[14,10,"g"],[14,14,"g"],[21,10,"g"],[21,14,"g"],[26,10,"g"],[26,14,"g"],
          [9,15,"g"],[10,15,"g"],[11,15,"g"],[12,15,"g"],[13,15,"g"],[14,15,"g"],
          [21,15,"g"],[22,15,"g"],[23,15,"g"],[24,15,"g"],[25,15,"g"],[26,15,"g"],
          [15,11,"g"],[16,11,"g"],[17,11,"g"],[18,11,"g"],[19,11,"g"],[20,11,"g"]] },
  { id: "gold", name: "Goldie", r: 3, shape: "round", trait: "glint", mv: "hover", sig: "shower",
    pal: { o:"#8a6b1f",b:"#eec23f",l:"#ffe98f",s:"#c99a2a",e:"#3a2f12",w:"#ffffff",m:"#3a2f12",k:"#ff9fb0" },
    top: [[16,0,"c"],[18,0,"c"],[17,0,"c"],[15,1,"c"],[16,1,"c"],[17,1,"c"],[18,1,"c"],[19,1,"c"]] },
  { id: "moss", name: "Moss", r: 0, shape: "flat",
    pal: { o:"#2e5233",b:"#5d9e4f",l:"#8cc97a",s:"#467a3c",e:"#1f2b20",w:"#ffffff",m:"#1f2b20",k:"#ff9fb0" },
    top: [[13,2,"v"],[14,1,"v"],[15,2,"v"],[14,3,"w"],[22,2,"v"],[23,1,"v"],[24,2,"v"],[23,3,"w"]] },
  { id: "candy", name: "Candy", r: 1, shape: "round",
    pal: { o:"#8a4a6e",b:"#ff9ec6",l:"#ffd9ea",s:"#e06ba0",e:"#33202b",w:"#ffffff",m:"#33202b",k:"#ff5f8a" },
    top: [[10,3,"w"],[11,3,"w"],[12,4,"w"],[24,3,"w"],[25,3,"w"],[26,4,"w"],[17,0,"w"],[18,0,"w"],[19,0,"w"]] },
  { id: "frost", name: "Frost", r: 1, shape: "tall",
    pal: { o:"#3f6f8a",b:"#a8ddf0",l:"#e0f6ff",s:"#7ab8d4",e:"#1e3038",w:"#ffffff",m:"#1e3038",k:"#ffb0c8" },
    top: [[16,0,"w"],[18,0,"l"],[20,0,"w"],[17,1,"l"],[19,1,"l"],[18,2,"w"]] },
  { id: "bloom", name: "Bloom", r: 1, shape: "round",
    pal: { o:"#7a4a5e",b:"#ffb0c8",l:"#ffe0ea",s:"#e08aa8",e:"#33222b",w:"#ffffff",m:"#33222b",k:"#ff7f96" },
    top: [[17,0,"v"],[19,0,"v"],[16,1,"v"],[18,1,"c"],[20,1,"v"],[17,2,"v"],[19,2,"v"]] },
  { id: "kitty", name: "Kitty", r: 2, shape: "round", sig: "pounce",
    pal: { o:"#8a6238",b:"#f0c078",l:"#ffe8c0",s:"#d19a52",e:"#33291c",w:"#ffffff",m:"#33291c",k:"#ff8fb0" },
    top: [[10,1,"b"],[11,0,"b"],[25,0,"b"],[26,1,"b"],[11,1,"k"],[25,1,"k"]] },
  { id: "bolt", name: "Bolt", r: 2, shape: "tall", sig: "zap",
    pal: { o:"#4a5560",b:"#a8b8c8",l:"#d8e4ec",s:"#788a98",e:"#20262c",w:"#8fd4f0",m:"#20262c",k:"#8fd4f0" },
    top: [[18,0,"c"],[17,1,"s"],[18,1,"s"],[19,1,"s"],[18,2,"s"]] },
  { id: "void", name: "Void", r: 2, shape: "flat", sig: "voidpull",
    pal: { o:"#1c1626",b:"#4a3f6b",l:"#6b5a9e",s:"#332a4a",e:"#0f0c18",w:"#ffffff",m:"#0f0c18",k:"#8a6bd9" },
    top: [[10,6,"c"],[26,7,"c"],[15,4,"c"],[22,5,"c"],[12,8,"w"],[28,9,"w"],[8,10,"c"]] },
  { id: "stella", name: "Stella", r: 3, shape: "round", trait: "glint", mv: "blink", sig: "starburst",
    pal: { o:"#2a2f5e",b:"#5a6bd9",l:"#9aadff",s:"#3f4aa8",e:"#181c33",w:"#ffffff",m:"#181c33",k:"#ffd75e" },
    top: [[18,0,"c"],[17,1,"c"],[19,1,"c"],[18,2,"c"],[10,7,"c"],[26,8,"c"],[14,5,"w"],[23,6,"w"],[12,9,"w"],[28,10,"c"],
          [4,9,"w"],[3,10,"w"],[4,10,"w"],[5,10,"w"],[32,9,"w"],[33,10,"w"],[32,10,"w"],[31,10,"w"]] },
  { id: "mud", name: "Mud", r: 0, shape: "flat",
    pal: { o:"#4a3a28",b:"#8a6b45",l:"#b89a6e",s:"#6b5238",e:"#241c12",w:"#ffffff",m:"#241c12",k:"#c98a6b" },
    top: [[12,4,"s"],[24,3,"s"],[16,2,"o"],[27,5,"s"]] },
  { id: "sunny", name: "Sunny", r: 0, shape: "round",
    pal: { o:"#a86b2a",b:"#ffd75e",l:"#fff0a8",s:"#e0a83f",e:"#33291c",w:"#ffffff",m:"#33291c",k:"#ff8fb0" },
    top: [[17,0,"l"],[19,0,"l"],[18,1,"l"],[13,2,"l"],[23,2,"l"]] },
  { id: "bubble", name: "Bubble", r: 1, shape: "round", trait: "bubble",
    pal: { o:"#5a8fa8",b:"#b8e8f5",l:"#e8fbff",s:"#8cc8de",e:"#1e3038",w:"#ffffff",m:"#1e3038",k:"#ffb0c8" },
    top: [[12,3,"w"],[24,4,"w"],[15,5,"l"],[27,7,"w"],[9,8,"l"]] },
  { id: "inky", name: "Inky", r: 1, shape: "tall",
    pal: { o:"#3a2a4a",b:"#6b4a8a",l:"#9a72b8",s:"#4e3560",e:"#1a1226",w:"#ffffff",m:"#1a1226",k:"#b86bd9" },
    top: [[10,2,"b"],[26,2,"b"],[9,4,"b"],[27,4,"b"],[18,0,"s"],[18,1,"s"]] },
  { id: "cliff", name: "Cliff", r: 3, shape: "flat", trait: "climb", mv: "walk", sig: "landslide",
    pal: { o:"#4a4038",b:"#8a7a68",l:"#b8a88e",s:"#68584a",e:"#26201a",w:"#ffffff",m:"#26201a",k:"#d98a6b" },
    top: [[11,3,"s"],[14,4,"s"],[22,3,"s"],[25,5,"s"],[18,1,"l"],[9,6,"l"]] },
  { id: "bites", name: "Bites", r: 3, shape: "round", trait: "chomp", mv: "scurry", sig: "frenzy", kr: "EATS KEYSTROKES",
    pal: { o:"#7d2a3a",b:"#e05a6e",l:"#ffa8b8",s:"#b84055",e:"#2b1015",w:"#ffffff",m:"#2b1015",k:"#ffd75e" },
    top: [[16,0,"w"],[17,0,"w"],[18,0,"w"],[19,0,"w"],[20,0,"w"],[17,1,"w"],[18,1,"w"],[19,1,"w"],[18,2,"w"]] },
  { id: "choco", name: "Choco", r: 0, shape: "round",
    pal: { o:"#4a2e1c",b:"#8a5a36",l:"#b8865a",s:"#6b4226",e:"#241610",w:"#ffffff",m:"#241610",k:"#e08a6b" },
    top: [[14,2,"s"],[22,3,"s"],[18,1,"s"]] },
  { id: "lime", name: "Lime", r: 0, shape: "round",
    pal: { o:"#3f6b2a",b:"#8fd44f",l:"#c2f08a",s:"#6bab3f",e:"#1e2b14",w:"#ffffff",m:"#1e2b14",k:"#ff9fb0" },
    top: [[18,0,"l"],[17,1,"l"],[19,1,"l"],[18,2,"s"]] },
  { id: "grape", name: "Grape", r: 0, shape: "round",
    pal: { o:"#4e3560",b:"#8a5aa8",l:"#b88ad4",s:"#6b4285",e:"#241626",w:"#ffffff",m:"#241626",k:"#ff9fb0" },
    top: [[17,0,"b"],[19,0,"b"],[18,1,"b"]] },
  { id: "peach", name: "Peach", r:0, shape: "round",
    pal: { o:"#8a5a45",b:"#ffb894",l:"#ffd9c2",s:"#e0926b",e:"#332016",w:"#ffffff",m:"#332016",k:"#ff7f96" },
    top: [[18,0,"v"],[17,1,"s"],[19,1,"s"]] },
  { id: "coal", name: "Coal", r: 0, shape: "flat",
    pal: { o:"#1a1c20",b:"#3d4248",l:"#5d646c",s:"#2a2e34",e:"#101216",w:"#ffffff",m:"#101216",k:"#c96b5a" },
    top: [[12,3,"l"],[24,4,"l"],[18,2,"s"]] },
  { id: "cloud", name: "Cloud", r: 0, shape: "puddle",
    pal: { o:"#7a8fa0",b:"#dfeaf2",l:"#ffffff",s:"#b8cdd8",e:"#2c3842",w:"#ffffff",m:"#2c3842",k:"#ffb0c8" },
    top: [[10,4,"w"],[14,3,"w"],[26,4,"w"],[22,3,"w"]] },
  { id: "bean", name: "Bean", r: 0, shape: "tall", kr: "WIGGLES WHEN YOU TYPE",
    pal: { o:"#6b2a2a",b:"#c95a4a",l:"#f08a72",s:"#a84034",e:"#2b1414",w:"#ffffff",m:"#2b1414",k:"#ff9fb0" },
    top: [[18,0,"b"]] },
  { id: "snowy", name: "Snowy", r: 0, shape: "round",
    pal: { o:"#7a92a8",b:"#eef5fb",l:"#ffffff",s:"#c4d8e8",e:"#2c3842",w:"#ffffff",m:"#2c3842",k:"#ffb0d0" },
    top: [[14,2,"l"],[22,2,"l"],[18,1,"l"]] },
  { id: "rust", name: "Rusty", r: 0, shape: "flat",
    pal: { o:"#5d3a24",b:"#b8773f",l:"#d99a5e",s:"#8f5a30",e:"#2b1c10",w:"#ffffff",m:"#2b1c10",k:"#d98a6b" },
    top: [[11,4,"s"],[25,3,"s"],[17,2,"o"]] },
  { id: "waffle", name: "Waffle", r: 0, shape: "square",
    pal: { o:"#8a5f30",b:"#e8b05e",l:"#ffd494",s:"#c48f42",e:"#332412",w:"#ffffff",m:"#332412",k:"#ff9fb0" },
    top: [[14,4,"s"],[18,4,"s"],[22,4,"s"],[14,8,"s"],[22,8,"s"],[14,12,"s"],[22,12,"s"]] },
  { id: "cherry", name: "Cherry", r: 1, shape: "round",
    pal: { o:"#6b1f2e",b:"#e0405e",l:"#ff7f94",s:"#b02e48",e:"#2b0e14",w:"#ffffff",m:"#2b0e14",k:"#ff9fb0" },
    top: [[18,0,"o"],[18,1,"o"],[17,2,"o"]] },
  { id: "ocean", name: "Ocean", r: 1, shape: "tall", trait: "drip",
    pal: { o:"#1f3a6b",b:"#3f6bc4",l:"#7a9fe8",s:"#2e4f9a",e:"#141e33",w:"#ffffff",m:"#141e33",k:"#8fd4f0" },
    top: [[18,0,"l"],[18,1,"l"]] },
  { id: "minty", name: "Minty", r: 1, shape: "round",
    pal: { o:"#2a6b52",b:"#7de0b0",l:"#b8f5d8",s:"#52b885",e:"#142b20",w:"#ffffff",m:"#142b20",k:"#ff9fb0" },
    top: [[16,0,"w"],[20,0,"w"],[18,1,"w"]] },
  { id: "taro", name: "Taro", r: 1, shape: "puddle",
    pal: { o:"#5a4a7d",b:"#a88ad4",l:"#cbb4ec",s:"#8468b0",e:"#241c33",w:"#ffffff",m:"#241c33",k:"#ffb0d0" },
    top: [[12,5,"s"],[24,4,"s"]] },
  { id: "honey", name: "Honey", r: 1, shape: "round", trait: "drip",
    pal: { o:"#8a6b1f",b:"#f0b53f",l:"#ffd98a",s:"#c4932a",e:"#33260e",w:"#ffffff",m:"#33260e",k:"#ff9f6b" },
    top: [[18,0,"b"],[18,1,"b"],[18,2,"s"]] },
  { id: "coral", name: "Coral", r: 1, shape: "tall",
    pal: { o:"#8a4a3f",b:"#ff8a6e",l:"#ffb8a4",s:"#d96b52",e:"#331e16",w:"#ffffff",m:"#331e16",k:"#ffd75e" },
    top: [[16,0,"b"],[20,0,"b"],[15,1,"b"],[21,1,"b"],[18,1,"b"]] },
  { id: "slate", name: "Slate", r: 1, shape: "square",
    pal: { o:"#3a4552",b:"#78889a",l:"#a8bcca",s:"#5a6a7a",e:"#1c232c",w:"#ffffff",m:"#1c232c",k:"#8fd4f0" },
    top: [[14,3,"s"],[22,3,"s"],[18,6,"l"]] },
  { id: "fungi", name: "Fungi", r: 1, shape: "flat",
    pal: { o:"#4a3d28",b:"#9a7d52",l:"#c4a878",s:"#7a6240",e:"#241c10",w:"#ffffff",m:"#241c10",k:"#e08a6b" },
    top: [[13,1,"v"],[14,0,"v"],[15,1,"v"],[14,2,"w"],[22,2,"v"],[23,1,"v"],[24,2,"v"],[23,3,"w"]] },
  { id: "aurora", name: "Aurora", r: 2, shape: "tall", trait: "glint", sig: "veil",
    pal: { o:"#2a4a6b",b:"#5ad4c4",l:"#a4f0e4",s:"#3aa898",e:"#14242e",w:"#ffffff",m:"#14242e",k:"#b88ad4" },
    top: [[14,4,"k"],[22,5,"c"],[18,3,"w"],[26,7,"k"]] },
  { id: "toxic", name: "Toxic", r: 2, shape: "puddle", trait: "wisp", sig: "bubbleup",
    pal: { o:"#3d5a1f",b:"#8ee03f",l:"#c4f58a",s:"#66b02e",e:"#1c2b0e",w:"#ffffff",m:"#1c2b0e",k:"#e0ff5e" },
    top: [[11,5,"k"],[25,4,"k"],[18,3,"s"]] },
  { id: "mecha", name: "Mecha", r: 2, shape: "square", trait: "spark", sig: "beep", kr: "BEEPS AT EACH KEY",
    pal: { o:"#2e343c",b:"#98a4b0",l:"#c8d4dc",s:"#6a7682",e:"#181c22",w:"#ffb02e",m:"#181c22",k:"#ffb02e" },
    top: [[18,0,"k"],[18,1,"s"],[12,4,"k"],[24,4,"k"]] },
  { id: "ghost", name: "Ghost", r: 2, shape: "puddle", trait: "wisp", mv: "hover", sig: "phase",
    pal: { o:"#8a94b0",b:"#e8ecf4",l:"#ffffff",s:"#c0c8dc",e:"#3a4256",w:"#ffffff",m:"#3a4256",k:"#b0d4f0" },
    top: [[12,3,"w"],[24,3,"w"]] },
  { id: "astro", name: "Astro", r: 2, shape: "round", trait: "glint", mv: "hover", sig: "orbit",
    pal: { o:"#1c2340",b:"#3a4a8a",l:"#6b7ec4",s:"#2a3668",e:"#10142a",w:"#ffffff",m:"#10142a",k:"#ffd75e" },
    top: [[14,3,"c"],[24,5,"w"],[19,4,"c"],[11,7,"w"]] },
  { id: "ninja", name: "Ninja", r: 2, shape: "round", mv: "scurry", sig: "smokebomb",
    pal: { o:"#14161c",b:"#2e343e",l:"#4a545e",s:"#20242c",e:"#0a0c10",w:"#ffffff",m:"#0a0c10",k:"#e04050" },
    top: [[9,7,"k"],[10,7,"k"],[11,7,"k"],[12,7,"k"],[13,7,"k"],[14,7,"k"],[15,7,"k"],[16,7,"k"],[20,7,"k"],[21,7,"k"],[22,7,"k"],[23,7,"k"],[24,7,"k"],[25,7,"k"],[26,7,"k"],[27,7,"k"]] },
  { id: "comet", name: "Comet", r: 3, shape: "tall", trait: "spark", mv: "blink", sig: "reentry",
    pal: { o:"#8a3a1f",b:"#ff7a3f",l:"#ffbf8a",s:"#d9522a",e:"#331410",w:"#ffffff",m:"#331410",k:"#8fd4f0" },
    top: [[18,0,"c"],[17,1,"c"],[19,1,"c"],[16,2,"k"]] },
  { id: "molten", name: "Molten", r: 3, shape: "flat", trait: "spark", mv: "walk", sig: "eruption",
    pal: { o:"#2a1010",b:"#5e2020",l:"#e85a2a",s:"#3d1616",e:"#1a0a0a",w:"#ffd75e",m:"#1a0a0a",k:"#ff8a2a" },
    top: [[12,4,"l"],[20,3,"l"],[26,5,"l"],[15,6,"k"]] },
  { id: "siren", name: "Siren", r: 3, shape: "round", trait: "glint", mv: "hover", sig: "song",
    pal: { o:"#5e2a6b",b:"#f08ad4",l:"#ffc2ec",s:"#c45ab0",e:"#2b1030",w:"#ffffff",m:"#2b1030",k:"#7de8f0" },
    top: [[18,0,"k"],[17,1,"k"],[19,1,"k"],[13,3,"w"],[23,3,"w"]] },
  // seasonal event slimes — only pullable inside their date window
  { id: "pumkin", name: "Pumkin", r: 1, shape: "round", trait: "glint", season: "halloween",
    pal: { o:"#8a4a1f",b:"#f08a2a",l:"#ffbf6e",s:"#d16a1f",e:"#33200f",w:"#ffffff",m:"#33200f",k:"#7de83f" },
    top: [[18,0,"k"],[17,1,"k"],[19,1,"k"],[18,2,"k"]] },
  { id: "yule", name: "Yule", r: 2, shape: "round", trait: "glint", season: "winter", sig: "jingle",
    pal: { o:"#7a1f2a",b:"#e0455a",l:"#ff9aa8",s:"#b03045",e:"#2b0f15",w:"#ffffff",m:"#2b0f15",k:"#4fbd63" },
    top: [[14,0,"w"],[22,0,"w"],[15,1,"w"],[21,1,"w"],[16,2,"w"],[17,2,"w"],[18,2,"w"],[19,2,"w"],[20,2,"w"]] },
  // --- legendaries: each with a concept-matched quirk on top of a signature ---
  { id: "spidr", name: "Webby", r: 3, shape: "round", trait: "web", mv: "scurry", sig: "webshot",
    pal: { o:"#3a2a4a",b:"#6b4a8a",l:"#9a72b8",s:"#4e3560",e:"#1a1226",w:"#ffffff",m:"#1a1226",k:"#e05a6e" },
    top: [[17,3,"k"],[19,3,"k"],[16,4,"k"],[20,4,"k"],[18,5,"k"],
          [5,10,"o"],[4,12,"o"],[31,10,"o"],[32,12,"o"],[5,16,"o"],[4,18,"o"],[31,16,"o"],[32,18,"o"]] },
  { id: "drago", name: "Drago", r: 3, shape: "round", trait: "spark", mv: "walk", sig: "firebreath",
    pal: { o:"#2e5233",b:"#4a9e5f",l:"#8cd9a0",s:"#3c7a4a",e:"#14291c",w:"#ffffff",m:"#14291c",k:"#ff8a3f" },
    top: [[13,0,"s"],[23,0,"s"],[12,1,"s"],[24,1,"s"],[18,2,"s"],[18,3,"s"]] },
  { id: "pulsar", name: "Pulsar", r: 3, shape: "round", trait: "gravity", mv: "hover", sig: "singularity",
    pal: { o:"#1c1626",b:"#5a4a8e",l:"#9a8ad9",s:"#3a2f5e",e:"#0f0c18",w:"#ffffff",m:"#0f0c18",k:"#8ad4f0" },
    top: [[15,2,"l"],[21,2,"l"],[14,3,"l"],[22,3,"l"],[18,4,"k"],[18,5,"k"]] },
  { id: "rex", name: "Rex", r: 3, shape: "round", trait: "royal", mv: "walk", sig: "decree",
    pal: { o:"#4a2a5e",b:"#8a5ac4",l:"#c09af0",s:"#6b4294",e:"#241233",w:"#ffffff",m:"#241233",k:"#ffd75e" },
    top: [[14,0,"k"],[18,0,"k"],[22,0,"k"],[14,1,"k"],[15,1,"k"],[16,1,"k"],[17,1,"k"],[18,1,"k"],[19,1,"k"],[20,1,"k"],[21,1,"k"],[22,1,"k"]] },
  // --- epics ---
  { id: "pinata", name: "Pinata", r: 2, shape: "round", trait: "glint", mv: "scurry", sig: "burst",
    pal: { o:"#8a4a6e",b:"#ff9ec6",l:"#ffd9ea",s:"#e06ba0",e:"#33202b",w:"#ffffff",m:"#33202b",k:"#5ad4c4" },
    top: [[14,2,"k"],[18,2,"w"],[22,2,"k"],[15,3,"w"],[19,3,"k"],[23,3,"w"],[16,4,"k"],[20,4,"w"],[18,5,"k"]] },
  { id: "lant", name: "Lanty", r: 2, shape: "tall", trait: "wisp", mv: "hover", sig: "flare",
    pal: { o:"#8a6b2a",b:"#f0c95a",l:"#fff0a8",s:"#d9a83f",e:"#33291c",w:"#ffffff",m:"#33291c",k:"#ff8fb8" },
    top: [[17,0,"s"],[19,0,"s"],[18,1,"s"],[14,4,"w"],[22,4,"w"],[18,5,"l"]] },
  { id: "dice", name: "Dicey", r: 2, shape: "square", trait: "glint", mv: "scurry", sig: "rollout",
    pal: { o:"#3a3f4a",b:"#e8ecf4",l:"#ffffff",s:"#b8c0cc",e:"#262a33",w:"#ffffff",m:"#262a33",k:"#e05a6e" },
    top: [[10,3,"e"],[26,3,"e"],[12,5,"e"],[24,5,"e"],[18,4,"e"]] },
  { id: "frog", name: "Hops", r: 2, shape: "flat", trait: "drip", mv: "hop", sig: "ribbit",
    pal: { o:"#2a6b3a",b:"#5dc46f",l:"#a0e8ac",s:"#3f9e52",e:"#14291a",w:"#ffffff",m:"#14291a",k:"#ff9fb0" },
    top: [[13,0,"b"],[23,0,"b"],[13,1,"e"],[23,1,"e"]] },
];
// seasonal availability windows [month, day] (month is 0-based)
const SEASONS = {
  halloween: [[9, 24], [10, 3]],  // Oct 24 - Nov 3
  winter: [[11, 18], [0, 5]],     // Dec 18 - Jan 5
};
function seasonOpen(sp) {
  if (!sp.season) return true;
  const [a, b] = SEASONS[sp.season];
  const d = new Date().getMonth() * 100 + new Date().getDate();
  const lo = a[0] * 100 + a[1], hi = b[0] * 100 + b[1];
  // winter wraps the year boundary (Dec->Jan); halloween does not
  return lo <= hi ? (d >= lo && d <= hi) : (d >= lo || d <= hi);
}
const RARITY_COLOR = ["#a8845c", "#4a90c4", "#a86bd9", "#eec23f"];
const RARITY_NAME = ["COMMON", "RARE", "EPIC", "LEGEND"];

// personality archetypes: multiply core behavior knobs so species FEEL
// different, not just look different
//   pace    = multiplier on time between autonomous acts (lower = busier)
//   spd     = walk/run speed multiplier
//   follow  = cursor-follow distance & enthusiasm multiplier
//   sleep   = multiplier on time-to-sleep (lower = nods off sooner)
//   startle = startle sensitivity (higher = scares easier)
//   flee    = shy: walks AWAY from the cursor instead of toward it
const PSYCH = {
  hyper:  { pace: 0.55, spd: 1.35, follow: 1.2, sleep: 1.4, startle: 1.4 },
  bouncy: { pace: 0.8,  spd: 1.15, follow: 1.0, sleep: 1.0, startle: 1.1 },
  calm:   { pace: 1.7,  spd: 0.7,  follow: 0.8, sleep: 0.9, startle: 0.7 },
  lazy:   { pace: 2.2,  spd: 0.6,  follow: 0.5, sleep: 0.6, startle: 0.5 },
  shy:    { pace: 1.1,  spd: 0.9,  follow: 0.4, sleep: 1.0, startle: 0.5, flee: true },
  bold:   { pace: 0.8,  spd: 1.1,  follow: 1.6, sleep: 1.1, startle: 1.6 },
};
const SILH = { o:"#2a2f35",b:"#3a4048",l:"#454c55",s:"#31373f",e:"#22262b",w:"#22262b",m:"#22262b",k:"#22262b" };

// bestiary flavor text for the per-slime info panel (all caps, font-safe)
const PSY_INFO = {
  hyper: "ACTS 2X AS OFTEN",
  bouncy: "HOPS AROUND",
  calm: "SLOW AND STEADY",
  lazy: "SLEEPS EARLY",
  shy: "FLEES THE CURSOR",
  bold: "SEEKS THE CURSOR",
};
const TRAIT_INFO = {
  drip: "DRIPS WATER AS IT HOPS",
  spark: "SPARKS WHEN EXCITED",
  wisp: "LEAVES A GHOSTLY TRAIL",
  glint: "GLITTERS AT RANDOM",
  bubble: "BLOWS BUBBLES",
  climb: "CLIMBS WINDOW EDGES",
  chomp: "EATS FILES FOR GEMS",
  web: "DANGLES FROM YOUR CURSOR",
  gravity: "PULLS SNACKS CLOSER",
  royal: "PALS GATHER ROUND",
};
const MV_INFO = {
  walk: "WADDLES ABOUT",
  hover: "FLOATS OFF THE FLOOR",
  blink: "TELEPORTS IN BURSTS",
  scurry: "SCURRIES, MOUTH OPEN",
  hop: "HOPS INSTEAD OF WALKING",
};
const SIG_INFO = {
  pounce: "POUNCE - LEAPS AT CURSOR",
  zap: "ZAP - STATIC DISCHARGE",
  voidpull: "VOID - INHALES PARTICLES",
  veil: "VEIL - AURORA CURTAIN",
  bubbleup: "BUBBLE - TOXIC POP",
  beep: "BEEP - TRIPLE CHIRP",
  phase: "PHASE - FADES OUT",
  orbit: "ORBIT - CIRCLING STARS",
  smokebomb: "SMOKE - VANISH + MOVE",
  shower: "SHOWER - GOLD FOUNTAIN",
  starburst: "BURST - RING OF STARS",
  reentry: "REENTRY - METEOR SLAM",
  eruption: "ERUPT - LAVA VENT",
  song: "SONG - NOTES + HEARTS",
  webshot: "WEBSHOT - ZIPS UP A SILK LINE",
  firebreath: "BREATH - CONE OF FIRE",
  singularity: "VOID - GRAVITY WELL",
  decree: "DECREE - ROYAL LEAP",
  burst: "BURST - CANDY POP",
  flare: "FLARE - BRIGHT PULSE",
  rollout: "ROLL - TUMBLE + PIPS",
  ribbit: "RIBBIT - BIG CROAK",
  landslide: "SLAM - ROCKSLIDE IMPACT",
  frenzy: "FRENZY - CHOMPING DASH",
  umbral: "UMBRAL - MELTS TO SHADOW",
  spectrum: "SPECTRUM - RAINBOW SPLIT",
  jingle: "JINGLE - FESTIVE SHOWER",
};

// one-line lore per species ("|" splits onto a second line)
const FLAVOR = {
  sprout: "SPROUTED IN THE KEYBOARD TRAY|FEEDS ON WARM KEYSTROKES",
  berry: "SWEETEST OF THE PATCH|STICKS TO FRIENDS",
  pebble: "A ROCK THAT DREAMS|OF BEING A BOULDER",
  tide: "A DROP OF THE OCEAN|STILL HUMMING THE SEA",
  ember: "A SPARK THAT REFUSED|TO GO OUT",
  mochi: "POUNDED A THOUSAND TIMES|STILL SOFT INSIDE",
  shade: "THE SHADOW UNDER YOUR DESK|LEARNED TO LOVE YOU",
  prism: "BENDS LIGHT INTO LUCK|COLLECTS RAINBOWS",
  gold: "STRUCK GOLD, THEN BECAME IT|TIPS THE ODDS YOUR WAY",
  moss: "GROWS WHERE TIME SLOWS DOWN|NAPS ARE SACRED",
  candy: "99 PERCENT SUGAR|1 PERCENT PURE JOY",
  frost: "WINTER'S FIRST SNOWFLAKE|NEVER TOUCHED THE GROUND",
  bloom: "BLOOMS ONLY WHEN NOBODY|IS WATCHING",
  kitty: "NINE LIVES, TEN NAPS|ONE VERY SHARP POUNCE",
  bolt: "STATIC LEFT OVER FROM A STORM|STILL CRACKLING",
  void: "A PIECE OF DEEP SPACE|THAT FOLLOWED YOU HOME",
  stella: "FELL OFF A CONSTELLATION|STILL GETS FAN MAIL",
  mud: "PUDDLE ROYALTY|REIGNS OVER RAINY DAYS",
  sunny: "A SUNBEAM IN A JAR|BATTERY NOT REQUIRED",
  bubble: "ONE POP AWAY FROM GREATNESS|TOO BUSY FLOATING",
  inky: "A SPILLED WORD PROCESSOR|WRITE IT A STORY",
  cliff: "CLIMBS WALLS AND HEARTS|NEVER LOOKS DOWN",
  bites: "CHEWED THROUGH A ZIP FILE|YOUR CURSOR IS NEXT",
  choco: "100 PERCENT COCOA|ZERO PERCENT SHARING",
  lime: "SOUR OUTSIDE, SWEET INSIDE|MOSTLY SOUR",
  grape: "A WHOLE BUNCH IN ONE BODY|WINE NOT",
  peach: "FUZZY AND PROUD OF IT|SUMMER'S FAVORITE",
  coal: "DIAMOND IN TRAINING|EXTREMELY PATIENT",
  cloud: "RAINED ITSELF DRY|NOW JUST VIBES",
  bean: "THINKS EVERY KEY IS A BEAN|WIGGLES TO PROVE IT",
  snowy: "A SNOWBALL WITH PLANS|FOR ETERNAL WINTER",
  rust: "OLD MACHINE, YOUNG HEART|SQUEAKS WITH PRIDE",
  waffle: "SYRUP MAKES IT STRONGER|BUTTER MAKES IT HAPPY",
  cherry: "ALWAYS ON TOP|LITERALLY",
  ocean: "SEVEN SEAS IN ONE DROP|DO NOT TIP OVER",
  minty: "STAYS FRESH OUT OF|PURE POLITENESS",
  taro: "BETTER IN MILK TEA|AND IT KNOWS IT",
  honey: "STICKY SINCE BIRTH|PROUD OF EVERY DROP",
  coral: "REEF GUARDIAN, POCKET SIZE|GLOWS AT DUSK",
  slate: "FLAT BUT DEEP|WRITES ITS OWN HISTORY",
  fungi: "GROWS ON WHATEVER IS WARM|YOUR LAPTOP COUNTS",
  aurora: "NIGHT SKY SOUVENIR|WEAVES CURTAINS OF LIGHT",
  toxic: "SPICY, NOT MEAN|HANDLE WITH GLOVES",
  mecha: "RUNS ON CRUMBS|AND VERY TINY MOTORS",
  ghost: "PASSED AWAY FROM BOREDOM|STAYS FOR THE FUN",
  astro: "A LITTLE UNIVERSE|ORBITING ITSELF",
  ninja: "UNSEEN EVEN BY ITSELF|ACCEPTING APPLAUSE NOW",
  comet: "MISSED ITS SOLAR SYSTEM|YOURS WILL DO",
  molten: "A TINY VOLCANO|FEELS EVERYTHING DEEPLY",
  siren: "VOICE OF THE DEEP|FREE CONCERTS AT 3AM",
  pumkin: "CARVED WITH CARE|COMES BACK EVERY FALL",
  yule: "GIFT-WRAPPED BY WINTER|TOO CUTE TO OPEN",
  spidr: "WOVEN FROM MOONLIT SILK|YOUR CURSOR IS HOME",
  drago: "A DRAGON THAT STAYED LITTLE|KEEP IT WARM",
  pulsar: "HEART OF A DEAD STAR|STILL BEATING",
  rex: "CROWNED BEFORE BIRTH|EVERYONE AGREED",
  pinata: "FULL OF SURPRISES|DO NOT SHAKE (DO SHAKE)",
  lant: "CARRIES ITS OWN LIGHT|NEVER FEARS THE DARK",
  dice: "ALWAYS ROLLS HIGH|NOBODY KNOWS WHY",
  frog: "EVERY POND IS A THRONE|RIBBIT IS ROYAL",
  hyb: "BORN RIGHT ON THIS DESKTOP|ONE OF A KIND",
};

const APP_VER = "0.2.0";

// species -> personality assignment (hybrids inherit one parent's)
const PSY_ASSIGN = {
  sprout: "bouncy", berry: "bouncy", pebble: "calm", tide: "calm", ember: "hyper",
  mochi: "lazy", shade: "shy", prism: "calm", gold: "bold", moss: "lazy",
  candy: "hyper", frost: "calm", bloom: "bouncy", kitty: "hyper", bolt: "hyper",
  void: "calm", stella: "bold", mud: "lazy", sunny: "hyper", bubble: "bouncy",
  inky: "shy", cliff: "calm", bites: "hyper", choco: "calm", lime: "bouncy",
  grape: "shy", peach: "bouncy", coal: "lazy", cloud: "lazy", bean: "hyper",
  snowy: "shy", rust: "calm", waffle: "lazy", cherry: "hyper", ocean: "calm",
  minty: "shy", taro: "lazy", honey: "lazy", coral: "bouncy", slate: "calm",
  fungi: "lazy", aurora: "bold", toxic: "bold", mecha: "calm", ghost: "shy",
  astro: "bold", ninja: "hyper", comet: "hyper", molten: "bold", siren: "bold",
  pumkin: "bouncy", yule: "calm",
  spidr: "bold", drago: "hyper", pulsar: "calm", rex: "bold",
  pinata: "hyper", lant: "shy", dice: "bouncy", frog: "bouncy",
};
for (const s of SPECIES) s.ps = PSY_ASSIGN[s.id];

// accessories: drawn with fillRect pixels, anchored to slime top-center.
// dy = units below the anchor (specs sit at eye level).
const ACCS = [
  { id: "cap", name: "CAP", dy: -1 },
  { id: "specs", name: "SPECS", dy: 9 },
  { id: "bow", name: "BOW", dy: 0 },
  { id: "crown", name: "CROWN", dy: -1 },
  { id: "tophat", name: "TOPHAT", dy: -1 },
  { id: "halo", name: "HALO", dy: -5 },
  { id: "party", name: "PARTY", dy: -1 },
  { id: "flower", name: "FLOWER", dy: 0 },
  { id: "phones", name: "PHONES", dy: 1 },
  { id: "stache", name: "STACHE", dy: 13 },
  { id: "patch", name: "PATCH", dy: 9 },
  { id: "shades", name: "SHADES", dy: 9 },
  { id: "antenna", name: "ANTENNA", dy: -1 },
  { id: "leaf", name: "LEAF", dy: -1 },
  { id: "beanie", name: "BEANIE", dy: -1 },
  { id: "horns", name: "HORNS", dy: 0 },
  { id: "band", name: "BAND", dy: 3 },
  { id: "wiz", name: "WIZARD", dy: -1 },
  { id: "mohawk", name: "MOHAWK", dy: -1 },
  { id: "prop", name: "PROPEL", dy: -1 },
  { id: "scarf", name: "SCARF", dy: 15 },
  { id: "beret", name: "BERET", dy: -1 },
  { id: "clip", name: "CLIP", dy: 2 },
  { id: "ribbon", name: "RIBBON", dy: 0 },
  { id: "pumpkin", name: "PUMPKIN", dy: -1, season: "halloween" },
  { id: "santa", name: "SANTA", dy: -1, season: "winter" },
  // premium line: big jelly sinks so heavy packs have somewhere to go —
  // gold-bordered in the shop, cost overrides ACC_COST
  { id: "monocle", name: "MONOCLE", dy: 9, cost: 800, prem: true },
  { id: "tiara", name: "TIARA", dy: -1, cost: 1000, prem: true },
  { id: "wings", name: "WINGS", dy: 4, cost: 1400, prem: true },
];
// accessory secondary motion: each doodad class reacts differently to
// the body spring — rigid hats tip and lag, face gear slides a hair,
// dangly bits trail, floaters bob on their own clock. `accMV` carries
// the wearer's motion into the wrapper; UI cards leave it null.
const ACC_MOTION = {
  cap: "hat", crown: "hat", tophat: "hat", party: "hat", beanie: "hat",
  wiz: "hat", santa: "hat", pumpkin: "hat", beret: "hat", horns: "hat",
  band: "hat", prop: "hat", phones: "hat", mohawk: "hat", tiara: "hat",
  specs: "face", shades: "face", monocle: "face", patch: "face",
  stache: "face", clip: "face",
  bow: "tail", ribbon: "tail", scarf: "tail", flower: "tail",
  antenna: "tail", leaf: "tail",
  halo: "float", wings: "float",
};
let accMV = null; // {jig, lean, bob, sq, t, ph} — wearer motion snapshot
function drawAcc(c, id, x, y, u) {
  const kind = accMV && ACC_MOTION[id];
  if (!kind || reduceMotion) { drawAccRaw(c, id, x, y, u); return; }
  const mv = accMV;
  c.save();
  c.translate(x, y);
  let ox = 0, oy = 0, rot = 0;
  if (kind === "hat") {
    // headgear tips with the lean and dips a beat late on squash —
    // reads as weight, not glue
    rot = mv.lean * 0.3 + mv.jig * 0.55;
    oy = mv.sq * u * 0.5 - mv.bob * 0.22;
  } else if (kind === "face") {
    // glasses/stache ride the shear with a tiny slip
    ox = mv.jig * 5; oy = mv.sq * u * 0.3;
    rot = mv.jig * 0.12;
  } else if (kind === "tail") {
    // ribbon tails, scarf ends, the antenna stalk — trail the motion
    rot = -mv.lean * 0.7 - mv.jig * 1.4;
    ox = -mv.jig * 3.5;
    oy = Math.abs(mv.jig) * 2 + mv.sq * u * 0.4;
  } else { // float — halo & wings hover on their own clock
    oy = Math.sin(mv.t * 2.1 + (mv.ph || 0)) * u * 0.7 - mv.bob * 0.45 + mv.sq * u * 0.4;
    ox = -mv.jig * 2;
    rot = mv.jig * 0.2;
  }
  c.rotate(rot);
  c.translate(-x + ox, -y + oy);
  drawAccRaw(c, id, x, y, u);
  c.restore();
}
function drawAccRaw(c, id, x, y, u) {
  const acc = ACCS.find((a) => a.id === id);
  if (!acc) return;
  const ay = y + acc.dy * u;
  if (id === "cap") {
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 5 * u, ay, 10 * u, 3 * u);
    c.fillStyle = "#b8405a";
    c.fillRect(x - 5 * u, ay + 2 * u, 10 * u, u);
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 9 * u, ay + 2 * u, 5 * u, u);
    c.fillStyle = "#ffffff";
    c.fillRect(x - u, ay - u, 2 * u, u);
    // stitch seam down the panel + a button nub on top
    c.fillStyle = "#f08a9a";
    c.fillRect(x - u * 0.5, ay, u * 0.5, 2 * u);
    c.fillStyle = "#ffd0d8";
    c.fillRect(x - u * 0.5, ay - 2 * u, u, u);
  } else if (id === "specs") {
    c.strokeStyle = "#2f2f3a";
    c.lineWidth = u;
    c.strokeRect(x - 8 * u, ay, 6 * u, 5 * u);
    c.strokeRect(x + 2 * u, ay, 6 * u, 5 * u);
    c.fillStyle = "#2f2f3a";
    c.fillRect(x - 2 * u, ay + 2 * u, 4 * u, u);
    // glass glare streaks
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fillRect(x - 7 * u, ay + u, 2 * u, u);
    c.fillRect(x + 3 * u, ay + u, 2 * u, u);
  } else if (id === "bow") {
    c.fillStyle = "#ff5f8a";
    c.fillRect(x - 8 * u, ay, 5 * u, 4 * u);
    c.fillRect(x + 3 * u, ay, 5 * u, 4 * u);
    c.fillStyle = "#d1386b";
    c.fillRect(x - 2 * u, ay + u, 4 * u, 3 * u);
    // little ribbon tails hanging off the knot
    c.fillStyle = "#ff5f8a";
    c.fillRect(x - 4 * u, ay + 4 * u, 2 * u, 3 * u);
    c.fillRect(x + 2 * u, ay + 4 * u, 2 * u, 3 * u);
    c.fillStyle = "#d1386b";
    c.fillRect(x - 4 * u, ay + 6 * u, 2 * u, u);
    c.fillRect(x + 2 * u, ay + 6 * u, 2 * u, u);
    // knot highlight
    c.fillStyle = "#ffb0cc";
    c.fillRect(x - u, ay + u, u, u);
  } else if (id === "crown") {
    // band shadow under the gold
    c.fillStyle = "#b8860b";
    c.fillRect(x - 7 * u, ay + 4 * u, 14 * u, u);
    c.fillStyle = "#eec23f";
    c.fillRect(x - 7 * u, ay + 2 * u, 14 * u, 3 * u);
    c.fillRect(x - 6 * u, ay, 3 * u, 2 * u);
    c.fillRect(x - 1.5 * u, ay - u, 3 * u, 3 * u);
    c.fillRect(x + 3 * u, ay, 3 * u, 2 * u);
    // jewels: ruby center, sapphire sides
    c.fillStyle = "#e05a6e";
    c.fillRect(x - u, ay + 2 * u, 2 * u, u);
    c.fillStyle = "#4a90e8";
    c.fillRect(x - 5 * u, ay + 3 * u, u, u);
    c.fillRect(x + 4 * u, ay + 3 * u, u, u);
    c.fillStyle = "#fff2b0";
    c.fillRect(x - u, ay - u, u, u);
  } else if (id === "tophat") {
    c.fillStyle = "#2f2f3a";
    c.fillRect(x - 8 * u, ay + 4 * u, 16 * u, 2 * u);
    c.fillRect(x - 5 * u, ay - 3 * u, 10 * u, 7 * u);
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 5 * u, ay + 2 * u, 10 * u, 2 * u);
    // satin sheen on the crown + a buckle on the band
    c.fillStyle = "#4a4a5a";
    c.fillRect(x - 4 * u, ay - 2 * u, 2 * u, 3 * u);
    c.fillStyle = "#eec23f";
    c.fillRect(x - u, ay + 2 * u, 2 * u, 2 * u);
  } else if (id === "halo") {
    // glowing ring — the pre-rendered halo sprite scaled to the slime
    const hw = 15 * u;
    c.drawImage(haloImg(), x - hw / 2, ay - hw * 0.17, hw, hw * 0.33);
    c.fillStyle = "#fff2b0";
    c.fillRect(x - u * 0.5, ay - u, u, u);
  } else if (id === "party") {
    c.fillStyle = "#5ac8f0";
    c.fillRect(x - 5 * u, ay, 10 * u, 2 * u);
    c.fillRect(x - 3 * u, ay - 2 * u, 6 * u, 2 * u);
    c.fillRect(x - 2 * u, ay - 4 * u, 4 * u, 2 * u);
    c.fillStyle = "#ffd75e";
    c.fillRect(x - 3 * u, ay - 2 * u, 2 * u, 2 * u);
    c.fillStyle = "#ffffff";
    c.fillRect(x - u, ay - 6 * u, 2 * u, 2 * u);
  } else if (id === "flower") {
    // stem + leaf, then the bloom
    c.fillStyle = "#4a9e4f";
    c.fillRect(x + 4 * u, ay, u, 3 * u);
    c.fillRect(x + 2 * u, ay + u, 2 * u, u);
    c.fillStyle = "#ff9ad4";
    c.fillRect(x + 2 * u, ay - 3 * u, 2 * u, 2 * u);
    c.fillRect(x + 6 * u, ay - 3 * u, 2 * u, 2 * u);
    c.fillRect(x + 4 * u, ay - 5 * u, 2 * u, 2 * u);
    c.fillRect(x + 4 * u, ay - 1 * u, 2 * u, 2 * u);
    c.fillRect(x + 3 * u, ay - 4 * u, u, u);
    c.fillRect(x + 6 * u, ay - 4 * u, u, u);
    c.fillStyle = "#ffd75e";
    c.fillRect(x + 4 * u, ay - 3 * u, 2 * u, 2 * u);
  } else if (id === "phones") {
    c.fillStyle = "#3a4048";
    c.fillRect(x - 9 * u, ay - 2 * u, 18 * u, 2 * u);
    c.fillRect(x - 10 * u, ay, 4 * u, 6 * u);
    c.fillRect(x + 6 * u, ay, 4 * u, 6 * u);
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 9 * u, ay + u, 2 * u, 4 * u);
    c.fillRect(x + 7 * u, ay + u, 2 * u, 4 * u);
    // headband cushion + a little cable dangle off the right cup
    c.fillStyle = "#5a6470";
    c.fillRect(x - 7 * u, ay - 2 * u, 14 * u, u);
    c.fillStyle = "#2a3038";
    c.fillRect(x + 9 * u, ay + 6 * u, u, 3 * u);
    c.fillRect(x + 9 * u, ay + 9 * u, 2 * u, u);
  } else if (id === "stache") {
    c.fillStyle = "#4a2f1a";
    c.fillRect(x - 6 * u, ay, 5 * u, 2 * u);
    c.fillRect(x + u, ay, 5 * u, 2 * u);
    c.fillRect(x - 7 * u, ay - u, 2 * u, u);
    c.fillRect(x + 5 * u, ay - u, 2 * u, u);
    // waxed curl tips flicking upward
    c.fillRect(x - 8 * u, ay - 2 * u, u, u);
    c.fillRect(x + 7 * u, ay - 2 * u, u, u);
    c.fillStyle = "#6b4a30";
    c.fillRect(x - 5 * u, ay, 3 * u, u);
    c.fillRect(x + 2 * u, ay, 3 * u, u);
  } else if (id === "patch") {
    // strap as stepped pixels instead of a smooth diagonal line
    c.fillStyle = "#22222a";
    for (let i = 0; i < 6; i++) c.fillRect(x - 9 * u + i * 3 * u, ay - 4 * u + i * u, 3 * u, u);
    c.fillStyle = "#1a1a22";
    c.fillRect(x - 8 * u, ay, 6 * u, 5 * u);
  } else if (id === "shades") {
    c.fillStyle = "#1a1a22";
    c.fillRect(x - 8 * u, ay, 6 * u, 4 * u);
    c.fillRect(x + 2 * u, ay, 6 * u, 4 * u);
    c.fillRect(x - 2 * u, ay + u, 4 * u, u);
    c.fillRect(x - 10 * u, ay, 2 * u, u);
    c.fillRect(x + 8 * u, ay, 2 * u, u);
  } else if (id === "antenna") {
    c.fillStyle = "#8a8a95";
    c.fillRect(x - u * 0.5, ay - 5 * u, u, 5 * u);
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 1.5 * u, ay - 8 * u, 3 * u, 3 * u);
  } else if (id === "leaf") {
    c.fillStyle = "#4a9e4f";
    c.fillRect(x - u * 0.5, ay - 3 * u, u, 3 * u);
    c.fillStyle = "#6abe5f";
    c.fillRect(x - 4 * u, ay - 4 * u, 4 * u, 2 * u);
    c.fillRect(x + u * 0.5, ay - 5 * u, 4 * u, 2 * u);
  } else if (id === "beanie") {
    c.fillStyle = "#7ac4e8";
    c.fillRect(x - 6 * u, ay - u, 12 * u, 3 * u);
    c.fillStyle = "#5aa4cc";
    c.fillRect(x - 6 * u, ay + 2 * u, 12 * u, 2 * u);
    // ribbed fold lines across the brim
    c.fillStyle = "#4a94bc";
    c.fillRect(x - 4 * u, ay + 2 * u, u, 2 * u);
    c.fillRect(x - u, ay + 2 * u, u, 2 * u);
    c.fillRect(x + 2 * u, ay + 2 * u, u, 2 * u);
    // pompom: fluffy cluster, not a flat square
    c.fillStyle = "#ffffff";
    c.fillRect(x - 2 * u, ay - 4 * u, 4 * u, 3 * u);
    c.fillRect(x - u, ay - 5 * u, 2 * u, u);
    c.fillStyle = "#dceef8";
    c.fillRect(x + u, ay - 3 * u, u, u);
  } else if (id === "horns") {
    c.fillStyle = "#d1386b";
    c.fillRect(x - 9 * u, ay - 3 * u, 2 * u, 4 * u);
    c.fillRect(x - 8 * u, ay - 4 * u, 2 * u, 2 * u);
    c.fillRect(x + 7 * u, ay - 3 * u, 2 * u, 4 * u);
    c.fillRect(x + 6 * u, ay - 4 * u, 2 * u, 2 * u);
    // pale tips — little demon horns, not rectangles
    c.fillStyle = "#ffb0c0";
    c.fillRect(x - 8 * u, ay - 4 * u, u, u);
    c.fillRect(x + 7 * u, ay - 4 * u, u, u);
  } else if (id === "band") {
    c.fillStyle = "#e05a5a";
    c.fillRect(x - 9 * u, ay, 18 * u, 2.5 * u);
    c.fillRect(x + 8 * u, ay + 2 * u, 3 * u, 2 * u);
    c.fillRect(x + 10 * u, ay + 3 * u, 2 * u, 2 * u);
  } else if (id === "wiz") {
    c.fillStyle = "#5a3f8a";
    c.fillRect(x - 9 * u, ay + 3 * u, 18 * u, 2 * u);
    c.fillRect(x - 5 * u, ay + u, 10 * u, 2 * u);
    c.fillRect(x - 3 * u, ay - 2 * u, 6 * u, 3 * u);
    c.fillRect(x - 1.5 * u, ay - 5 * u, 3 * u, 3 * u);
    // the tip flops over — wizard hats are never straight
    c.fillRect(x - 3 * u, ay - 6 * u, 2 * u, u);
    c.fillStyle = "#ffd75e";
    c.fillRect(x - u, ay - u, 2 * u, u);
    // a stitched star on the cone
    c.fillRect(x - 3 * u, ay - 1 * u, u, u);
    c.fillRect(x - 4 * u, ay - 2 * u, 3 * u, u);
    c.fillRect(x - 4 * u, ay, 3 * u, u);
  } else if (id === "mohawk") {
    c.fillStyle = "#3fd47f";
    for (let i = 0; i < 5; i++) c.fillRect(x - 6 * u + i * 3 * u, ay - 3 * u, 2 * u, 4 * u);
    c.fillStyle = "#8ff0b0";
    for (let i = 0; i < 5; i++) c.fillRect(x - 6 * u + i * 3 * u, ay - 4 * u, 2 * u, u);
  } else if (id === "prop") {
    c.fillStyle = "#eec23f";
    c.fillRect(x - 6 * u, ay, 12 * u, 3 * u);
    c.fillStyle = "#8a8a95";
    c.fillRect(x - u * 0.5, ay - 4 * u, u, 4 * u);
    // blades spin during a flyby — a red bar whirling on the mast tip,
    // sagging a touch while parked, blurred wide at speed
    c.save();
    c.translate(x, ay - 5 * u);
    c.rotate(propSpin ? (performance.now() / 1000) * propSpin : 0);
    const blur = propSpin ? 1 : 0;
    c.fillStyle = blur ? "rgba(224,90,110,0.75)" : "#e05a6e";
    c.fillRect(-8 * u, -u, 16 * u, 2 * u);
    if (blur) c.fillRect(-u, -8 * u, 2 * u, 16 * u); // cross-blur at speed
    c.fillStyle = blur ? "rgba(90,200,240,0.8)" : "#5ac8f0";
    c.fillRect(-8 * u, -u, 3 * u, 2 * u);
    c.fillRect(5 * u, -u, 3 * u, 2 * u);
    c.restore();
  } else if (id === "pumpkin") {
    // little jack-o'-lantern worn as a hat
    c.fillStyle = "#e07f2b";
    c.fillRect(x - 7 * u, ay - 2 * u, 14 * u, 7 * u);
    c.fillRect(x - 5 * u, ay - 4 * u, 10 * u, 2 * u);
    c.fillStyle = "#b85a18";
    c.fillRect(x - 4 * u, ay - 2 * u, u, 7 * u);
    c.fillRect(x + 3 * u, ay - 2 * u, u, 7 * u);
    c.fillStyle = "#3f9e52";
    c.fillRect(x - u, ay - 6 * u, 2 * u, 2 * u);
    c.fillStyle = "#ffd75e";
    c.fillRect(x - 4 * u, ay + u, 2 * u, 2 * u);
    c.fillRect(x + 2 * u, ay + u, 2 * u, 2 * u);
    c.fillRect(x - 2 * u, ay + 3 * u, 4 * u, u);
  } else if (id === "santa") {
    c.fillStyle = "#d94a4a";
    c.fillRect(x - 7 * u, ay - 2 * u, 13 * u, 5 * u);
    c.fillRect(x - 5 * u, ay - 4 * u, 9 * u, 2 * u);
    c.fillRect(x - 2 * u, ay - 6 * u, 6 * u, 2 * u);
    c.fillStyle = "#f4f0e8";
    c.fillRect(x - 7 * u, ay + 3 * u, 14 * u, 2 * u);
    c.fillRect(x + 4 * u, ay - 7 * u, 3 * u, 3 * u);
  } else if (id === "scarf") {
    // chunky knit wrap around the lower body, striped + fringed
    c.fillStyle = "#e05a5a";
    c.fillRect(x - 9 * u, ay, 18 * u, 4 * u);
    c.fillStyle = "#b83848";
    c.fillRect(x - 9 * u, ay + 3 * u, 18 * u, u);
    // knit stripes
    c.fillStyle = "#f4e8d0";
    c.fillRect(x - 6 * u, ay + u, 2 * u, 2 * u);
    c.fillRect(x - u, ay + u, 2 * u, 2 * u);
    c.fillRect(x + 4 * u, ay + u, 2 * u, 2 * u);
    // the hanging tail + fringe
    c.fillStyle = "#e05a5a";
    c.fillRect(x + 5 * u, ay + 4 * u, 4 * u, 6 * u);
    c.fillStyle = "#b83848";
    c.fillRect(x + 5 * u, ay + 9 * u, 4 * u, u);
    c.fillStyle = "#f4e8d0";
    c.fillRect(x + 5 * u, ay + 10 * u, u, 2 * u);
    c.fillRect(x + 7 * u, ay + 10 * u, u, 2 * u);
    c.fillRect(x + 8 * u, ay + 10 * u, u, 2 * u);
  } else if (id === "beret") {
    // artist's beret tilted left — flat disc + stem nub
    c.fillStyle = "#8a3f5a";
    c.fillRect(x - 8 * u, ay, 13 * u, 3 * u);
    c.fillRect(x - 9 * u, ay + u, 15 * u, u);
    c.fillStyle = "#6b2f44";
    c.fillRect(x - 8 * u, ay + 3 * u, 13 * u, u);
    c.fillStyle = "#a84f6e";
    c.fillRect(x - 7 * u, ay, 5 * u, u);
    // the little stem
    c.fillStyle = "#5a2436";
    c.fillRect(x - 3 * u, ay - u, 2 * u, u);
  } else if (id === "clip") {
    // a star hair clip pinned on the left side
    c.fillStyle = "#eec23f";
    c.fillRect(x - 8 * u, ay, 2 * u, 2 * u);
    c.fillRect(x - 9 * u, ay + u, 4 * u, 2 * u);
    c.fillRect(x - 8 * u, ay + 3 * u, 2 * u, 2 * u);
    c.fillStyle = "#ffd75e";
    c.fillRect(x - 8 * u, ay + u, 2 * u, 2 * u);
    // the clip bar peeking from behind the star
    c.fillStyle = "#e05a6e";
    c.fillRect(x - 10 * u, ay + 2 * u, u, 2 * u);
    c.fillRect(x - 5 * u, ay + 2 * u, u, 2 * u);
  } else if (id === "ribbon") {
    // a long ribbon bow with a trailing tail — fancier than BOW
    c.fillStyle = "#b88ad4";
    c.fillRect(x - 9 * u, ay, 6 * u, 4 * u);
    c.fillRect(x + 3 * u, ay, 6 * u, 4 * u);
    c.fillStyle = "#9a6bb8";
    c.fillRect(x - 2 * u, ay + u, 4 * u, 3 * u);
    // long flowing tails down the side
    c.fillStyle = "#b88ad4";
    c.fillRect(x + 4 * u, ay + 4 * u, 2 * u, 5 * u);
    c.fillRect(x + 6 * u, ay + 4 * u, 2 * u, 4 * u);
    c.fillStyle = "#9a6bb8";
    c.fillRect(x + 4 * u, ay + 9 * u, 2 * u, u);
    c.fillRect(x + 6 * u, ay + 8 * u, 2 * u, u);
    // satin highlight on the loops
    c.fillStyle = "#e0c8f0";
    c.fillRect(x - 8 * u, ay + u, 2 * u, u);
    c.fillRect(x + 4 * u, ay + u, 2 * u, u);
  } else if (id === "monocle") {
    // gold-rimmed lens over the right eye + a little chain dropping away
    c.fillStyle = "#e8b83f";
    c.fillRect(x + 3 * u, ay, 5 * u, u);
    c.fillRect(x + 3 * u, ay + 4 * u, 5 * u, u);
    c.fillRect(x + 2 * u, ay + u, u, 3 * u);
    c.fillRect(x + 8 * u, ay + u, u, 3 * u);
    // glass — pale shine so it reads as a lens, not a hole
    c.fillStyle = "rgba(190, 230, 245, 0.75)";
    c.fillRect(x + 3 * u, ay + u, 5 * u, 3 * u);
    c.fillStyle = "#ffffff";
    c.fillRect(x + 4 * u, ay + u, u, u);
    // chain: two gold links stepping down-right
    c.fillStyle = "#c9952f";
    c.fillRect(x + 8 * u, ay + 5 * u, u, u);
    c.fillRect(x + 9 * u, ay + 6 * u, u, 2 * u);
  } else if (id === "tiara") {
    // delicate band + three points, center one holding a ruby
    c.fillStyle = "#e8b83f";
    c.fillRect(x - 7 * u, ay + 3 * u, 14 * u, u);
    c.fillRect(x - 6 * u, ay + u, u, 2 * u);
    c.fillRect(x + 5 * u, ay + u, u, 2 * u);
    c.fillRect(x - u, ay - u, 2 * u, 4 * u);
    c.fillStyle = "#c9952f";
    c.fillRect(x - 7 * u, ay + 3 * u, u, u);
    c.fillRect(x + 6 * u, ay + 3 * u, u, u);
    // ruby: red gem + white glint
    c.fillStyle = "#e03a5a";
    c.fillRect(x - u, ay - 2 * u, 2 * u, u);
    c.fillStyle = "#ffb8c8";
    c.fillRect(x - u, ay - 2 * u, u, u);
    // side sapphires on the points
    c.fillStyle = "#4a8ad4";
    c.fillRect(x - 6 * u, ay, u, u);
    c.fillRect(x + 5 * u, ay, u, u);
  } else if (id === "wings") {
    // cherub wings sprouting behind the head — same bitmap the
    // legendaries use, shrunk to accessory scale, mirrored both sides
    const img = wingImg(1, "#f2f6ff");
    const w = img.width * u * 0.9, h = img.height * u * 0.9;
    c.save();
    c.translate(x - 9 * u, ay + 4 * u);
    c.scale(-1, 1);
    c.rotate(0.15);
    c.drawImage(img, -w, -h, w, h);
    c.restore();
    c.save();
    c.translate(x + 9 * u, ay + 4 * u);
    c.rotate(-0.15);
    c.drawImage(img, 0, -h, w, h);
    c.restore();
  }
}

// face pixel coords on the 36x26 grid. eyes: left x11-13 / right x22-24, rows 10-13.
const FACES = {
  idle: {
    e: [[10,10],[11,10],[12,10],[13,10],[10,11],[11,11],[12,11],[13,11],[10,12],[11,12],[12,12],[13,12],
        [10,13],[11,13],[12,13],[13,13],[10,14],[11,14],[12,14],[13,14],
        [22,10],[23,10],[24,10],[25,10],[22,11],[23,11],[24,11],[25,11],[22,12],[23,12],[24,12],[25,12],
        [22,13],[23,13],[24,13],[25,13],[22,14],[23,14],[24,14],[25,14]],
    w: [[10,10],[11,10],[10,11],[13,14],[22,10],[23,10],[22,11],[25,14]],
    m: [[16,15],[19,15],[17,16],[18,16]],
    k: [[7,14],[8,14],[7,15],[8,15],[28,14],[29,14],[28,15],[29,15]],
  },
  lookL: {
    e: [[9,10],[10,10],[11,10],[12,10],[9,11],[10,11],[11,11],[12,11],[9,12],[10,12],[11,12],[12,12],
        [9,13],[10,13],[11,13],[12,13],[9,14],[10,14],[11,14],[12,14],
        [21,10],[22,10],[23,10],[24,10],[21,11],[22,11],[23,11],[24,11],[21,12],[22,12],[23,12],[24,12],
        [21,13],[22,13],[23,13],[24,13],[21,14],[22,14],[23,14],[24,14]],
    w: [[9,10],[10,10],[9,11],[12,14],[21,10],[22,10],[21,11],[24,14]],
    m: [[16,15],[19,15],[17,16],[18,16]],
    k: [[7,14],[8,14],[7,15],[8,15],[28,14],[29,14],[28,15],[29,15]],
  },
  lookR: {
    e: [[11,10],[12,10],[13,10],[14,10],[11,11],[12,11],[13,11],[14,11],[11,12],[12,12],[13,12],[14,12],
        [11,13],[12,13],[13,13],[14,13],[11,14],[12,14],[13,14],[14,14],
        [23,10],[24,10],[25,10],[26,10],[23,11],[24,11],[25,11],[26,11],[23,12],[24,12],[25,12],[26,12],
        [23,13],[24,13],[25,13],[26,13],[23,14],[24,14],[25,14],[26,14]],
    w: [[11,10],[12,10],[11,11],[14,14],[23,10],[24,10],[23,11],[26,14]],
    m: [[16,15],[19,15],[17,16],[18,16]],
    k: [[7,14],[8,14],[7,15],[8,15],[28,14],[29,14],[28,15],[29,15]],
  },
  blink: {
    e: [[10,12],[11,12],[12,12],[13,12],[22,12],[23,12],[24,12],[25,12]],
    m: [[16,15],[19,15],[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  munch: {
    e: [[10,12],[11,11],[12,11],[13,12],[22,12],[23,11],[24,11],[25,12]],
    m: [[15,14],[16,14],[17,14],[18,14],[19,14],[20,14],[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],
        [15,16],[16,16],[17,16],[18,16],[19,16],[20,16],[16,17],[17,17],[18,17],[19,17]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  chew: {
    e: [[10,12],[11,11],[12,11],[13,12],[22,12],[23,11],[24,11],[25,12]],
    m: [[16,15],[19,15],[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  // squeezed >_< effort face, two flail frames: stub arms swap sides
  held1: {
    e: [[9,10],[10,11],[11,12],[10,13],[9,14],[26,10],[25,11],[24,12],[25,13],[26,14]],
    m: [[14,16],[15,15],[16,16],[17,15],[18,16],[19,15],[20,16],[21,15]],
    d: [[28,8],[29,9],[28,9]],
    a: [[2,9],[3,9],[32,9],[33,9]],
  },
  held2: {
    e: [[9,10],[10,11],[11,12],[10,13],[9,14],[26,10],[25,11],[24,12],[25,13],[26,14]],
    m: [[14,16],[15,15],[16,16],[17,15],[18,16],[19,15],[20,16],[21,15]],
    a: [[1,13],[2,13],[33,13],[34,13]],
  },
  sleeping: {
    e: [[10,13],[11,14],[12,14],[13,13],[22,13],[23,14],[24,14],[25,13]],
    m: [[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  grumpy: {
    e: [[10,11],[11,11],[12,11],[13,11],[10,12],[11,12],[12,12],[13,12],
        [22,11],[23,11],[24,11],[25,11],[22,12],[23,12],[24,12],[25,12],
        [9,9],[10,10],[26,9],[25,10]],
    m: [[15,16],[16,16],[17,16],[18,16],[19,16],[20,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  happy: {
    e: [[10,12],[11,11],[12,11],[13,12],[22,12],[23,11],[24,11],[25,12]],
    m: [[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],[15,16],[16,16],[17,16],[18,16],[19,16],[20,16],
        [16,17],[17,17],[18,17],[19,17]],
    k: [[6,14],[7,14],[8,14],[9,14],[27,14],[28,14],[29,14],[30,14]],
  },
  laugh: {
    e: [[9,10],[10,11],[11,12],[10,13],[9,14],[26,10],[25,11],[24,12],[25,13],[26,14]],
    m: [[15,14],[16,14],[17,14],[18,14],[19,14],[20,14],[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],
        [16,16],[17,16],[18,16],[19,16],[17,17],[18,17]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  dizzy: {
    e: [[10,10],[12,10],[11,11],[10,12],[12,12],[23,10],[25,10],[24,11],[23,12],[25,12]],
    m: [[15,16],[16,15],[17,16],[18,15],[19,16],[20,15]],
  },
  shock: {
    e: [[10,10],[11,10],[12,10],[10,11],[11,11],[12,11],[10,12],[11,12],[12,12],
        [23,10],[24,10],[25,10],[23,11],[24,11],[25,11],[23,12],[24,12],[25,12]],
    w: [[10,10],[23,10]],
    m: [[16,14],[17,14],[18,14],[16,15],[17,15],[18,15],[16,16],[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  // heart-eyes: nuzzle / siren-charmed / being adored
  love: {
    v: [[10,10],[12,10],[10,11],[11,11],[12,11],[11,12],
        [23,10],[25,10],[23,11],[24,11],[25,11],[24,12]],
    m: [[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],[15,16],[16,16],[17,16],[18,16],[19,16],[20,16],
        [16,17],[17,17],[18,17],[19,17]],
    k: [[6,14],[7,14],[8,14],[28,14],[29,14],[30,14]],
  },
  // star-eyed excitement: gems, treats, reveals
  star: {
    c: [[11,10],[10,11],[12,11],[11,12],[10,13],[12,13],
        [24,10],[23,11],[25,11],[24,12],[23,13],[25,13]],
    m: [[15,14],[16,14],[17,14],[18,14],[19,14],[20,14],[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],
        [16,16],[17,16],[18,16],[19,16],[17,17],[18,17]],
    k: [[6,14],[7,14],[8,14],[6,15],[7,15],[28,14],[29,14],[30,14],[29,15],[30,15]],
  },
  // one eye closed in a playful wink + crooked smirk
  wink: {
    e: [[10,11],[11,12],[12,12],[13,11],
        [23,10],[24,10],[25,10],[23,11],[24,11],[25,11],[23,12],[24,12],[25,12],
        [23,13],[24,13],[25,13],[24,14]],
    w: [[23,10],[23,11]],
    m: [[15,15],[16,16],[17,16],[18,16],[19,15],[20,14]],
    k: [[7,14],[8,14],[7,15],[8,15],[28,14],[29,14],[28,15],[29,15]],
  },
  // teary eyes — mistreated, mourning a departed pal
  cry: {
    e: [[10,11],[11,11],[12,11],[13,11],[10,12],[11,12],[12,12],[13,12],[10,13],[11,13],[12,13],[13,13],
        [22,11],[23,11],[24,11],[25,11],[22,12],[23,12],[24,12],[25,12],[22,13],[23,13],[24,13],[25,13]],
    w: [[10,11],[22,11]],
    d: [[11,15],[11,16],[24,15],[24,16],[12,17],[23,17]],
    m: [[15,16],[16,15],[17,16],[18,15],[19,16],[20,15]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  // puffed-cheek pout: mildly sulking, not full grumpy
  pout: {
    e: [[10,12],[11,11],[12,12],[13,12],[22,12],[23,11],[24,12],[25,12]],
    m: [[16,16],[19,16],[17,17],[18,17]],
    k: [[6,14],[7,14],[8,14],[6,15],[7,15],[8,15],[28,14],[29,14],[30,14],[28,15],[29,15],[30,15]],
  },
  // pure contentment: closed-eye curve + little cat omega mouth
  content: {
    e: [[10,12],[11,13],[12,13],[13,12],[22,12],[23,13],[24,13],[25,12]],
    m: [[15,16],[17,15],[19,15],[21,16],[16,17],[20,17]],
    k: [[6,14],[7,14],[8,14],[7,15],[8,15],[27,14],[28,14],[29,14],[28,15],[29,15]],
  },
  // tongue-out goofball: burps, tail-chases, extra silly moods
  blep: {
    e: [[10,12],[11,11],[12,11],[13,12],[22,12],[23,11],[24,11],[25,12]],
    m: [[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],
        [16,16],[17,16],[18,16],[19,16],
        [17,17],[18,17],[17,18],[18,18],[17,19],[18,19]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  // smug half-lidded smirk: nailed the pounce, dodged your poke, knows it
  smug: {
    e: [[9,10],[10,10],[25,10],[26,10],
        [10,11],[11,11],[12,11],[13,11],[10,12],[11,12],[12,12],[13,12],
        [22,11],[23,11],[24,11],[25,11],[22,12],[23,12],[24,12],[25,12]],
    w: [[10,11],[22,11]],
    m: [[15,16],[16,16],[17,16],[18,16],[19,16],[20,15],[21,14]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
};

// per-species EYE styles: the open-eyed faces (idle/lookL/lookR) are
// generated from 4x5 templates stamped at the eye's base x — rounded
// corners, a chunky top-left shine, a bottom-right catchlight, and a
// lighter `u` iris-depth row. seeded per species so every slime's gaze
// is a little different. chars: e=eye w=shine u=depth c=gold glint .=none
const EYE_TPL = [
  // 0 round — the new default
  [".ee.", "wwee", "weee", "eeew", ".uu."],
  // 1 sparkle — oversized shine cluster
  ["wee.", "wwee", "weee", "eewe", ".uu."],
  // 2 dot — tiny bead eyes
  ["....", ".we.", ".ee.", ".ee.", "...."],
  // 3 starry — gold catchlight
  [".ee.", "wwee", "weee", "eece", ".uu."],
  // 4 mellow — half-lidded, relaxed
  ["....", "eeee", "weee", "eeew", ".uu."],
];
function eyeStyle(i) {
  const id = SPECIES[i] && SPECIES[i].id;
  if (id === "stella") return 3;
  if (id === "ghost" || id === "void" || id === "shade") return 4;
  let s = (i * 2246822519 + 0x326457e9) >>> 0;
  const r = ((s * 1664525 + 1013904223) >>> 0) / 4294967296;
  return r < 0.40 ? 0 : r < 0.60 ? 1 : r < 0.74 ? 2 : r < 0.87 ? 3 : 4;
}
// faces with generated eyes — the rest of the face (mouth/blush/etc)
// rides the authored table untouched
const EYE_BASE = { idle: [10, 22], lookL: [9, 21], lookR: [11, 23] };
function faceSet(spIdx) {
  if (spIdx == null) return FACES;
  const c = (faceSet.c ||= {});
  if (c[spIdx]) return c[spIdx];
  const tpl = EYE_TPL[eyeStyle(spIdx)];
  const set = Object.assign({}, FACES);
  for (const f in EYE_BASE) {
    const px = { e: [], w: [], u: [], c: [] };
    for (const bx of EYE_BASE[f])
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 4; x++) {
          const ch = tpl[y][x];
          if (ch !== ".") px[ch].push([bx + x, 10 + y]);
        }
    set[f] = Object.assign({}, FACES[f], px);
  }
  return (c[spIdx] = set);
}

function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mixRgb(a, b, f) {
  return [a[0] + (b[0] - a[0]) * f | 0, a[1] + (b[1] - a[1]) * f | 0, a[2] + (b[2] - a[2]) * f | 0];
}
const SWEAT = hexRgb("#8fd4f0");
const FIXED = { d: SWEAT, c: hexRgb("#ffd75e"), g: hexRgb("#2f2f3a"), v: hexRgb("#ff8fb8") };

// per-species silhouette variation: every slime is the same base shape
// but a slightly different blob — seeded by species index so it's stable
// across faces, frames, sessions, AND matches its own gacha silhouette
const shapeVarCache = {};
function shapeVar(i) {
  if (shapeVarCache[i]) return shapeVarCache[i];
  const hw0 = SHAPES[SPECIES[i].shape];
  let s = (i * 2654435761 + 0x9e3779b9) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hs = 0.88 + rnd() * 0.24;              // taller / squatter
  const bulge = 0.9 + rnd() * 0.2;             // slimmer / fatter
  const lean = Math.round((rnd() - 0.5) * 4);  // up to +-2px drift at the top
  const hw = new Array(SH);
  for (let y = 0; y < SH; y++) {
    const sy = SH - 1 - Math.round((SH - 1 - y) / hs);   // bottom stays anchored
    let w = sy < 0 ? 0 : hw0[Math.min(SH - 1, sy)];
    // a gentle width wave through the middle makes the belly rounder or trimmer
    w = Math.round(w * bulge * (0.88 + 0.24 * Math.sin(Math.PI * y / SH)));
    hw[y] = Math.max(0, Math.min(CX - 1, w));
  }
  // coord remap for authored pixels (top doodads + faces): height scaled
  // around the baseline, x drifted by the lean at that row
  const tfm = (x, y) => {
    const ny = Math.max(0, Math.min(SH - 1, SH - 1 - Math.round((SH - 1 - y) * hs)));
    // scale x by the row-width ratio (clamped — degenerate tip rows
    // would explode it), so a pixel authored at the old edge lands at
    // the new edge; then allow at most 4px of protrusion past the edge
    // so ears/crowns still poke out but never float away
    const srcW = hw0[y] || 1, dstW = hw[ny] || 1;
    const r = Math.min(2, Math.max(0.4, dstW / srcW));
    let nx = CX + Math.round((x - CX) * r) + Math.round(lean * (1 - ny / SH));
    const lim = dstW + 4;
    nx = Math.max(CX - lim, Math.min(CX + lim, nx));
    return [Math.max(0, Math.min(SW - 1, nx)), ny];
  };
  return (shapeVarCache[i] = { hw, tfm });
}

// per-species animation timing: two round commons no longer share the
// same clock — blink period, blink length, fidget cadence and breathing
// rate are all seeded off the species index (stable across sessions)
const animCache = {};
function animProf(i) {
  if (animCache[i]) return animCache[i];
  let s = (i * 2654435761 + 0x85ebca6b) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  return (animCache[i] = {
    blink: 2400 + rnd() * 2800,      // ms between blinks
    blinkLen: 100 + rnd() * 80,      // blink duration ms
    fidget: 0.65 + rnd() * 1.0,      // idle squash cadence multiplier
    breathe: 0.88 + rnd() * 0.3,     // breathing rate multiplier
    hop: 0.82 + rnd() * 0.45,        // leap height — some slimes are jumpier
    lean: 0.7 + rnd() * 0.9,         // how much they tilt into a walk
    waddle: 0.8 + rnd() * 0.5,       // walk-bob rhythm — waddlers vs gliders
    arc: 0.85 + rnd() * 0.5,         // hop hang-time — floaty vs darting
    glee: rnd(),                     // reaction-face bias: low=wink, high=hearts
  });
}

function buildSprite(faceName, pal, top, hw, sil, spIdx, opa) {
  const grid = Array.from({ length: SH }, () => new Array(SW).fill("."));
  const v = spIdx != null ? shapeVar(spIdx) : null;
  const hhw = v ? v.hw : hw;
  for (let y = 0; y < SH; y++) {
    for (let x = CX - hhw[y]; x < CX + hhw[y]; x++) {
      let c = "b";
      const dx = x - 12, dy = y - 6;
      if (dx * dx + dy * dy < 20) c = "l";
      if (y >= 21 || (x - CX >= 8 && y >= 17)) c = "s";
      // translucent jelly core — a broad bright mass normalized to each
      // row's halfwidth, so the glow hugs round/tall/flat shapes alike.
      // the rim dithers into the body: a checkerboard falloff instead of
      // a hard ellipse edge, which reads as soft pixel translucency
      if (c === "b") {
        const gx = (x - CX) / Math.max(5, hw[y] * 0.7), gy = (y - 12) / 7.5;
        const d2 = gx * gx + gy * gy;
        if (d2 < 1 && (d2 < 0.7 || ((x + y) & 1) === 0)) c = "i";
      }
      grid[y][x] = c;
    }
  }
  // authored pixels ride the same transform as the silhouette they sit on
  const tfm = v ? v.tfm : (x, y) => [x, y];
  const F = faceSet(spIdx)[faceName];
  for (const [x, y, ch] of top || []) { const [nx, ny] = tfm(x, y); grid[ny][nx] = ch; }
  for (const [x, y] of F.a || []) { const [nx, ny] = tfm(x, y); grid[ny][nx] = "b"; }
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (grid[y][x] === ".") continue;
      const n = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      if (n.some(([nx,ny]) => ny < 0 || ny >= SH || nx < 0 || nx >= SW || grid[ny][nx] === ".")) {
        grid[y][x] = "o";
      }
    }
  }
  // light shines through the jelly: the lowest interior row catches a
  // bright rim instead of sitting inside the shade band
  for (let y = SH - 2; y > 0; y--) {
    for (let x = 0; x < SW; x++) {
      if (grid[y][x] === "s" && (grid[y + 1][x] === "o" || grid[y + 1][x] === ".")) grid[y][x] = "i";
    }
  }
  for (const ch in F) {
    if (ch === "a") continue;
    for (const [x, y] of F[ch]) { const [nx, ny] = tfm(x, y); grid[ny][nx] = ch; }
  }
  const off = document.createElement("canvas");
  // 2x supersampled: every logical pixel becomes a 2x2 block — finer
  // visible grain for every slime, plus per-quadrant shading and soft
  // silhouette edges instead of hard chunky corners
  const SS = 2;
  off.width = SW * SS;
  off.height = SH * SS;
  const octx = off.getContext("2d");
  const img = octx.createImageData(SW * SS, SH * SS);
  // pastel translucent-jelly pipeline: every shade lifts toward the
  // light color and then toward white (hue-preserving pastel), the
  // outline tints toward the body instead of going near-black, and the
  // inner pixels get alpha so the desktop bleeds through like real jelly
  const WHT = [255, 255, 255];
  const bR = sil ? null : hexRgb(pal.b), lR = sil ? null : hexRgb(pal.l || pal.b);
  const sR = sil ? null : hexRgb(pal.s || pal.b), oR = sil ? null : hexRgb(pal.o || pal.b);
  // dark-palette lift: coal/ninja/shade-class species come out murky on
  // dark wallpapers, so near-black bases get an extra milk pour to stay
  // readable without washing out the normal palettes
  const bl = bR ? bR[0] * 0.299 + bR[1] * 0.587 + bR[2] * 0.114 : 128;
  const lift = bR && bl < 76 ? Math.min(0.3, (76 - bl) / 76 * 0.34) : 0;
  const bIn = sil ? null : mixRgb(mixRgb(bR, lR, 0.24), WHT, 0.14 + lift);       // pastel body
  const iIn = sil ? null : mixRgb(mixRgb(bR, lR, 0.66), WHT, 0.12 + lift);       // glowing core
  const sIn = sil ? null : mixRgb(mixRgb(sR, lR, 0.32), WHT, 0.16 + lift * 0.6); // pastel shade, not darkness
  const oIn = sil ? null : mixRgb(oR, mixRgb(bR, lR, 0.35), 0.45 + lift);        // soft tinted outline
  const lIn = sil ? null : mixRgb(lR, WHT, 0.16);                    // milky highlight
  const uIn = sil ? null : mixRgb(hexRgb(pal.e || "#26262e"), lR, 0.45); // iris depth row
  // jelly translucency, raised overall — the cast was reading washed-out;
  // pals get a second firmer bake so companions stay present (opa variant)
  const ALPHA = opa ? { i: 226, b: 246, s: 238, l: 252 } : { i: 198, b: 230, s: 220, l: 246 };
  const cellAt = (x, y) => (x < 0 || y < 0 || x >= SW || y >= SH) ? "." : grid[y][x];
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const c = grid[y][x];
      if (c === ".") continue;
      // silhouettes resolve only through the silhouette palette — no
      // fixed-color leaks that would spoil gacha reveals (crowns, stars)
      const rgb = sil ? hexRgb(pal[c] || pal.b)
        : c === "i" ? iIn
        : c === "b" ? bIn
        : c === "s" ? sIn
        : c === "o" ? oIn
        : c === "l" ? lIn
        : c === "u" ? uIn
        : (FIXED[c] || hexRgb(pal[c] || pal.b));
      const baseA = sil ? 255 : (ALPHA[c] !== undefined ? ALPHA[c] : 255);
      // write the 2x2 sub-block: each quadrant shades by its own outward
      // neighbor — empty = translucent feather edge, outline = contact
      // shadow, lit cells = a little bounce light. deterministic hash
      // noise keeps it stable per-pixel (no crawl across rebuilds)
      for (let qy = 0; qy < SS; qy++) {
        for (let qx = 0; qx < SS; qx++) {
          const nx = cellAt(x + (qx ? 1 : -1), y), ny = cellAt(x, y + (qy ? 1 : -1));
          const nc = cellAt(x + (qx ? 1 : -1), y + (qy ? 1 : -1));
          let r = rgb[0], g = rgb[1], b = rgb[2], a = baseA;
          if (nx === "." || ny === "." || nc === ".") {
            a = baseA * 0.45; // feathered silhouette edge
            r = mixRgb(rgb, oIn || rgb, 0.4)[0]; g = mixRgb(rgb, oIn || rgb, 0.4)[1]; b = mixRgb(rgb, oIn || rgb, 0.4)[2];
          } else if (nx === "o" || ny === "o") {
            r *= 0.86; g *= 0.86; b *= 0.86; // contact shadow against the rim
          } else if ((nx === "l" || ny === "l" || nc === "i") && (c === "b" || c === "i")) {
            r = Math.min(255, r * 1.06); g = Math.min(255, g * 1.06); b = Math.min(255, b * 1.06);
          }
          const n2 = (((x * 2 + qx) * 73856093) ^ ((y * 2 + qy) * 19349663)) >>> 0;
          const dt2 = ((n2 % 11) - 5) * 1.6; // ±8 of stable grain
          const i2 = ((y * SS + qy) * SW * SS + (x * SS + qx)) * 4;
          img.data[i2] = Math.max(0, Math.min(255, r + dt2));
          img.data[i2 + 1] = Math.max(0, Math.min(255, g + dt2));
          img.data[i2 + 2] = Math.max(0, Math.min(255, b + dt2));
          img.data[i2 + 3] = a;
        }
      }
    }
  }
  octx.putImageData(img, 0, 0);
  return off;
}

const spriteCache = {};
function sprite(face, spIdx, sil, opa) {
  const sp = SPECIES[spIdx];
  const shiny = !sil && shinyOwned[sp.id];
  const key = `${face}|${spIdx}|${sil ? 1 : 0}|${shiny ? 1 : 0}|${opa ? 1 : 0}`;
  if (!spriteCache[key]) {
    spriteCache[key] = buildSprite(face, sil ? SILH : shiny ? SHINY_PAL(sp.pal) : sp.pal, sp.top, SHAPES[sp.shape], sil, spIdx, opa);
  }
  return spriteCache[key];
}

// ---------- audio: all sounds synthesized, no assets ----------
let AC = null;
function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function blip({ f = 600, f2, d = 0.08, type = "square", v = 0.05, at = 0, atk = 0.008 }) {
  if (vol <= 0.001) return;
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    const t = a.currentTime + at;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    // soft attack: ramping in kills the oscillator click that made every
    // note read as a machine beep
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  } catch {}
}
// sound-pack hook: every effect is a note list, so a future soundpack
// DLC can override entries (or pitch/vol-shift the whole board) without
// touching any call site. fr = random range added to f per play
const SFX_DEFS = {
  // cute board: sine/triangle bases, upward chirps and consonant jumps —
  // nothing reads as a machine beep once the attack ramp (in blip) rounds
  // the note heads. munch carries a random detune so repeats stay organic
  munch:  [{ f: 470, fr: 120, f2: 700, d: 0.055, type: "triangle", v: 0.05 }, { f: 620, f2: 500, d: 0.06, type: "sine", v: 0.035, at: 0.06 }],
  pop:    [{ f: 400, f2: 780, d: 0.08, type: "sine", v: 0.08 }],
  boing:  [{ f: 300, f2: 560, d: 0.13, type: "triangle", v: 0.07 }],
  heart:  [{ f: 880, f2: 1174, d: 0.08, type: "sine", v: 0.05 }, { f: 1174, f2: 1568, d: 0.1, type: "sine", v: 0.045, at: 0.07 }],
  giggle: [{ f: 980, f2: 1318, d: 0.05, type: "sine", v: 0.05 }, { f: 1174, f2: 1568, d: 0.05, type: "sine", v: 0.045, at: 0.06 }, { f: 1318, f2: 1760, d: 0.07, type: "sine", v: 0.04, at: 0.12 }],
  shock:  [{ f: 740, f2: 1480, d: 0.1, type: "sine", v: 0.055 }],
  angry:  [{ f: 170, f2: 120, d: 0.1, type: "triangle", v: 0.06 }, { f: 150, f2: 110, d: 0.1, type: "triangle", v: 0.05, at: 0.11 }],
  drop:   [{ f: 330, f2: 160, d: 0.13, type: "sine", v: 0.08 }],
  reveal: [{ f: 523, d: 0.09, type: "sine", v: 0.05 }, { f: 659, d: 0.09, type: "sine", v: 0.05, at: 0.08 }, { f: 784, d: 0.16, type: "sine", v: 0.055, at: 0.16 }, { f: 1568, d: 0.12, type: "sine", v: 0.025, at: 0.2 }],
  zzz:    [{ f: 780, f2: 540, d: 0.08, type: "sine", v: 0.022 }],
};
// active pack: defs overrides merge over SFX_DEFS, pitch/vol shift every
// note — a "8-bit" pack could drop pitch 0.5, a "toy" pack raise it 1.5
let sfxPack = { pitch: 1, vol: 1, defs: null };
const sfx = {};
// ambient rate-limit: while you haven't touched the slime for a bit, the
// autonomous bustle (pals hopping, idles, eats) shares one sound budget —
// interaction feedback (clicks, menus, drags) always plays full-rate
let lastAmbSfx = 0;
const AMB_SFX_GAP = 2200;
let lastUiTap = 0; // any real click on the overlay — panel taps count as interaction too
for (const k of Object.keys(SFX_DEFS)) {
  sfx[k] = () => {
    const now = Date.now();
    if (now - Math.max(awakeAt, lastUiTap) > 1500) {
      if (now - lastAmbSfx < AMB_SFX_GAP) return;
      lastAmbSfx = now;
    }
    const defs = (sfxPack.defs && sfxPack.defs[k]) || SFX_DEFS[k];
    for (const n of defs) {
      blip({ ...n, f: (n.f + (n.fr ? Math.random() * n.fr : 0)) * sfxPack.pitch, v: n.v * sfxPack.vol });
    }
  };
}
let lastMunchSfx = 0;

// ---------- game state ----------
// sleep: dozes off after 5 minutes with no direct interaction. typing is
// NOT interaction — the slime naps while you work (unless it eats keys)
const SLEEP_AFTER = 5 * 60_000;
// poke it after 20+ ignored minutes and you get the grumpy greeting
const RETURN_GRUMPY = 20 * 60_000;
const KEYS_PER_LEVEL = 300;
const JELLY_EVERY = 600;      // ~1 pull per 3 days of active typing
const PULL_COST = 50;         // ~$0.095/pull against the $1.9/1000 gem pack
const DUP_REFUND = 15;        // ~30% of a pull back on duplicates
// throwable snacks — right-click the snack button to cycle the kind
const TREATS = [
  { id: "cookie", xp: 60 },   // plain: a bite of xp
  { id: "cake",   xp: 200 },  // big xp
  { id: "chili",  xp: 60 },   // hyper mode for 60s
  { id: "coffee", xp: 40 },   // can't sleep for 5min
];

let xp = 0;
let level = 0;
let jelly = 10;
let owned = ["sprout"];
let active = 0;
let dirty = false;
let pityRare = 0;
let pityLeg = 0;
let hybSeq = 0;
let accOwned = [];
let accEquip = {};

let state = "idle";
let lastKey = Date.now();   // last keystroke — feed timing only, not sleep
let awakeAt = Date.now();   // last waking activity: touch, treats, (kr) typing
// direct slime contact — updates the sleep clock. a long-ignored slime
// greets you grumpy instead of cheerful
function touch() {
  const gap = Date.now() - awakeAt;
  awakeAt = Date.now();
  ignoreT = 0; // any real interaction resets the loneliness clock
  if (gap > RETURN_GRUMPY) annoyedUntil = performance.now() + 1800;
}
let munchUntil = 0;
let blinkUntil = 0;
let nextBlink = performance.now() + 3000;
let lastZzz = 0;
let lastKick = 0;
let lookDir = 0;
let lookUntil = 0;
let nextLook = performance.now() + 2500;
let bubble = 0;
let bubblePop = 0;
let tickleUntil = 0;
let tickleCd = 0;
let petUntil = 0;
let shockUntil = 0;
let dizzyUntil = 0;
let starUntil = 0;   // star-eyed: gems, treats, reveals
let winkUntil = 0;   // playful wink: boops, photo poses
let cryUntil = 0;    // teary: a pal went home, too many pokes
let poutUntil = 0;   // sulky: light pokes before real grump
let splatUntil = 0;
let annoyedUntil = 0;
let contentUntil = 0;
let smugUntil = 0;    // smug smirk: nailed the pounce, dodged your poke
let blepUntil = 0;    // tongue-out goofball mode
let cuddleUntil = 0;  // hold-cuddle: settles into your palm
let cuddleT = 0;      // still-hold accumulator
let circScore = 0;    // cursor-circle windup around the pet
let circAng = null;   // last cursor angle for circle detection
let circCd = 0;
let legFlairT = 0;    // next legendary idle flourish time
let lastRevX = null;
let lastClickT = 0;

let squash = 0;
let squashV = 0;
const crumbs = [];
const zzzs = [];
const bangs = [];
const hearts = [];
const wiggleBuf = [];
const fx = [];
let nextTraitFx = 0;

let petX = winW * 0.5;
let petY = winH;
let petVX = 0;
let petVY = 0;
let held = false;
let flying = false;
let petHome = false;  // main pet is parked in its ranch room — desktop quiet
let grabDX = 0, grabDY = 0;
let lastMX = 0, lastMY = 0, lastMT = 0;
let dragVX = 0, dragVY = 0;
let downX = 0, downY = 0, downT = 0;
let heldSince = 0;

let walkTarget = null;
let walkGoal = null;   // what the stroll is for — a prop, a treat, nothing
let blinkStepT = 0;
let walkSpd = 55;
let petSpd = 0;            // smoothed walk speed — accelerates instead of instant velocity
let leanSm = 0;            // smoothed walk-lean — rolls through direction flips
let hopTarget = null;
let hopWind = 0;  // anticipation crouch before a leap
let sitUntil = 0;
let lookFlipT = 0;
let stretchUntil = 0;
let spinT0 = 0;
let danceT0 = 0;
let climbPhase = 0;
let climbEdge = 0;
let climbing = false;
let climbUntil = 0;
let snack = null;
let treatAim = false;
let treatFly = null;
let treat = null;
let treatKind = 0;
let hyperUntil = 0;     // chili rush (perf clock)
let noSleepUntil = 0;   // coffee buzz (Date.now clock)
let focusTitle = "";
let photoHide = false;
let reduceMotion = false;
let accPick = null;     // species index with the accessory picker open
let infoPick = null;    // species index with the bestiary panel open
let albumOpen = false;  // photo album overlay browsing saved PNGs
let albumList = [];
let albumIdx = 0;
const albumImgs = {};   // name -> Image, loaded lazily
let albumDelArm = 0;    // delete two-tap confirm: armed until this time
let stats = { pulls: 0, breeds: 0, shiny: 0, treats: 0, plays: 0 };
// collection milestones: [owned-base-count, gem reward] — pays out once each
const DEX_MILES = [[10, 15], [20, 25], [30, 40], [40, 60], [50, 80], [58, 150]];
let dexMile = 0;
let sigT0 = 0;
let sigId = null;
let sigInit = 0;
let sigTx = 0, sigTy = 0;
// webby's silk line: pendulum-swinging from the live cursor
let webbing = false, webAng = 0, webAngV = 0, webUntil = 0, webCd = 0;
let webHeld = false;   // grabbed while dangling — line stays, pet follows drag
let webT0 = 0, webFromX = 0, webFromY = 0; // zip-up blend from the platform
let webLen = 92, webIdleT = 0;             // reel-in: climbs a still cursor
let webTwirl = 0;                          // poke-spin timestamp
let followCd = 0;
let nextWander = performance.now() + 5000;
let stepDustT = 0;         // footstep dust cadence while walking
let nextFidget = 0;        // idle micro-squash timer
let pokeStreak = 0, pokeLast = 0;   // belly-poke combo counter
let heldStretch = 0, heldStretchAng = 0;   // jelly elongation while dragged
const ripples = [];        // ground ripple rings on landing

let curX = -9999, curY = -9999, curV = 0, curVX = 0;
let lastCurX = -9999, lastCurY = -9999, lastCurT = 0;

// organic life-layer: slow mood/energy drift plus an attention model,
// so the pet feels alive instead of rolling uniform dice forever
let energy = 0.6;          // 0..1: >0.7 playful, <0.3 lazy
let energyDir = 1;         // drifts up/down like a mood tide
let noticeT = 0;           // how long the cursor has hovered near (ms)
let noticeCd = 0;          // reaction cooldown after a notice
let ignoreT = 0;           // time since the user last did anything
let begUntil = 0;          // attention-seek: begging under the cursor
let yawnT = 0;             // mid-yawn timer
let yawnNext = 0;          // next allowed yawn
let nodPhase = 0;          // pre-sleep droop-nod cycle
let lastLookDir = 0;       // turn-flourish detector
let stirT = 0;             // sleeping-stir cooldown for close cursors
let huntT0 = 0;            // cursor-hunt stalk start (butt-wiggle phase)
let huntCd = 0;            // hunt cooldown
let huntScore = 0;         // prey-drive: builds while the cursor swishes
let huntPounce = false;    // airborne pounce — resolves on landing
let gaitPhase = 0, gaitStep = 0; // distance-driven walk cycle — bounces in sync with actual speed
let walkDirPrev = 0;       // last walk direction — a flip while fast makes a skid
let boopT = 0;             // slow cursor pressure on the body — it squirms away
let rubDir = 0, rubCount = 0, rubCd = 0; // cursor scritches: direction flips over the body
let ball = null;           // the ball toy: a physics prop the slimes nudge and chase
let ballHeld = false, ballDX = 0, ballDY = 0;
let ballVX = 0, ballVY = 0, ballLX = 0, ballLY = 0, ballLT = 0;
// placed props from the toybox: static furniture slimes use on their own
let bowl = null;           // {x, y, plat} — walk up, face it, munch a snack
let cushion = null;        // {x, y, plat} — walk up, turn, plop down, nap
let box = null;            // cardboard box — climb in, vanish, pop back out
let plant = null;          // potted sprout — sniff it, sneeze or nuzzle
let music = null;          // wind-up music box — winding it makes them dance
let mirror = null;         // vanity mirror — preen, or shy-slimes flee the reflection
let mat = null;            // jelly bounce mat — hop on for a happy boing
let jar = null;            // cookie jar — nibbles inside, a tap spills a real treat
let toyboxOpen = false;    // the chooser strip under the toy button
let propHeld = null;       // furniture kind string — the prop being dragged
let propGrabX = 0, propGrabY = 0; // grab origin — a tap (not a drag) refills/fluffs
let grabT0 = 0;            // when any hold started — watchdog frees a stuck grab
let cushionPoof = 0;       // fluff-burst timestamp for the tap interaction
let matPoof = 0;           // bounce-mat over-inflate timestamp
// radial menu: a single draggable circle that accordions into the action
// list — the old five-button row camped the whole top-right corner
let fabX = null, fabY = null;   // null = default top-right spot
let fabOpen = false;
let fabDrag = null;             // {ox,oy,sx,sy,moved} while held
const FAB_ITEMS = ["recall", "snack", "toys", "barn", "gear"];
function fabPos() { return [fabX ?? winW - 28, fabY ?? 28]; }
// accordion item rects: stack downward, flip upward near the screen bottom
function fabItemRect(k) {
  const [fx, fy] = fabPos();
  const down = fy + 26 + FAB_ITEMS.length * 40 <= winH - 8;
  const iy = down ? fy + 26 + k * 40 : fy - 26 - 36 * (k + 1) - 4 * k;
  return [fx - 17, iy, 34, 34];
}
function fabItemHit(mx, my) {
  for (let k = 0; k < FAB_ITEMS.length; k++) {
    const [ix, iy, iw, ih] = fabItemRect(k);
    if (mx >= ix && mx <= ix + iw && my >= iy && my <= iy + ih) return k;
  }
  return -1;
}
// toybox prop strip: hangs left of the toys item when the chooser is open
function toyboxStripRect() {
  const [ix, iy] = fabItemRect(2);
  return [Math.max(8, ix - 328), iy, 324, 34]; // nine prop slots
}
let egg = null;            // {x, y, plat, t0, wob} — today's mystery egg
let lastEgg = "";          // date key of the day the egg last dropped
let bowlCd = 0, cushionNap = 0, cushionCd = 0; // main pet's prop timers
let boxCd = 0, plantCd = 0, musicCd = 0;       // errand cooldowns for the new props
let mirrorCd = 0, matCd = 0, jarCd = 0;        // second-batch prop cooldowns
let boxHide = 0;         // main pet is inside the box until this frame-clock time
let cushionNapW = 0; // wall-clock twin of cushionNap — perf-time callers can't compare the frame clock
let turnPause = 0;         // anticipation beat: a brief stop before a sharp reversal
let lastFace = "", faceSwapT = 0; // face-change transition squash
let landPeak = 0;          // hardest fall speed seen — scales the landing impact
let idleSkip = 0;          // deep-idle quarter-rate frame counter
let hintsSeen = {};        // discovery hints already taught (persisted)
// bond: per-species affection earned through gentle interactions —
// trickle-gated so it rewards presence, not click-farming
let bond = {};
let bondLast = 0;
const BOND_LVS = [0, 30, 90, 200, 400];
const BOND_NAMES = ["SHY", "FRIEND", "BUDDY", "PAL", "BESTIE"];
function bondLvl(id) {
  const x = bond[id] || 0;
  let l = 0;
  for (const t of BOND_LVS) if (x >= t) l++;
  return l; // 0..5
}
function bondGain(id, n) {
  const now = performance.now();
  if (!id || now < bondLast) return;
  bondLast = now + 12000; // one trickle per 12s across all sources
  bond[id] = (bond[id] || 0) + n;
  dirty = true;
}
let hintUntil = 0, hintText = "", hintDrip = 60000; // first non-contextual hint at ~1min
let introDone = false;     // one-time boot wave — first launch only
let greeted = false;       // bond greeting fires once per boot
let startleFall = false; // platform vanished mid-stand — dazed on landing
// discovery hints: each teaches one interaction exactly once, either
// when the user is already mid-gesture (contextual) or on a slow drip —
// never while a modal is up or the pet is being dragged
const HINTS = [
  { id: "swish", t: "SWISH THE CURSOR NEARBY - IT HUNTS MOVEMENT", trig: () => curV > 400 },
  { id: "poke", t: "A SLOW POKE BOOPS THE SNOOT", trig: () => boopT > 0.3 },
  { id: "swipe", t: "SWIPE BACK AND FORTH OVER IT - SCRITCHES", trig: () => rubCount > 0 },
  { id: "circle", t: "DRAW A CIRCLE AROUND IT - IT SPINS" },
  { id: "fling", t: "GRAB + FLING - IT BOUNCES OFF WINDOWS", trig: () => held },
  { id: "pal", t: "PALS TAKE PETS AND SCRITCHES TOO", trig: () => pals.length > 0 },
  { id: "pal2", t: "PALS PLAY TOGETHER - WATCH THEM", trig: () => pals.length > 1 },
  { id: "ball", t: "BALL BUTTON UP TOP - THEY'LL PUSH IT AROUND", trig: () => ball !== null },
];
let jigX = 0, jigV = 0;    // verlet-lite shear spring: top lags the feet
let jigPX = 0;             // last-frame petX for velocity estimation

let plats = [{ x: 0, y: winH, w: winW }];
// multi-monitor floors: each display contributes its own bottom-edge
// platform so a slime can stroll from one screen onto the next
let monPlats = [{ x: 0, y: winH, w: winW }];
invoke("get_monitors").then((mons) => {
  if (Array.isArray(mons) && mons.length > 1) {
    monPlats = mons.map(([x, y, w, h]) => ({ x, y: y + h, w }));
    plats = [...monPlats];
  }
}).catch(() => {});
let ranchOpen = false;
let settingsOpen = false;
// dragged panel positions (ranch / nursery / card) — restored on launch
let panelPos = {};
let muted = false;
let volStep = 0;
// continuous master volume 0..1 — the settings row drives it as a slider;
// volStep/muted survive only as save-compat shims for older profiles
let vol = 1;
let volDrag = null; // {tx, tw} while the volume slider is being dragged
const VOL_STEPS = [1, 0.6, 0.3, 0];
// pomodoro companion mode: focus sprints get cheers, breaks get naps
let pomo = false;
let pomoPhase = "focus";
let pomoUntil = 0;
let pomoLen = 25 * 60000;   // length of the current phase, for the ring
let lastDaily = "";
let dailyStreak = 0;
let lastWeekly = "";
let DEMO = false;
const DEMO_MAX = 8;          // free demo caps the collection at 8 species
let pomoFocusMin = 25;
let pomoBreakMin = 5;
const POMO_FOCI = [15, 20, 25, 30, 45];
const POMO_BREAKS = [5, 10, 15];
// gem packs sold as redeem codes (Stripe/Gumroad delivery) — the signed
// code is verified by the Rust binary against an embedded public key;
// redeemed codes are one-shot per save file
const GEM_PACKS = { A: 250, B: 500, C: 1000, D: 2500 };
// redeem codes are Ed25519 signatures checked in the Rust binary — the
// client ships only the public key, so unpacked exes can never mint codes
async function tryRedeem(raw) {
  const fmt = ("JELLYPAL" + raw.toUpperCase().replace(/^JELLYPAL-?/, "").replace(/[^A-Z2-7]/g, ""))
    .replace(/^JELLYPAL([A-D])([A-Z2-7]{8})([A-Z2-7]+)$/, "JELLYPAL-$1-$2-$3");
  if (redeemed.includes(fmt)) return "CODE USED";
  try {
    const gems = await invoke("verify_gem_code", { code: fmt });
    redeemed.push(fmt);
    jelly += gems;
    dirty = true;
    return `+${gems} GEMS!`;
  } catch {
    return "BAD CODE";
  }
}
let redeemMode = false;
let redeemBuf = "";
let redeemed = [];
// weekly spotlight species — deterministic pick from the ISO week key
const weekKey = (d = new Date()) => {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}W${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`;
};
const spotIdx = () => {
  const base = SPECIES.filter((p) => !p.id.startsWith("hyb"));
  let h = 0;
  for (const ch of weekKey()) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return base[Math.abs(h) % base.length];
};
let pomoHeartNext = 0;
let focusExe = "";
let sizeMul = 1;
let seen = false;
const bootT = Date.now();
const SIZE_STEPS = [0.8, 1, 1.2];
// the settings panel shrinks to fit small monitors and scrolls its rows
// inside a clipped viewport — footer stats stay pinned to the bottom
let setScroll = 0;
function settingsRect() {
  const ph = Math.min(424, Math.max(220, winH - 70));
  return [Math.round(winW / 2 - 95), Math.round(winH / 2 - ph / 2), 190, ph];
}
const SET_VIEW_TOP = 26, SET_VIEW_BOT = 34; // title gap + footer reserve
// 388 = last row's bottom edge (30 + 13*26 + 20) relative to panel top
function setMaxScroll() { return Math.max(0, 388 - (settingsRect()[3] - SET_VIEW_BOT)); }
function settingsRows() {
  const [px, py] = settingsRect();
  // self-clamp: a window shrink mid-scroll can't leave the list overscrolled
  setScroll = Math.max(0, Math.min(setMaxScroll(), setScroll));
  const rows = [];
  for (let i = 0; i < 14; i++) rows.push([px + 16, py + 30 + i * 26 - Math.round(setScroll), 158, 20]);
  return rows;
  // 0 VOL 1 SIZE 2 MOTION 3 PHOTO 4 ALBUM 5 POMO 6 FOCUS 7 BREAK
  // 8 SHARE 9 WEATHER 10 BOOT 11 GEMS 12 REDEEM 13 QUIT
}

// gem shop: the paid-gem surface. packs are bought on the itch.io page;
// the buyer gets a one-shot code and redeems it here (itch has no
// embedded desktop IAP, so the store link is just a browser hop)
let gemShop = false;
const GEM_SHOP_URL = ""; // itch.io page URL — fill in when the listing ships
// per-pack checkout links (Stripe Payment Link / Gumroad product / itch
// reward page per pack id). money flows through YOUR checkout — the app
// just opens the link in the browser; the buyer receives a redeem code
// out-of-band (download, email, or success page). empty = falls back to
// GEM_SHOP_URL.
const GEM_PACK_URLS = { A: "", B: "", C: "", D: "" };
const packUrl = (id) => GEM_PACK_URLS[id] || GEM_SHOP_URL;
// update probe: a tiny text file hosting the newest version string
// (e.g. "0.2.1") — any static host works; leave empty to disable
const UPDATE_URL = "";
let newVer = ""; // set when the probe reports a newer version
// local weather — cosmetic only: umbrella in rain, snowflakes in snow.
// polled every 30min; the Rust side resolves coarse ip geo -> open-meteo
let weatherOn = true;
let wxCode = -1;
let wxAt = 0;
const wxFresh = () => wxCode >= 0 && Date.now() - wxAt < 45 * 60000;
const wxRainy = () => wxFresh() && ((wxCode >= 51 && wxCode <= 67) || (wxCode >= 80 && wxCode <= 82) || wxCode >= 95);
const wxSnowy = () => wxFresh() && ((wxCode >= 71 && wxCode <= 77) || wxCode === 85 || wxCode === 86);
let bootOn = false; // launch at Windows startup (HKCU Run key)
// tuck-in: a cursor left alone for 5min gets a tiny blanket. lastCurMove
// only advances on real movement so idle detection survives the poll stream
let lastCurMove = Date.now();
let blanketT0 = 0;      // walking over to tuck in
let blanketUntil = 0;   // blanket visible window
let blanketX = 0, blanketY = 0;
let blanketCd = 0;      // next allowed tuck-in
// window surf: pet rides a platform that's being dragged
let prevSupX = 0, prevSupY = 0;
let rideWob = 0;
let lastSelfie = ""; // YYYY-MM-DD of the last auto-saved daily selfie
const GEM_PACK_PRICE = { A: "$0.50", B: "$0.90", C: "$1.90", D: "$3.90" };
function gemShopRect() { return [Math.round(winW / 2 - 140), Math.round(winH / 2 - 148), 280, 272]; }
function gemShopRows() {
  const [gx, gy] = gemShopRect();
  return [
    [gx + 16, gy + 196, 248, 22],  // 0 STORE PAGE (fallback link)
    [gx + 16, gy + 226, 248, 22],  // 1 REDEEM CODE
  ];
}
// per-pack BUY chip, docked at the right edge of pack row i
function packBuyRect(i) {
  const [gx, gy] = gemShopRect();
  return [gx + 16 + 248 - 54, gy + 62 + i * 26, 54, 20];
}

// share card: a pretty 800x450 collection snapshot saved to the photos
// folder — gives players something worth posting
function shareCard() {
  const W = 800, H = 450;
  const oc = document.createElement("canvas");
  oc.width = W; oc.height = H;
  const c = oc.getContext("2d");
  // deep violet backdrop + gold frame, same palette as the ranch theme
  c.fillStyle = "#241b2e";
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    const gx = 40 + ((i * 173) % 720), gy = 40 + ((i * 97) % 300);
    drawSpr(c, i % 2 ? "gem" : "star", gx, gy, 2, i % 2 ? "#5c4632" : "#554060");
  }
  c.strokeStyle = "#554060"; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
  const gold = "#ffd75e", lite = "#cbb8d9", dim = "#b09a78";
  drawText(c, "JELLYPAL", W / 2 - textW("JELLYPAL", 4) / 2 + 2, 28, 4, "#000000");
  drawText(c, "JELLYPAL", W / 2 - textW("JELLYPAL", 4) / 2, 24, 4, gold);
  // the star of the show: active slime, big, with its equipped accessory
  const sp = SPECIES[active];
  const nm = (customNames[sp.id] || sp.name).toUpperCase() + (shinyOwned[sp.id] ? " *" : "");
  drawText(c, nm, W / 2 - textW(nm, 2) / 2, 78, 2, lite);
  const img = sprite("happy", active);
  const sc = 7;
  c.drawImage(img, W / 2 - img.width * sc / 2, 96, img.width * sc, img.height * sc);
  const eq = accEquip[sp.id];
  if (eq) drawAcc(c, eq, W / 2, 96 + 6, sc * 0.85);
  drawText(c, RARITY_NAME[sp.r], W / 2 - textW(RARITY_NAME[sp.r], 1) / 2, 96 + img.height * sc + 10, 1, RARITY_COLOR[sp.r], null, true);
  // collection stats
  const baseAll = SPECIES.filter((p) => !p.id.startsWith("hyb")).length;
  const baseOwn = owned.filter((id) => !id.startsWith("hyb")).length;
  const shinyN = Object.keys(shinyOwned).filter((k) => shinyOwned[k]).length;
  const line = `DEX ${baseOwn}/${baseAll}   GEMS ${jelly}   SHINY ${shinyN}`;
  drawText(c, line, W / 2 - textW(line, 2) / 2, 330, 2, "#f5ead8");
  const line2 = `PULLS ${stats.pulls}   BREEDS ${stats.breeds}   PLAYS ${stats.plays}`;
  drawText(c, line2, W / 2 - textW(line2, 1) / 2, 352, 1, dim);
  // rare shelf: the fanciest few owned species, mini sprites in a row
  const flex = owned
    .map((id) => SPECIES.findIndex((p) => p.id === id))
    .filter((i) => i >= 0)
    .sort((a, b) => SPECIES[b].r - SPECIES[a].r || b - a)
    .slice(0, 8);
  const msc = 2.6, gap = 52;
  let fx = W / 2 - (flex.length - 1) * gap / 2;
  for (const i of flex) {
    const mi = sprite("idle", i);
    c.drawImage(mi, fx - mi.width * msc / 2, 396 - mi.height * msc, mi.width * msc, mi.height * msc);
    if (SPECIES[i].r >= 2) drawSpr(c, "star5", fx + 14, 396 - mi.height * msc - 8, 1.4);
    fx += gap;
  }
  const tag = "A TINY SLIME RANCH ON YOUR DESKTOP";
  drawText(c, tag, W / 2 - textW(tag, 1) / 2, H - 18, 1, dim);
  const data = oc.toDataURL("image/png").split(",")[1];
  invoke("save_png", { data, name: `share_${Date.now()}` }).then(() => {
    bangs.push({ x: winW / 2, y: 100, life: 2, t: "CARD SAVED!" });
    sfx.reveal();
    invoke("open_photos").catch(() => {});
  }).catch(() => {});
}

// daily selfie: once per day the pet poses for a dated photo card that
// lands in the album — a slow drip of shareable shots
function dailySelfie() {
  const W = 440, H = 320;
  const oc = document.createElement("canvas");
  oc.width = W; oc.height = H;
  const c = oc.getContext("2d");
  c.fillStyle = "#f7ecd7"; c.fillRect(0, 0, W, H);
  c.strokeStyle = "#8a6b4a"; c.lineWidth = 5; c.strokeRect(2, 2, W - 4, H - 4);
  const gold = "#d4a017", brown = "#5c4632", dim = "#8a6b4a";
  drawText(c, "JELLYPAL", W / 2 - textW("JELLYPAL", 3) / 2 + 2, 24, 3, "#c9a06c");
  drawText(c, "JELLYPAL", W / 2 - textW("JELLYPAL", 3) / 2, 20, 3, gold);
  const d = new Date();
  const ds = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  drawText(c, ds, W / 2 - textW(ds, 1) / 2, 52, 1, dim);
  const sp = SPECIES[active];
  const img = sprite(Math.random() < 0.5 ? "wink" : "happy", active);
  const sc = 5;
  c.drawImage(img, W / 2 - img.width * sc / 2, 78, img.width * sc, img.height * sc);
  const eq = accEquip[sp.id];
  if (eq) drawAcc(c, eq, W / 2, 82, sc * 0.85);
  // a mood caption from how it's actually feeling right now
  const mood = performance.now() < begUntil ? "NEEDY" : energy > 0.62 ? "PLAYFUL" : energy < 0.3 ? "LAZY" : "CONTENT";
  drawText(c, `TODAY: ${mood}`, W / 2 - textW(`TODAY: ${mood}`, 1) / 2, 78 + img.height * sc + 16, 1, brown, null, true);
  for (let i = 0; i < 4; i++) drawSpr(c, "heart", 60 + i * 106, 40 + (i % 2) * 8, 1.4);
  drawSpr(c, "star5", W - 40, H - 34, 1.6);
  drawText(c, "DAILY SELFIE", 22, H - 24, 1, dim);
  const data = oc.toDataURL("image/png").split(",")[1];
  invoke("save_png", { data, name: `selfie_${Date.now()}` }).then(() => {
    bangs.push({ x: petX, y: petY - 110, life: 2, t: "SELFIE!" });
    hearts.push({ x: petX + 18, y: petY - 70, life: 1.4 });
    sfx.reveal();
    lastSelfie = ds.slice(0, 10).replace(/\./g, "-");
    dirty = true;
  }).catch(() => {});
}

invoke("is_demo").then((v) => { DEMO = !!v; });
// update probe: compare the remote version file against APP_VER once at
// boot; a newer remote lights the NEW VER badge in settings
function verNewer(a, b) {
  const pa = String(a).replace(/^v/i, "").split(".").map(Number);
  const pb = String(b).replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}
if (UPDATE_URL) {
  invoke("check_update", { url: UPDATE_URL }).then((v) => {
    if (verNewer(v, APP_VER)) { newVer = v; sfx.reveal(); }
  }).catch(() => {});
}
function pollWeather() {
  if (!weatherOn) return;
  invoke("get_weather").then((c) => {
    if (typeof c === "number") { wxCode = c; wxAt = Date.now(); }
  }).catch(() => {});
}
setInterval(pollWeather, 30 * 60000);
setTimeout(pollWeather, 4000); // let the network settle first
invoke("load_state").then((txt) => {
  let s = {};
  try { s = JSON.parse(txt) || {}; } catch {} // a literal "null" save parses fine but isn't an object
  xp = s.xp | 0;
  level = Math.min(3, Math.floor(xp / KEYS_PER_LEVEL));
  if (typeof s.jelly === "number") jelly = s.jelly | 0;
  pityRare = s.pityRare | 0;
  pityLeg = s.pityLeg | 0;
  hybSeq = s.hybSeq | 0;
  if (Array.isArray(s.hybrids)) {
    for (const h of s.hybrids) {
      // validate saved hybrids — a bad shape/pal would crash the frame loop
      if (!h || typeof h !== "object" || typeof h.id !== "string" || typeof h.name !== "string") continue;
      if (!h.pal || typeof h.pal !== "object") continue;
      h.shape = SHAPES[h.shape] ? h.shape : "round";
      for (const k of ["o", "b", "l", "s", "e", "w", "m", "k"]) {
        if (typeof h.pal[k] !== "string") h.pal[k] = "#8a6b4a";
      }
      if (typeof h.r !== "number") h.r = 0;
      h.bornAt = Number(h.bornAt) || 0;
      SPECIES.push(h);
      slotPh.push(Math.random() * 5);
    }
  }
  if (Array.isArray(s.owned) && s.owned.length) owned = s.owned;
  owned = owned.filter((id) => SPECIES.some((p) => p.id === id));
  if (!owned.length) owned = ["sprout"];
  if (Array.isArray(s.accOwned)) accOwned = s.accOwned.filter((id) => ACCS.some((a) => a.id === id));
  if (s.accEquip && typeof s.accEquip === "object") {
    // gear is authoritative through ownership: strip equips that reference
    // an accessory the player never bought or a species they don't own, so
    // a stale/doctored save can't show every doodad as equipped
    for (const k of Object.keys(s.accEquip)) {
      const v = s.accEquip[k];
      if (accOwned.includes(v) && owned.includes(k)) accEquip[k] = v;
    }
  }
  breedReadyAt = Number(s.breedReadyAt) || 0;
  // offline earnings: 1 gem per 10 minutes away, capped at 20
  const awayMin = (Date.now() - (Number(s.savedAt) || 0)) / 60000;
  const awayGems = s.savedAt ? Math.min(20, Math.floor(awayMin / 10)) : 0;
  if (awayGems > 0) {
    jelly += awayGems;
    awayReport = { mins: Math.floor(awayMin), gems: awayGems, until: performance.now() + 9000 };
    setTimeout(() => sfx.reveal(), 800);
    dirty = true;
  }
  muted = !!s.muted;
  volStep = Math.min(3, Math.max(0, s.volStep | 0));
  if (muted) volStep = 3;
  // new continuous volume wins when present; legacy saves migrate via
  // their old discrete step
  if (typeof s.vol === "number") vol = Math.min(1, Math.max(0, s.vol));
  else vol = VOL_STEPS[volStep];
  muted = vol <= 0.001;
  volStep = Math.round((1 - vol) * 3); // keep the shim field coherent
  pomo = !!s.pomo;
  if (POMO_FOCI.includes(s.pomoFocusMin)) pomoFocusMin = s.pomoFocusMin;
  if (POMO_BREAKS.includes(s.pomoBreakMin)) pomoBreakMin = s.pomoBreakMin;
  if (pomo) { pomoPhase = "focus"; pomoLen = pomoFocusMin * 60000; pomoUntil = Date.now() + pomoLen; }
  if (SIZE_STEPS.includes(s.sizeMul)) sizeMul = s.sizeMul;
  reduceMotion = !!s.reduceMotion;
  treatKind = Math.min(TREATS.length - 1, Math.max(0, s.treatKind | 0));
  if (s.stats && typeof s.stats === "object") stats = { ...stats, ...s.stats };
  dexMile = Math.min(DEX_MILES.length, Math.max(0, s.dexMile | 0));
  seen = !!s.seen;
  hintsSeen = s.hints || {};
  if (Array.isArray(s.redeemed)) redeemed = s.redeemed;
  // dragged panel positions — validated so a bad save can't park a
  // window off-screen; ignored entirely when the viewport changed
  // (a position saved on a different resolution is a wrong position)
  if (s.panelPos && typeof s.panelPos === "object" && s.panelPos._res === `${winW}x${winH}`) {
    for (const k of ["ranch", "nursery", "card"]) {
      const pp = s.panelPos[k];
      if (pp && typeof pp.x === "number" && typeof pp.y === "number") panelPos[k] = pp;
    }
  }
  if (s.names && typeof s.names === "object") customNames = s.names;
  if (s.shiny && typeof s.shiny === "object") shinyOwned = s.shiny;
  weatherOn = s.weatherOn !== false; // default on — cosmetic only
  bootOn = !!s.bootOn;
  lastSelfie = s.lastSelfie || "";
  if (bootOn) invoke("set_autostart", { enable: true }).catch(() => {}); // heal a moved exe path
  // daily selfie: once per calendar day, ~12s in so the boot settles
  const todayKey = new Date().toISOString().slice(0, 10);
  if (lastSelfie !== todayKey) setTimeout(() => { if (lastSelfie !== todayKey) dailySelfie(); }, 12000);
  if (typeof s.x === "number") petX = Math.max(60, Math.min(winW - 60, s.x));
  const ai = SPECIES.findIndex((p) => p.id === s.active);
  if (ai >= 0 && owned.includes(SPECIES[ai].id)) active = ai;
  if (s.petHome === true) petHome = true;
  // placed props come back too — re-anchor them to whatever platform now
  // sits at their saved spot (monitor layouts can shift between runs)
  if (s.props && typeof s.props === "object") {
    const reanchor = (pp) => {
      if (!pp || typeof pp.x !== "number" || typeof pp.y !== "number") return null;
      const pl = plats.reduce((best, q) => {
        const dx = Math.abs(pp.x - (q.x + q.w / 2)), dy = Math.abs(pp.y - q.y);
        const sc = dx + dy * 4;
        return !best || sc < best.sc ? { q, sc } : best;
      }, null);
      const plat = pl ? pl.q : plats[0];
      if (!plat) return null;
      return { x: Math.max(plat.x + 30, Math.min(plat.x + plat.w - 30, pp.x)), y: plat.y, plat };
    };
    bowl = reanchor(s.props.bowl);
    cushion = reanchor(s.props.cushion);
    box = reanchor(s.props.box);
    plant = reanchor(s.props.plant);
    music = reanchor(s.props.music);
    mirror = reanchor(s.props.mirror);
    mat = reanchor(s.props.mat);
    jar = reanchor(s.props.jar);
    if (bowl && typeof s.props.bowl.fill === "number") bowl.fill = Math.max(0, Math.min(3, s.props.bowl.fill));
    if (jar && typeof s.props.jar.fill === "number") jar.fill = Math.max(0, Math.min(3, s.props.jar.fill));
  }
  if (s.bond && typeof s.bond === "object") bond = s.bond;
  if (typeof s.lastEgg === "string") lastEgg = s.lastEgg;
  if (Array.isArray(s.fab) && s.fab.every((v) => typeof v === "number" && v > -9000)) {
    fabX = Math.max(24, Math.min(winW - 24, s.fab[0]));
    fabY = Math.max(24, Math.min(winH - 24, s.fab[1]));
  }
  // restore summoned companions so the desktop crew survives restarts
  if (Array.isArray(s.pals)) {
    for (const id of s.pals) {
      const pi = SPECIES.findIndex((p) => p.id === id);
      if (pi >= 0 && owned.includes(id)) spawnPal(pi);
    }
  }
  // pay any milestones the collection already earned (pre-feature saves)
  checkDex();
  // daily login: a gem stipend that grows with consecutive-day streaks
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = dayKey(new Date());
  if (s.lastDaily !== today) {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    dailyStreak = s.lastDaily === dayKey(yd) ? (s.dailyStreak | 0) + 1 : 1;
    lastDaily = today;
    const gift = 10 + Math.min(6, dailyStreak - 1) * 3;
    jelly += gift;
    bangs.push({ x: petX, y: petY - 110, life: 2.4, t: `DAY ${dailyStreak}! +${gift}` });
    setTimeout(() => sfx.reveal(), 400);
    dirty = true;
  } else {
    dailyStreak = s.dailyStreak | 0;
    lastDaily = s.lastDaily || "";
  }
  // weekly bonus + spotlight species rotation
  const wk = weekKey();
  if (s.lastWeekly !== wk) {
    lastWeekly = wk;
    jelly += 30;
    bangs.push({ x: petX, y: petY - 130, life: 2.6, t: `WEEK +30` });
    dirty = true;
  } else lastWeekly = s.lastWeekly || wk;
});

// pays the next collection milestone whenever the dex count crosses it
function checkDex() {
  const n = owned.filter((id) => !id.startsWith("hyb")).length;
  while (dexMile < DEX_MILES.length && n >= DEX_MILES[dexMile][0]) {
    jelly += DEX_MILES[dexMile][1];
    bangs.push({ x: petX, y: petY - 120, life: 2, t: `DEX ${DEX_MILES[dexMile][0]}! +${DEX_MILES[dexMile][1]}` });
    sfx.reveal();
    dexMile++;
    dirty = true;
  }
}

function persist() {
  dirty = false;
  invoke("save_state", {
    json: JSON.stringify({
      ver: 2, xp, x: petX, jelly, owned, active: SPECIES[active].id,
      pityRare, pityLeg, hybSeq, accOwned, accEquip, breedReadyAt,
      muted, vol, sizeMul, seen, savedAt: Date.now(),
      reduceMotion, treatKind, stats, volStep, pomo, dexMile,
      lastDaily, dailyStreak, lastWeekly, pomoFocusMin, pomoBreakMin,
      redeemed,
      panelPos, petHome, weatherOn, bootOn, lastSelfie, hints: hintsSeen,
      props: { bowl: bowl ? { x: bowl.x, y: bowl.y, fill: bowl.fill ?? 2 } : null, cushion: cushion ? { x: cushion.x, y: cushion.y } : null, box: box ? { x: box.x, y: box.y } : null, plant: plant ? { x: plant.x, y: plant.y } : null, music: music ? { x: music.x, y: music.y } : null, mirror: mirror ? { x: mirror.x, y: mirror.y } : null, mat: mat ? { x: mat.x, y: mat.y } : null, jar: jar ? { x: jar.x, y: jar.y, fill: jar.fill ?? 2 } : null },
      bond, lastEgg, fab: [fabX, fabY],
      names: customNames, shiny: shinyOwned,
      pals: pals.map((p) => (SPECIES[p.sp] ? SPECIES[p.sp].id : null)).filter(Boolean),
      hybrids: SPECIES.filter((p) => p.id.startsWith("hyb")),
    }),
  });
}
setInterval(() => { if (dirty) persist(); }, 5000);

// bred hybrids hatch as babies: half-size + pacifier for their first hour
const BABY_MS = 3600000;
const isBaby = (sp) => !!(sp && sp.id.startsWith("hyb") && sp.bornAt && Date.now() - sp.bornAt < BABY_MS);
function drawPaci(c, x, y, u) {
  c.fillStyle = "#7db8e8";
  c.fillRect(x - 2.5 * u, y - 1.5 * u, 5 * u, 4 * u);
  c.fillStyle = "#ffd75e";
  c.fillRect(x - 1.5 * u, y - 0.5 * u, 3 * u, 3 * u);
}

// companion slimes summoned from the ranch — simplified AI, they wander,
// hop, and play with each other and the main pet
const pals = [];
const MAX_PALS = 3; // three companions = real towers are possible
let mainPlayCd = 0;
// a prop stroll ends in a little ritual — the slime eats at the bowl
// one slime per puff: the cushion seats a single napper — the pet mid-doze
// or a pal already lying on it both count as taken
function cushionBusy(except, now) {
  if (!cushion) return false;
  if (now < cushionNap && Math.abs(petX - cushion.x) < 50) return true;
  return pals.some((q) => q !== except && now < (q.restUntil || 0) && Math.abs(q.x - cushion.x) < 50);
}

// or plops onto the cushion and dozes
function propArrive(g, now) {
  // stale-goal guards: (a) the walk must have ended near the spot the
  // errand aimed at — a treat/ball target reassigned mid-walk shouldn't
  // fire the ritual; (b) the prop itself must still be close by
  if (g.tx !== undefined && Math.abs(petX - g.tx) > 46) return;
  if (g.kind === "egg" && egg && Math.abs(petX - egg.x) < 55) {
    // peck, peck… crack! the slime taps the shell until it opens
    lookDir = Math.sign(egg.x - petX) || 1;
    lookUntil = now + 1500;
    munchUntil = now + 1200;
    bondGain(SPECIES[active].id, 2);
    sfx.munch();
    setTimeout(() => { if (egg) hatchEgg(); }, 1100);
    return;
  }
  if (g.kind === "bowl" && bowl && Math.abs(petX - bowl.x) < 60) {
    lookDir = Math.sign(bowl.x - petX) || 1;
    if ((bowl.fill ?? 2) <= 0) {
      // came all this way for crumbs — an empty bowl earns a pout
      lookUntil = now + 1400;
      poutUntil = now + 1600;
      bowlCd = now + 60000;
      bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.1, t: "?" });
      return;
    }
    bowl.fill = Math.max(0, (bowl.fill ?? 2) - 1);
    dirty = true;
    lookUntil = now + 2600;
    munchUntil = now + 2400;
    bowlCd = now + 45000;
    bondGain(SPECIES[active].id, 2);
    for (let i = 0; i < 7; i++) fx.push({ x: bowl.x + Math.random() * 14 - 7, y: bowl.y - 10, vx: Math.random() * 40 - 20, vy: -Math.random() * 60 - 10, life: 0.5, c: "#eec23f" });
    sfx.munch();
    setTimeout(() => sfx.munch(), 340);
    if (Math.random() < 0.5) { contentUntil = now + 2000; hearts.push({ x: petX + 12, y: petY - 60, life: 0.9 }); }
  } else if (g.kind === "cushion" && cushion && Math.abs(petX - cushion.x) < 60) {
    // the pet outranks pals: a dozing pal gets bounced clean off the puff
    for (const q of pals) {
      if (now < (q.restUntil || 0) && Math.abs(q.x - cushion.x) < 50) {
        q.restUntil = 0; q.restCd = now + 22000;
        q.fly = true; q.vy = -190;
        q.vx = (Math.sign(q.x - petX) || (Math.random() < 0.5 ? -1 : 1)) * 150;
        q.faceId = "shock"; q.faceT = now + 900;
        bangs.push({ x: q.x, y: q.y - 58, life: 1, t: "!" });
      }
    }
    petX = cushion.x; // settles dead-center on the puff
    sitUntil = now + 8000 + Math.random() * 6000;
    cushionNap = sitUntil;
    cushionNapW = Date.now() + (sitUntil - now);
    // a nap interrupts whatever was running — no mid-doze accessory bits
    accAct = null; propSpin = 0; sigT0 = 0; sigId = null; danceT0 = 0;
    cushionCd = sitUntil + 30000; // don't immediately re-nap after waking
    lookDir = 1;
    squashV += 5;
    // the puff exhales as it takes the weight
    for (let i = 0; i < 5; i++) fx.push({ x: cushion.x + (i - 2) * 8, y: cushion.y - 4, vx: (i - 2) * 18, vy: -14, life: 0.45, c: "#f0d0e0" });
    bondGain(SPECIES[active].id, 2);
    sfx.pop();
  } else if (g.kind === "box" && box && Math.abs(petX - box.x) < 60) {
    // the slime hops the rim and disappears inside — a dark box is the
    // best hiding spot on any desk
    petX = box.x;
    boxHide = now + 4500 + Math.random() * 5000;
    boxCd = boxHide + 30000;
    lookDir = 1;
    squashV += 4;
    for (let i = 0; i < 6; i++) fx.push({ x: box.x + (i - 2.5) * 7, y: box.y - 12, vx: (i - 2.5) * 14, vy: -30 - Math.random() * 20, life: 0.5, c: "#d8c49a" });
    bangs.push({ x: box.x, y: box.y - 40, life: 1, t: "?" });
    sfx.pop();
    dirty = true;
  } else if (g.kind === "plant" && plant && Math.abs(petX - plant.x) < 60) {
    // lean in and sniff — usually a happy nuzzle, sometimes a sneeze
    lookDir = Math.sign(plant.x - petX) || 1;
    lookUntil = now + 1800;
    plantCd = now + 50000;
    bondGain(SPECIES[active].id, 1);
    if (Math.random() < 0.25) {
      shockUntil = now + 700;
      squashV += 6;
      for (let i = 0; i < 6; i++) fx.push({ x: plant.x + (Math.random() - 0.5) * 16, y: plant.y - 26, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 50, life: 0.6, c: "#9adf8a" });
      bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "!" });
      sfx.pop();
    } else {
      contentUntil = now + 2200;
      hearts.push({ x: petX + 10, y: petY - 58, life: 1 });
      plant.steamUntil = Date.now() + 4000;
    }
  } else if (g.kind === "music" && music && Math.abs(petX - music.x) < 60) {
    // wind the key with a few bounces, then dance to the tune
    lookDir = Math.sign(music.x - petX) || 1;
    lookUntil = now + 1200;
    music.spinUntil = Date.now() + 3200;
    musicCd = now + 60000;
    danceT0 = now;
    bondGain(SPECIES[active].id, 2);
    for (let i = 0; i < 5; i++) bangs.push({ x: music.x - 14 + i * 9, y: music.y - 28 - i * 7, life: 1.1 + i * 0.14, t: "♪" });
    // the tune carries — nearby pals bounce too
    for (const p of pals) {
      if (Math.abs(p.x - music.x) < 320 && Math.abs(p.y - music.y) < 40 && !p.fly && p !== palHeld && now > (p.restUntil || 0)) {
        p.fly = true; p.vy = -170 - Math.random() * 60; p.vx = (Math.random() - 0.5) * 80; p.hopT = now;
        p.faceId = "happy"; p.faceT = now + 1000;
      }
    }
    sfx.pop();
  } else if (g.kind === "mirror" && mirror && Math.abs(petX - mirror.x) < 60) {
    // a look in the glass: bold slimes preen, timid ones startle away
    lookDir = Math.sign(mirror.x - petX) || 1;
    lookUntil = now + 2000;
    mirrorCd = now + 55000;
    bondGain(SPECIES[active].id, 1);
    for (let i = 0; i < 7; i++) fx.push({ x: mirror.x + (Math.random() - 0.5) * 18, y: mirror.y - 34 + Math.random() * 24, vx: (Math.random() - 0.5) * 30, vy: -18 - Math.random() * 24, life: 0.6, c: "#ffffff" });
    if ((PSYCH[SPECIES[active].ps] || {}).flee) {
      shockUntil = now + 900;
      poutUntil = now + 1400;
      flying = true; petVY = -150; petVX = -lookDir * 130;
      bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.1, t: "!" });
      sfx.drop();
    } else {
      smugUntil = now + 1800;
      bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.2, t: "✦" });
      if (Math.random() < 0.4) hearts.push({ x: petX + 12, y: petY - 60, life: 1 });
    }
  } else if (g.kind === "mat" && mat && Math.abs(petX - mat.x) < 60) {
    // springboard! one happy boing off the jelly pad
    petX = mat.x;
    matCd = now + 40000;
    matPoof = now + 800;
    flying = true; petVY = -300; petVX = (Math.random() - 0.5) * 70;
    contentUntil = now + 1600;
    squashV += 5;
    bangs.push({ x: mat.x, y: mat.y - 34, life: 1, t: "♪" });
    sfx.boing();
  } else if (g.kind === "jar" && jar && Math.abs(petX - jar.x) < 60) {
    // the cookie jar: a stolen nibble if there's any left, else a sad poke
    lookDir = Math.sign(jar.x - petX) || 1;
    lookUntil = now + 1400;
    jarCd = now + 50000;
    if ((jar.fill ?? 2) <= 0) {
      poutUntil = now + 1500;
      bangs.push({ x: jar.x, y: jar.y - 36, life: 1, t: "?" });
    } else {
      jar.fill--;
      jar.raidUntil = Date.now() + 1500;
      munchUntil = now + 1300;
      contentUntil = now + 1600;
      bondGain(SPECIES[active].id, 1);
      for (let i = 0; i < 6; i++) fx.push({ x: jar.x + (Math.random() - 0.5) * 16, y: jar.y - 18 - Math.random() * 8, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 26, life: 0.5, c: "#d9a05b" });
    }
  }
}

// a poke at the furniture: refill the kibble, fluff the pillow
function propTap(kind, q) {
  if (kind === "bowl") {
    q.fill = 3;
    q.steamUntil = performance.now() + 15000; // fresh kibble, still warm
    for (let i = 0; i < 8; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 16, y: q.y - 14 - Math.random() * 8, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0.6, c: "#eec23f" });
    bangs.push({ x: q.x, y: q.y - 30, life: 0.9, t: "♪" });
  } else if (kind === "box") {
    if (performance.now() < boxHide && Math.abs(petX - q.x) < 40) {
      // rattling an occupied box startles the squatter back out
      boxHide = 0;
      flying = true; petVY = -240; petVX = (Math.random() - 0.5) * 90;
      shockUntil = performance.now() + 900;
      bangs.push({ x: q.x, y: q.y - 44, life: 1.1, t: "!" });
      sfx.drop();
    } else {
      // rattle the box — something rustles inside
      for (let i = 0; i < 6; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 30, y: q.y - 10 - Math.random() * 8, vx: (Math.random() - 0.5) * 50, vy: -18 - Math.random() * 22, life: 0.5, c: "#d8c49a" });
      bangs.push({ x: q.x, y: q.y - 34, life: 0.9, t: "?" });
    }
  } else if (kind === "plant") {
    // a sprinkle of water — droplets, then the leaves perk up
    q.steamUntil = Date.now() + 4000;
    for (let i = 0; i < 8; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 20, y: q.y - 26 - Math.random() * 10, vx: (Math.random() - 0.5) * 24, vy: 26 + Math.random() * 20, life: 0.6, c: "#8ad4f0" });
  } else if (kind === "music") {
    // wind it up — a bar of notes spills out, nearby pals can't help
    // but bounce along
    q.spinUntil = Date.now() + 2800;
    for (let i = 0; i < 4; i++) bangs.push({ x: q.x - 12 + i * 10, y: q.y - 30 - i * 7, life: 1 + i * 0.15, t: "♪" });
    const mnow = performance.now();
    for (const p of pals) {
      if (Math.abs(p.x - q.x) < 300 && Math.abs(p.y - q.y) < 40 && !p.fly && p !== palHeld && mnow > (p.restUntil || 0)) {
        p.fly = true; p.vy = -160 - Math.random() * 60; p.vx = (Math.random() - 0.5) * 70; p.hopT = mnow;
        p.faceId = "happy"; p.faceT = mnow + 900;
      }
    }
  } else if (kind === "mirror") {
    // polish the glass — a flash of sparkles ripples down the pane
    for (let i = 0; i < 10; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 20, y: q.y - 40 + Math.random() * 30, vx: (Math.random() - 0.5) * 26, vy: -14 - Math.random() * 20, life: 0.6, c: "#ffffff" });
    bangs.push({ x: q.x, y: q.y - 44, life: 0.9, t: "✦" });
  } else if (kind === "mat") {
    // a stomp test — the pad over-inflates and settles, like the cushion
    matPoof = performance.now() + 800;
    for (let i = 0; i < 7; i++) fx.push({ x: q.x + (i - 3) * 8, y: q.y - 5, vx: (i - 3) * 15, vy: -24 - Math.random() * 18, life: 0.5, c: "#a8e8c0" });
  } else if (kind === "jar") {
    // shake the jar — it restocks, and if the coast is clear a cookie
    // tumbles out as a real treat (the snack race will find it)
    q.fill = 3;
    q.raidUntil = Date.now() + 1200;
    const tnow = performance.now();
    for (let i = 0; i < 8; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 18, y: q.y - 20 - Math.random() * 10, vx: (Math.random() - 0.5) * 60, vy: -24 - Math.random() * 30, life: 0.5, c: "#d9a05b" });
    if (!treat && tnow > (q.spillCd || 0)) {
      q.spillCd = tnow + 15000;
      treat = { x: q.x + (Math.random() < 0.5 ? -30 : 30), y: q.y, kind: 0, t0: tnow };
      bangs.push({ x: q.x, y: q.y - 42, life: 1.1, t: "!" });
    } else {
      bangs.push({ x: q.x, y: q.y - 42, life: 0.9, t: "♪" });
    }
  } else {
    cushionPoof = performance.now() + 700;
    for (let i = 0; i < 7; i++) fx.push({ x: q.x + (i - 3) * 7, y: q.y - 6, vx: (i - 3) * 16, vy: -26 - Math.random() * 20, life: 0.5, c: "#f0d0e0" });
  }
  sfx.pop();
  dirty = true;
}

// the daily mystery egg drops on the pet's own deck, a hop away — the
// pet waddles over and pecks it open, or it hatches by itself ~2.5min
function dropEgg() {
  const sup = plats.find((p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14) || plats[0];
  if (!sup) return;
  const side = petX < sup.x + sup.w / 2 ? 1 : -1;
  egg = {
    x: Math.max(sup.x + 50, Math.min(sup.x + sup.w - 50, petX + side * (120 + Math.random() * 60))),
    y: sup.y, plat: sup, t0: performance.now(), wob: Math.random() * 5,
  };
  bangs.push({ x: egg.x, y: egg.y - 44, life: 1.4, t: "!" });
  sfx.drop();
}
function hatchEgg() {
  if (!egg) return;
  const ex = egg.x, ey = egg.y;
  egg = null;
  for (let i = 0; i < 10; i++) fx.push({ x: ex + Math.random() * 20 - 10, y: ey - 8 - Math.random() * 14, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90, life: 0.7, c: "#f4ead8" });
  // commons and rares only — legendaries stay gacha prestige
  const pool = SPECIES.filter((s) => s.r <= 2 && !owned.includes(s.id) && !s.id.startsWith("hyb") && seasonOpen(s));
  if (pool.length) {
    const g = pool[(Math.random() * pool.length) | 0];
    owned.push(g.id);
    bangs.push({ x: ex, y: ey - 50, life: 2, t: "NEW!" });
    setTimeout(() => bangs.push({ x: ex, y: ey - 66, life: 1.6, t: (spName(g) || g.id).toUpperCase() }), 500);
  } else {
    jelly += 60;
    bangs.push({ x: ex, y: ey - 50, life: 1.6, t: "+60" });
  }
  hearts.push({ x: ex, y: ey - 40, life: 1.2 });
  sfx.reveal();
  dirty = true;
}

// place a prop on the pet's current deck, a little to the side so it
// doesn't spawn inside the slime
function spawnProp() {
  const sup = plats.find((p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14) || plats[0] || { x: 0, y: winH, w: winW };
  const side = petX < sup.x + sup.w / 2 ? 110 : -110;
  let x = Math.max(sup.x + 40, Math.min(sup.x + sup.w - 40, petX + side));
  // don't stack furniture — nudge off an existing prop on the same deck
  for (const q of [bowl, cushion, box, plant, music, mirror, mat, jar]) {
    if (q && Math.abs(q.y - sup.y) < 10 && Math.abs(q.x - x) < 46) {
      x = q.x + (x < q.x ? -70 : 70);
      x = Math.max(sup.x + 40, Math.min(sup.x + sup.w - 40, x));
    }
  }
  return { x, y: sup.y, plat: sup };
}

function spawnPal(i) {
  if (pals.length >= MAX_PALS) return false;
  pals.push({
    sp: i, x: Math.max(50, Math.min(winW - 50, petX + [110, -110, 170][pals.length] || -170)), y: petY - 70,
    vx: 0, vy: 0, fly: true, plat: null, walkT: null, nextT: performance.now() + 1200,
    squash: 0, squashV: 0, lookDir: 1, lookUntil: 0, faceT: 0, faceId: null, playCd: 0, ph: Math.random() * 5,
    web: 0, webA: 0, webAV: 0,
    stackOn: null, stackT: 0, stackCd: 0, stackRise: 0, hopT: 0,
    sigT: 0, sigId: null, sigDid: 0, tag: null,
  });
  return true;
}
// drop a pal into the HOME slot (or right-click it) to send it back to
// the ranch — it stays owned and can be re-summoned any time
function sendPalHome(p) {
  const i = pals.indexOf(p);
  if (i < 0) return;
  for (let k = 0; k < 12; k++) {
    fx.push({ x: p.x + Math.random() * 34 - 17, y: p.y - Math.random() * 44 - 8, vx: Math.random() * 80 - 40, vy: -Math.random() * 70 - 10, life: 0.8, c: "#e8e0c8" });
  }
  bangs.push({ x: p.x, y: p.y - 72, life: 1.4, t: "BYE!" });
  pals.splice(i, 1);
  // the main pet wells up a little when a friend leaves
  if (Math.abs(p.x - petX) < 400) cryUntil = performance.now() + 1100;
  sfx.drop();
  dirty = true;
}
// send the MAIN pet back to its ranch room too — the desktop goes quiet
// but the economy keeps running. bring it back from the ranch cell's +
function sendPetHome() {
  for (let k = 0; k < 12; k++) {
    fx.push({ x: petX + Math.random() * 40 - 20, y: petY - Math.random() * 50 - 8, vx: Math.random() * 80 - 40, vy: -Math.random() * 70 - 10, life: 0.8, c: "#e8e0c8" });
  }
  bangs.push({ x: petX, y: petY - 76, life: 1.4, t: "BYE!" });
  petHome = true;
  held = false;
  flying = false;
  climbing = false;
  webbing = false;
  sigT0 = 0; sigId = null;
  danceT0 = 0;
  huntT0 = 0; huntPounce = false;
  walkTarget = null; hopTarget = null;
  treat = null;
  sfx.drop();
  dirty = true;
}
// called from the ranch cell: the pet drops back in at the top of the
// screen and falls to wherever it was hanging out before
function bringPetHome() {
  petHome = false;
  petX = Math.max(60, Math.min(winW - 60, curX > -9000 ? curX : winW / 2));
  petY = 60;
  petVX = 0;
  petVY = 120;
  flying = true;
  awakeAt = Date.now();
  for (let k = 0; k < 10; k++) {
    fx.push({ x: petX + Math.random() * 40 - 20, y: petY - Math.random() * 30, vx: Math.random() * 60 - 30, vy: -Math.random() * 40, life: 0.7, c: "#e8e0c8" });
  }
  bangs.push({ x: petX, y: petY - 50, life: 1.4, t: "HI!" });
  contentUntil = performance.now() + 1500;
  sfx.reveal();
  dirty = true;
}
// signature-act entrance fanfare: a radial particle burst + sfx in
// species-appropriate color. deliberately NO screen shake/flash — those
// read as hostile UI; the act's own animation carries the spectacle
function sigWow(now, sp, x, y) {
  // particle-only fanfare — screen shake/flash were cut as user-hostile;
  // the wow comes from the act itself and a species-colored burst
  const col = sp.r >= 3 ? "#ffd75e" : "#c9a06c";
  const n = sp.r >= 3 ? 16 : 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const sp2 = sp.r >= 3 ? 190 : 120;
    fx.push({ x, y: y - 26, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 * 0.7, life: 0.6, c: col });
  }
  if (sp.r >= 3) {
    for (let k = 0; k < 6; k++) {
      fx.push({ x: x + Math.random() * 30 - 15, y: y - 30, vx: Math.random() * 40 - 20, vy: -120 - Math.random() * 80, life: 0.8, c: "#ffffff" });
    }
    sfx.reveal();
  } else sfx.pop();
}
// legendary idle flourish: the reason these species are legendary is
// how they MOVE — every few idle seconds each does its own signature
// micro-performance, not just another particle puff
function legFlair(sp, now) {
  switch (sp.id) {
    case "drago": // wing-flare rear + a snorted ember puff
      stretchUntil = now + 700;
      squashV += 3;
      for (let i = 0; i < 4; i++) {
        fx.push({ x: petX + (lookDir || 1) * 18, y: petY - 30, vx: (lookDir || 1) * (60 + Math.random() * 60), vy: -30 - Math.random() * 30, life: 0.5, c: i % 2 ? "#e85a2a" : "#ff8a2a" });
      }
      sfx.pop();
      break;
    case "stella": // pirouette trailing star afterimages
      spinT0 = now;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28;
        fx.push({ x: petX + Math.cos(a) * 26, y: petY - 20 + Math.sin(a) * 14, vx: 0, vy: -14, life: 0.7, c: "#e8f0ff" });
      }
      sfx.boing();
      break;
    case "pulsar": // gravity flex: implosion ring + a body pulse
      gravRings.push({ x: petX, y: petY - 22, r: 48, life: 1 });
      squashV += 3;
      sfx.pop();
      break;
    case "gold": // flips a coin-sparkle over her head, catches it beaming
      starUntil = now + 800;
      for (let i = 0; i < 7; i++) {
        fx.push({ x: petX + Math.random() * 20 - 10, y: petY - 40 - i * 6, vx: (Math.random() - 0.5) * 30, vy: -50 - i * 12, life: 0.6, c: "#ffd75e" });
      }
      sfx.heart();
      break;
    case "rex": // the royal bow: stretches tall, crown-glint overhead
      stretchUntil = now + 600;
      squashV += 4;
      fx.push({ x: petX, y: petY - 54, vx: 0, vy: -14, life: 0.9, c: "#ffd75e", spr: "star5" });
      sfx.pop();
      break;
    case "siren": // rising three-note run, heart drifting after
      for (let i = 0; i < 3; i++) {
        bangs.push({ x: petX - 16 + i * 16, y: petY - 62 - i * 10, life: 1.2 + i * 0.15, t: "♪" });
      }
      hearts.push({ x: petX + 14, y: petY - 60, life: 1 });
      sfx.heart();
      break;
    case "molten": // belly-glow flex, vents two lava drips
      squashV += 4;
      for (let i = 0; i < 5; i++) {
        fx.push({ x: petX + (Math.random() - 0.5) * 24, y: petY - 6, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, life: 0.7, c: i % 2 ? "#e85a2a" : "#ff8a2a" });
      }
      sfx.pop();
      break;
    case "cliff": // one heavy stomp — dust poof + a ground ripple
      squashV += 8;
      ripples.push({ x: petX, y: petY + 2, r: 9, life: 1.1 });
      for (let i = 0; i < 7; i++) {
        fx.push({ x: petX + (Math.random() - 0.5) * 50, y: petY - 4, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, life: 0.5, c: "#c8b8a0" });
      }
      sfx.drop();
      break;
    case "bites": // chases its own tail — quick dizzy circle + chomp
      spinT0 = now;
      munchUntil = now + 550;
      blepUntil = now + 900;
      sfx.boing();
      break;
    case "spidr": // silk bounce — a little hop trailing web glints
      flying = true;
      petVY = -180;
      petVX = 0;
      for (let i = 0; i < 3; i++) {
        fx.push({ x: petX, y: petY - 40 - i * 8, vx: 0, vy: 10, life: 0.4, c: "#eef2f6" });
      }
      sfx.pop();
      break;
    case "comet": // loop-the-loop hop, ember trail in its wake
      flying = true;
      petVY = -260;
      petVX = (Math.random() < 0.5 ? -1 : 1) * 140;
      spinT0 = now;
      sfx.boing();
      break;
  }
}
function palScale(p) {
  return (1.3 + level * 0.4) * sizeMul * (isBaby(SPECIES[p.sp]) ? 0.55 : 0.92);
}
function palRect(p) {
  const sc = palScale(p);
  const w = SW * sc, h = SH * sc;
  return [p.x - w / 2 - 8, p.y - h - 12, w + 16, h + 24];
}
function palAt(mx, my) {
  for (const p of pals) {
    if (performance.now() < (p.hideUntil || 0)) continue; // hidden in the box
    const [x, y, w, h] = palRect(p);
    if (mx >= x && mx <= x + w && my >= y && my <= y + h) return p;
  }
  return null;
}
// nearest platform at-or-below (x,y); falls back to the screen floor.
// NEVER fall back to plats[0] — that's the topmost window and teleports
// slimes upward when their platform vanishes
function platUnder(x, y) {
  let best = null;
  for (const q of plats) {
    if (x > q.x - 20 && x < q.x + q.w + 20 && q.y >= y - 4 && (!best || q.y < best.y)) best = q;
  }
  return best || { x: 0, y: winH, w: winW };
}
// legendary flourish: every legendary gets a unique visible quirk on top
// of its signature act — concept-matched, drawn live over/behind the blob
const LEG = {
  stella: { floaty: true, wings: "#f2f6ff", starburst: true }, // angel wings; blinks leave star pops
  drago:  { wings: "#7a3a4a", heavy: true, embers: true },     // heavy thud landings, wing-driven drift
  gold:   { halo: "#ffd75e", luck: true, goldtrail: true },    // sparkle trail while gliding
  rex:    { halo: "#ffd75e", strut: true },                    // royal shimmer + dignified strut
  comet:  { trail: "#ff8a3f" },                                // ember tail while it streaks
  molten: { glow: "#e85a2a", heart: true },                    // pulsing magma heart + rising embers
  siren:  { notes: true, captivate: true },                    // nearby pals stop and listen
  cliff:  { chips: true, tremor: true, summit: true },         // grit + stomps + summit venting
  bites:  { drool: true, lunge: true, snap: true },            // drool drips; lunges; jaw snaps
  pulsar: { orbit: true, pulse: true },                        // debris + periodic vacuum rings
  spidr:  { legs: true },                                      // spider legs kick while dangling
};
// sprite-based wings: 3 bitmap flap frames, tinted per species, mirrored.
// drawn in the pet's local space before the sprite so the body covers the
// wing roots. replaces the old bezier strokes so wings read as pixel art
function drawWings(c, t, sx, sy, flap, color) {
  const ph = t * (flap ? 14 : 5);
  const f = Math.min(2, Math.floor(((Math.sin(ph) + 1) / 2) * 3));
  const img = wingImg(f, color || "#f2f6ff");
  const w = img.width * sx, h = img.height * sx;
  const bob = Math.sin(ph - 0.6) * (flap ? 1.6 : 0.8);
  for (const m of [-1, 1]) {
    c.save();
    c.translate(m * SW * sx * 0.3, -SH * sy * 0.56 + bob);
    c.scale(m, 1);
    c.rotate(-0.12 + Math.sin(ph - 0.9) * (flap ? 0.16 : 0.07));
    c.drawImage(img, 0, -h, w, h);
    c.restore();
  }
}
// webby's spider legs — four little bent-leg sprites that kick while she
// dangles from the cursor thread. drawn in local space like the wings
function drawLegs(c, t, sx, sy) {
  const img = sprImg("leg");
  for (const m of [-1, 1]) {
    for (let l = 0; l < 2; l++) {
      const k = Math.sin(t * 9 + l * 2.1 + (m < 0 ? 1.4 : 0));
      const bx = m * (SW * sx * 0.3 + l * 4);
      const by = -SH * sy * (0.32 - l * 0.14);
      c.save();
      c.translate(bx, by);
      c.scale(m, 1);
      c.rotate(0.5 + k * 0.45);
      c.drawImage(img, 0, 0, img.width * 1.6, img.height * 1.6);
      c.restore();
    }
  }
}
// ambient legendary ticks — small fx each species sheds as it lives.
// kick() feeds squash impulses back into the caller's spring so the
// flourish can move the BODY, not just the particles around it
const gravRings = []; // pulsar's collapsing vacuum rings {x,y,r,life}

// pal mini-signatures: companions don't run the full act state machine,
// but they still show off a ~1s flourish themed on their species' skill.
// pat = particle pattern, t = the bang glyph it ends with
const PAL_FLAIR = {
  shower:      { c: ["#ffd75e", "#ffe9a8"], pat: "rain", t: "✦" },
  starburst:   { c: ["#ffd75e", "#e8f0ff"], pat: "ring", t: "✦" },
  landslide:   { c: ["#8a7a66", "#a89478", "#c9b89a"], pat: "rain", t: "!" },
  frenzy:      { c: ["#ffb0a0", "#e8d8bc"], pat: "zig", t: "!" },
  reentry:     { c: ["#ff8a3f", "#ffd75e"], pat: "rise", t: "!" },
  eruption:    { c: ["#ff8a3f", "#e05a3a"], pat: "rise", t: "!" },
  song:        { c: ["#8fd4f0", "#b8e8f5"], pat: "drift", t: "♪" },
  webshot:     { c: ["#eef2f6"], pat: "drift", t: "✦" },
  firebreath:  { c: ["#ff8a3f", "#e05a3a", "#ffd75e"], pat: "cone", t: "!" },
  singularity: { c: ["#8ad4f0", "#6b5a9e"], pat: "implode", t: "✦" },
  decree:      { c: ["#ffd75e"], pat: "ring", t: "★" },
  pounce:      { c: ["#8fd4f0"], pat: "hop", t: "!" },
  zap:         { c: ["#8fd4f0"], pat: "crackle", t: "!" },
  voidpull:    { c: ["#6b5a9e"], pat: "implode", t: "✦" },
  veil:        { c: ["#5ad4c4", "#b88ad4", "#7a9fe8"], pat: "drift", t: "✦" },
  bubbleup:    { c: ["#8ee03f"], pat: "rise", t: "♪" },
  beep:        { c: ["#8fd4f0"], pat: "crackle", t: "!" },
  phase:       { c: ["#c4b2f0"], pat: "drift", t: "✦" },
  orbit:       { c: ["#ffd75e"], pat: "ring", t: "✦" },
  smokebomb:   { c: ["#9aa7b8"], pat: "drift", t: "!" },
  burst:       { c: ["#e05a6e", "#ffd75e"], pat: "ring", t: "!" },
  flare:       { c: ["#ffb35c"], pat: "cone", t: "✦" },
  rollout:     { c: ["#ffd75e"], pat: "zig", t: "!" },
  ribbit:      { c: ["#7ec860"], pat: "hop", t: "!" },
  umbral:      { c: ["#43346b"], pat: "drift", t: "✦" },
  spectrum:    { c: ["#ff5a6e", "#ff8a2a", "#ffd75e", "#5ad46e", "#5aa8f0", "#b88ad4"], pat: "ring", t: "✦" },
  jingle:      { c: ["#ffffff", "#e0455a", "#4fbd63"], pat: "rain", t: "♪" },
};
// elemental pair synergy: when pals whose traits react bump into each
// other, the meeting produces something — fire+water steams, spark+wisp
// ignites a will-o-wisp ring, drips scatter bubbles. keyed on sorted pair
const SYNERGY = {
  "drip+spark":  { n: 8, v: 26, up: true,  c: ["#e8e8e8", "#cfd8e0"], t: "!" },          // steam
  "glint+spark": { n: 7, v: 60, up: false, c: ["#ffd75e", "#fff0a8"], t: "✦" },          // fireworks
  "drip+glint":  { n: 6, v: 34, up: true,  c: ["#ff9ad5", "#9ad5ff", "#c8ff9a"], t: "✦" }, // prism drops
  "spark+wisp":  { n: 7, v: 40, up: true,  c: ["#b48cff", "#7fd8ff"], t: "✦" },          // will-o-wisp
  "bubble+drip": { n: 8, v: 30, up: true,  c: ["#aee8ff", "#d8f4ff"], t: "o" },          // bubble burst
  "glint+wisp":  { n: 6, v: 30, up: true,  c: ["#c9f2ff", "#e8ccff"], t: "★" },          // aurora motes
};
function legTick(sp, x, y, dt, moving, airborne, kick) {
  const lg = LEG[sp.id];
  if (!lg) return;
  if (lg.trail && airborne && Math.random() < dt * 30) {
    fx.push({ x, y: y - 8, vx: (Math.random() - 0.5) * 20, vy: 40, life: 0.45, c: lg.trail });
  }
  if (lg.glow && Math.random() < dt * 3) {
    fx.push({ x: x + Math.random() * 20 - 10, y: y - 4, vx: Math.random() * 8 - 4, vy: -34, life: 0.9, c: lg.glow });
  }
  if (lg.notes && Math.random() < dt * 0.55) {
    bangs.push({ x: x + Math.random() * 40 - 20, y: y - SH * 1.6 - 8, life: 1.1, t: "♪" });
    // siren's song: a nearby pal stops to listen — really smitten ones
    // get heart-eyes
    if (lg.captivate) {
      const pnow = performance.now();
      for (const p of pals) {
        if (!p.fly && Math.abs(p.y - y) < 24 && Math.abs(p.x - x) < 190 && Math.random() < 0.4) {
          p.lookDir = Math.sign(x - p.x) || 1;
          p.lookUntil = pnow + 1400;
          if (Math.random() < 0.25) hearts.push({ x: p.x, y: p.y - 58, life: 0.9 });
          if (Math.random() < 0.2 && pnow > p.faceT) { p.faceId = "love"; p.faceT = pnow + 1200; }
        }
      }
    }
  }
  if (lg.chips && moving && Math.random() < dt * 6) {
    fx.push({ x: x + (Math.random() - 0.5) * 20, y: y - 4, vx: (Math.random() - 0.5) * 40, vy: -20, life: 0.5, c: "#a89880" });
  }
  if (lg.tremor && moving && Math.random() < dt * 1.2) {
    kick(3); // a heavy footfall shakes the body itself
    fx.push({ x: x + (Math.random() - 0.5) * 30, y: y - 3, vx: (Math.random() - 0.5) * 50, vy: -30, life: 0.5, c: "#8a7a66" });
  }
  if (lg.summit && !moving && !airborne && Math.random() < dt * 0.8) {
    fx.push({ x: x + (Math.random() - 0.5) * 10, y: y - 40, vx: (Math.random() - 0.5) * 8, vy: -26, life: 0.9, c: "#c9b89a" });
  }
  if (lg.snap && moving && Math.random() < dt * 1.8) {
    kick(2.5); // jaw snap
    fx.push({ x, y: y - 18, vx: 0, vy: -20, life: 0.4, c: "#e05a6e" });
  }
  if (lg.drool && !airborne && Math.random() < dt * 1.1) {
    fx.push({ x: x + 10, y: y - 14, vx: 0, vy: 40, life: 0.7, c: "#9fd8f0" });
  }
  if (lg.halo && Math.random() < dt * 2.2) {
    fx.push({ x: x + Math.random() * 30 - 15, y: y - Math.random() * 40 - 6, vx: 0, vy: -20, life: 0.8, c: lg.halo });
  }
  if (lg.orbit && Math.random() < dt * 8) {
    // pulsar: loose particles spiral into its gravity well
    const a = Math.random() * 6.28, r = 42;
    fx.push({ x: x + Math.cos(a) * r, y: y - 22 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * 46 - Math.sin(a) * 26, vy: -Math.sin(a) * 30, life: 0.7, c: "#8ad4f0" });
  }
  // molten: the magma heart beats — a visible thump through the spring
  if (lg.heart && !airborne && Math.random() < dt * 1.6) {
    if (kick) kick(2.6);
    fx.push({ x: x + (Math.random() - 0.5) * 14, y: y - 30, vx: 0, vy: -26, life: 0.5, c: "#ff8a3f" });
  }
  // goldie sheds glitter wherever she glides
  if (lg.goldtrail && moving && !airborne && Math.random() < dt * 22) {
    fx.push({ x: x + (Math.random() - 0.5) * 30, y: y - 10 - Math.random() * 22, vx: (Math.random() - 0.5) * 10, vy: -8, life: 0.65, c: "#ffe98f" });
  }
  // drago smolders — slow ember breath while grounded
  if (lg.embers && !airborne && Math.random() < dt * 2.4) {
    fx.push({ x: x + (Math.random() - 0.5) * 12, y: y - 34, vx: (Math.random() - 0.5) * 12, vy: -38, life: 0.7, c: "#e05a3a", spr: "ember" });
  }
  // stella twinkles — soft star motes drift off her
  if (lg.starburst && Math.random() < dt * 3.5) {
    fx.push({ x: x + (Math.random() - 0.5) * 34, y: y - 8 - Math.random() * 40, vx: 0, vy: -14, life: 0.8, c: "#e8f0ff", spr: "mote" });
  }
  // pulsar's vacuum pulse: a collapsing ring every few seconds
  if (lg.pulse && !airborne && Math.random() < dt * 0.9) {
    gravRings.push({ x, y: y - 22, r: 46, life: 1 });
    if (kick) kick(1.4);
  }
  // rex struts — a proud little bounce in every royal step
  if (lg.strut && moving && !airborne && Math.random() < dt * 1.6) {
    if (kick) kick(2.2);
    fx.push({ x: x + (Math.random() - 0.5) * 24, y: y - 44, vx: 0, vy: -16, life: 0.6, c: "#ffd75e" });
  }
}

// pal drag state (same pattern as the main pet's held/drag vars)
let palHeld = null;
let palDX = 0, palDY = 0, palVX = 0, palVY = 0;
let palLX = 0, palLY = 0, palLT = 0, palDownX = 0, palDownY = 0, palDownT = 0;
let palRevX = null;

function blobSize() {
  const scale = (1.3 + level * 0.4) * sizeMul * (isBaby(SPECIES[active]) ? 0.55 : 1);
  return { w: SW * scale, h: SH * scale, scale };
}

function petRect() {
  const { w, h } = blobSize();
  // generous padding — a moving pet is hard enough to click already
  return [petX - w / 2 - 14, petY - h - 16, w + 28, h + 32];
}

function hitTest(mx, my) {
  // parked at the ranch: the pet has no body on the desktop — without this
  // gate its last position leaves a ghost hitbox that eats prop clicks
  if (petHome) return false;
  const [x, y, w, h] = petRect();
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

function eat() {
  const now = Date.now();
  // typing feeds the wallet, not the pet: xp/gems always tick, but only
  // key-eating species react — everyone else sleeps through your work
  const kr = SPECIES[active].kr;
  if (kr) {
    // welcome back: first keystroke after 6+ idle minutes gets a heart
    if (now - lastKey > 360000) {
      contentUntil = performance.now() + 1500;
      hearts.push({ x: petX, y: petY - 70, life: 1 });
      sfx.heart();
    }
    awakeAt = now; // typing counts as waking activity for key-eaters
  }
  lastKey = now;
  xp += 1;
  if (!seen && xp >= 50) { seen = true; dirty = true; }
  const every = SPECIES[active].r >= 3 ? JELLY_EVERY / 2 : JELLY_EVERY;
  if (xp % every === 0) {
    jelly += 1;
    bangs.push({ x: petX + 20, y: petY - 80, life: 1, t: "💎" });
    starUntil = performance.now() + 900; // starry-eyed over the gem
    sfx.heart();
  }
  level = Math.min(3, Math.floor(xp / KEYS_PER_LEVEL));
  dirty = true;
  if (!kr) return;
  munchUntil = performance.now() + 150;
  // companions nibble along — only species that also eat keys
  for (const p of pals) {
    if (SPECIES[p.sp].kr) { p.faceId = "munch"; p.faceT = performance.now() + 150; }
  }
  if (now > lastMunchSfx + 600) { lastMunchSfx = now; sfx.munch(); }
  if (state !== "idle") state = "idle";
  if (Math.random() < 0.35 && crumbs.length < 12) {
    crumbs.push({ x: petX + (Math.random() * 60 - 30), y: petY - 80, vy: 0, life: 1 });
  }
}

listen("keystroke", eat);
listen("summon", () => recall());

// clipboard mischief: the backend spots Ctrl+C/X/V combos (combo only —
// never the content). the pet perks up like it noticed you pocketing
// something. throttled so rapid copy-paste doesn't make it twitchy.
let copyCd = 0;
function copyPeek(intense) {
  const now = performance.now();
  if (now < copyCd || petHome || held) return;
  copyCd = now + (intense ? 6000 : 8000);
  // the perk is always visible — the ? pops even mid-flight; the look and
  // the investigative hop only apply when it's actually standing around
  shockUntil = now + (intense ? 700 : 450);
  bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.3, t: intense ? "!?" : "?" });
  if (!flying && !sigT0 && state !== "sleeping" && Date.now() > cushionNapW) {
    lookDir = Math.sign(curX - petX) || 1;
    lookUntil = now + 1100;
    // close enough to see? a little investigative hop toward the cursor
    if (Math.abs(curX - petX) < 320 && Math.abs(curY - petY) < 200 && Math.random() < (intense ? 0.45 : 0.25)) {
      flying = true; petVY = -170; petVX = Math.sign(curX - petX) * 70;
    }
  }
  // the nearest pal notices too — nosy is contagious
  let np = null, nd = 340;
  for (const p of pals) {
    const d = Math.hypot(curX - p.x, curY - p.y);
    if (d < nd && !p.fly && now > (p.faceT || 0)) { nd = d; np = p; }
  }
  if (np) {
    np.faceId = "shock"; np.faceT = now + 700;
    np.lookDir = Math.sign(curX - np.x) || 1; np.lookUntil = now + 900;
    bangs.push({ x: np.x, y: np.y - 62, life: 0.8, t: "?" });
  }
  sfx.pop();
}
// count raw clipboard events into crash.log so "did the combo even
// reach the app?" is answerable without guessing — first 20 only
let copyEvts = 0;
const copyLog = (k) => { copyEvts++; if (copyEvts <= 20) invoke("log_crash", { msg: `clip-${k}#${copyEvts}` }); };
listen("copy", () => { copyLog("copy"); copyPeek(true); });
listen("paste", () => { copyLog("paste"); copyPeek(false); });

// ---------- accessory routines ----------
// the doodad occasionally inspires its own little act — a propeller flyby
// past the window tops, a monocle inspection of whatever you're doing,
// a mustache strut. rare (minutes apart), gentle, always interruptible.
let accAct = null;       // {id, t0, step, tx, ty, until} — pet's routine
let accActNext = 50000;  // first chance ~50s in
let propSpin = 0;        // propeller blade speed (rad/s), 0 = parked
const ACC_ACTS = {
  prop: 130000, monocle: 90000, stache: 100000, phones: 100000,
  halo: 120000, antenna: 110000, leaf: 120000, scarf: 120000,
  shades: 120000, crown: 150000, tiara: 150000, wiz: 150000,
  flower: 140000, horns: 140000, party: 150000, specs: 140000,
  mohawk: 150000, wings: 130000,
};
// timed step scripts for the stationary routines: [ms, fn] pairs, run in
// order by the frame loop — anything grabbing the pet aborts mid-script
const ACC_RUNS = {
  inspect: [ // monocle/specs: stops, peers at what you're doing, verdict
    [0, () => { lookDir = Math.sign(curX - petX) || 1; lookUntil = performance.now() + 2600; }],
    [1400, () => bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.4, t: "HMM..." })],
    [2000, () => fx.push({ x: petX + lookDir * 13, y: petY - 42, vx: 0, vy: -18, life: 0.7, c: "#ffffff", spr: "star5" })],
    [2800, () => { smugUntil = performance.now() + 1500; }],
    [3000, () => {}],
  ],
  strut: [ // stache: a proud little twirl-hop, then smug
    [0, () => { flying = true; petVY = -150; spinT0 = performance.now(); smugUntil = performance.now() + 2600; }],
    [700, () => bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1.1, t: "HMPH!" })],
    [1200, () => fx.push({ x: petX + 14, y: petY - 46, vx: 0, vy: -16, life: 0.7, c: "#ffd75e", spr: "star5" })],
    [1600, () => {}],
  ],
  jam: [ // phones/mohawk: head-bobbing to music only it hears
    [0, () => { contentUntil = performance.now() + 3200; }],
    [350, () => { squashV += 1.8; bangs.push({ x: petX + 16, y: petY - 60, life: 0.8, t: "♪" }); }],
    [950, () => { squashV += 1.8; bangs.push({ x: petX - 22, y: petY - 64, life: 0.8, t: "♫" }); }],
    [1550, () => { squashV += 2.2; bangs.push({ x: petX + 18, y: petY - 64, life: 0.8, t: "♪" }); }],
    [2400, () => {}],
  ],
  bless: [ // halo: rises a touch, warm glow, nearby pals get happy
    [0, () => { flying = true; petVY = -140; for (let i = 0; i < 6; i++) fx.push({ x: petX + (Math.random() - 0.5) * 34, y: petY - 40 - Math.random() * 22, vx: 0, vy: -14, life: 0.9, c: "#ffe9a0" }); }],
    [600, () => hearts.push({ x: petX, y: petY - 62, life: 1.1 })],
    [900, () => { for (const p of pals) { if (Math.abs(p.x - petX) < 220 && Math.abs(p.y - petY) < 60) { p.faceId = "love"; p.faceT = performance.now() + 1600; } } }],
    [1500, () => {}],
  ],
  signal: [ // antenna: freezes stock-still, then — a transmission!
    [0, () => { shockUntil = performance.now() + 700; }],
    [800, () => { for (let i = 0; i < 3; i++) fx.push({ x: petX, y: petY - blobSize().h - 16 - i * 8, vx: 0, vy: -30, life: 0.5, c: "#5ac8f0" }); }],
    [1500, () => { bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "!" }); lookDir = Math.sign(curX - petX) || 1; lookUntil = performance.now() + 1400; }],
    [2100, () => {}],
  ],
  bask: [ // leaf: sits and quietly photosynthesizes
    [0, () => { sitUntil = performance.now() + 3000; contentUntil = performance.now() + 3000; }],
    [1200, () => fx.push({ x: petX + 6, y: petY - 52, vx: 0, vy: -10, life: 0.9, c: "#9ed97a" })],
    [2400, () => fx.push({ x: petX - 8, y: petY - 50, vx: 0, vy: -10, life: 0.9, c: "#9ed97a" })],
    [3200, () => {}],
  ],
  hero: [ // scarf: turns to face the wind, fabric dramatically aflutter
    [0, () => { lookDir = -lookDir; lookUntil = performance.now() + 2200; smugUntil = performance.now() + 2400; }],
    [300, () => fx.push({ x: petX - lookDir * 18, y: petY - 34, vx: -lookDir * 46, vy: -8, life: 0.6, c: "#e8dcc8" })],
    [800, () => fx.push({ x: petX - lookDir * 20, y: petY - 30, vx: -lookDir * 52, vy: -10, life: 0.6, c: "#e8dcc8" })],
    [1500, () => bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "..." })],
    [2200, () => {}],
  ],
  cool: [ // shades: a low slide-hop like it owns the place
    [0, () => { smugUntil = performance.now() + 2600; flying = true; petVY = -60; petVX = lookDir * 55; }],
    [900, () => fx.push({ x: petX + 10, y: petY - 44, vx: 0, vy: -14, life: 0.6, c: "#ffffff", spr: "star5" })],
    [1600, () => {}],
  ],
  royal: [ // crown/tiara: a regal nod to the subject (you)
    [0, () => { lookDir = Math.sign(curX - petX) || 1; lookUntil = performance.now() + 2400; smugUntil = performance.now() + 2600; }],
    [500, () => { squashV += 3; }],
    [900, () => fx.push({ x: petX, y: petY - blobSize().h - 12, vx: 0, vy: -16, life: 0.9, c: "#ffd75e", spr: "star5" })],
    [1200, () => { for (const p of pals) { if (Math.abs(p.x - petX) < 240) { p.lookDir = Math.sign(petX - p.x) || 1; p.lookUntil = performance.now() + 1400; } } }],
    [1800, () => {}],
  ],
  spell: [ // wizard hat: a tiny sparkle from the hat tip
    [0, () => { lookUntil = performance.now() + 1600; lookDir = 1; }],
    [600, () => { for (let i = 0; i < 7; i++) fx.push({ x: petX + (Math.random() - 0.5) * 26, y: petY - blobSize().h - 8 - Math.random() * 16, vx: (Math.random() - 0.5) * 30, vy: -16 - Math.random() * 20, life: 0.8, c: "#b89af0" }); }],
    [1300, () => bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "✦" })],
    [1900, () => {}],
  ],
  sniff: [ // flower: sniff sniff… ACHOO — a pollen sneeze hop
    [0, () => { squashV += 1.5; lookDir = -lookDir; lookUntil = performance.now() + 900; }],
    [800, () => { squashV += 1.5; }],
    [1500, () => { flying = true; petVY = -130; bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "ACHOO!" }); for (let i = 0; i < 5; i++) fx.push({ x: petX + (Math.random() - 0.5) * 20, y: petY - 44, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 30, life: 0.7, c: "#ffe9a0" }); }],
    [2200, () => {}],
  ],
  stamp: [ // horns: two little stamps, then satisfied
    [0, () => { squashV += 3; fx.push({ x: petX - 14, y: petY - 4, vx: -26, vy: -18, life: 0.4, c: "#c8b8a0" }); }],
    [500, () => { squashV += 3; fx.push({ x: petX + 14, y: petY - 4, vx: 26, vy: -18, life: 0.4, c: "#c8b8a0" }); sfx.pop(); }],
    [1100, () => { smugUntil = performance.now() + 1800; }],
    [1600, () => {}],
  ],
  party: [ // party hat: confetti pop + a celebratory hop
    [0, () => { flying = true; petVY = -170; for (let i = 0; i < 10; i++) fx.push({ x: petX, y: petY - 46, vx: (Math.random() - 0.5) * 140, vy: -50 - Math.random() * 90, life: 0.9, c: ["#e05a6e", "#5ac8f0", "#ffd75e"][i % 3] }); }],
    [400, () => { bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "♪" }); contentUntil = performance.now() + 2000; }],
    [1200, () => {}],
  ],
  flutter: [ // wings: one graceful floaty hop
    [0, () => { flying = true; petVY = -300; contentUntil = performance.now() + 1500; }],
    [500, () => { for (let i = 0; i < 4; i++) fx.push({ x: petX - lookDir * 12 + (Math.random() - 0.5) * 16, y: petY - 36, vx: -lookDir * 20, vy: 12, life: 0.7, c: "#eef4ff" }); }],
    [1100, () => {}],
  ],
};
const ACC_RUN_ID = { monocle: "inspect", specs: "inspect", stache: "strut", phones: "jam", mohawk: "jam",
  halo: "bless", antenna: "signal", leaf: "bask", scarf: "hero", shades: "cool",
  crown: "royal", tiara: "royal", wiz: "spell", flower: "sniff", horns: "stamp",
  party: "party", wings: "flutter" };
// pals get the same idea in miniature — one or two timed beats each, no
// choreography. propeller pals even take a little hop of their own
const PAL_ACC_BITS = {
  monocle: [[0, (p) => { p.lookDir = Math.sign(curX - p.x) || 1; p.lookUntil = performance.now() + 2000; }], [1200, (p) => bangs.push({ x: p.x, y: p.y - 64, life: 1, t: "..." })]],
  specs: [[0, (p) => { p.lookDir = Math.sign(curX - p.x) || 1; p.lookUntil = performance.now() + 1600; }], [900, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 1200; }]],
  stache: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 2000; p.squashV += 2; }], [600, (p) => { p.fly = true; p.vy = -110; p.vx = p.lookDir * 40; }]],
  phones: [[0, (p) => { p.faceId = "happy"; p.faceT = performance.now() + 2400; }], [400, (p) => { bangs.push({ x: p.x, y: p.y - 64, life: 0.8, t: "♪" }); p.squashV += 1.5; }], [1100, (p) => { bangs.push({ x: p.x, y: p.y - 64, life: 0.8, t: "♫" }); p.squashV += 1.5; }]],
  halo: [[0, (p) => { for (let i = 0; i < 5; i++) fx.push({ x: p.x + (Math.random() - 0.5) * 28, y: p.y - 40 - Math.random() * 18, vx: 0, vy: -14, life: 0.8, c: "#ffe9a0" }); hearts.push({ x: p.x, y: p.y - 56, life: 1 }); }]],
  antenna: [[0, (p) => { p.faceId = "shock"; p.faceT = performance.now() + 900; }], [700, (p) => bangs.push({ x: p.x, y: p.y - 64, life: 0.9, t: "!" })]],
  leaf: [[0, (p) => { p.faceId = "content"; p.faceT = performance.now() + 2600; }]],
  scarf: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 1800; p.lookDir = -p.lookDir; }]],
  shades: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 2200; }]],
  crown: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 1800; fx.push({ x: p.x, y: p.y - 54, vx: 0, vy: -14, life: 0.8, c: "#ffd75e", spr: "star5" }); }]],
  tiara: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 1800; fx.push({ x: p.x, y: p.y - 54, vx: 0, vy: -14, life: 0.8, c: "#ffd75e", spr: "star5" }); }]],
  wiz: [[0, (p) => { for (let i = 0; i < 6; i++) fx.push({ x: p.x + (Math.random() - 0.5) * 22, y: p.y - 48 - Math.random() * 14, vx: (Math.random() - 0.5) * 30, vy: -18 - Math.random() * 18, life: 0.7, c: "#b89af0" }); }]],
  flower: [[0, (p) => { p.squashV += 1.5; }], [800, (p) => { bangs.push({ x: p.x, y: p.y - 64, life: 0.9, t: "ACHOO" }); p.fly = true; p.vy = -100; p.vx = (Math.random() - 0.5) * 60; }]],
  horns: [[0, (p) => { p.squashV += 2.5; fx.push({ x: p.x - 12, y: p.y - 4, vx: -22, vy: -16, life: 0.4, c: "#c8b8a0" }); }], [450, (p) => { p.squashV += 2.5; fx.push({ x: p.x + 12, y: p.y - 4, vx: 22, vy: -16, life: 0.4, c: "#c8b8a0" }); }]],
  party: [[0, (p) => { p.faceId = "happy"; p.faceT = performance.now() + 2000; for (let i = 0; i < 8; i++) fx.push({ x: p.x, y: p.y - 42, vx: (Math.random() - 0.5) * 120, vy: -50 - Math.random() * 70, life: 0.8, c: ["#e05a6e", "#5ac8f0", "#ffd75e"][i % 3] }); }]],
  wings: [[0, (p) => { p.fly = true; p.vy = -240; p.vx = (Math.random() - 0.5) * 80; }]],
  prop: [[0, (p) => { p.fly = true; p.vy = -280; p.vx = (Math.random() - 0.5) * 120; p.faceId = "happy"; p.faceT = performance.now() + 1200; }]],
  mohawk: [[0, (p) => { p.faceId = "happy"; p.faceT = performance.now() + 2200; }], [400, (p) => { bangs.push({ x: p.x, y: p.y - 64, life: 0.8, t: "♪" }); p.squashV += 1.5; }], [1100, (p) => { bangs.push({ x: p.x, y: p.y - 64, life: 0.8, t: "♫" }); p.squashV += 1.5; }]],
  bow: [[0, (p) => { p.lookDir = -p.lookDir; p.squashV += 1.5; }], [700, (p) => { p.fly = true; p.vy = -90; p.faceId = "happy"; p.faceT = performance.now() + 800; }]],
  ribbon: [[0, (p) => { p.lookDir = -p.lookDir; p.squashV += 1.5; }], [700, (p) => { p.fly = true; p.vy = -90; p.faceId = "happy"; p.faceT = performance.now() + 800; }]],
  patch: [[0, (p) => { p.lookDir = Math.sign(curX - p.x) || 1; p.lookUntil = performance.now() + 1500; p.faceId = "smug"; p.faceT = performance.now() + 1800; }]],
  pumpkin: [[0, (p) => { p.fly = true; p.vy = -120; p.faceId = "happy"; p.faceT = performance.now() + 1000; }]],
  santa: [[0, (p) => { p.faceId = "happy"; p.faceT = performance.now() + 2000; for (let i = 0; i < 4; i++) fx.push({ x: p.x + (Math.random() - 0.5) * 24, y: p.y - 44 - i * 6, vx: 0, vy: -14, life: 0.7, c: "#f0f4ff" }); }]],
  cap: [[0, (p) => { p.lookDir = Math.sign(curX - p.x) || 1; p.lookUntil = performance.now() + 1200; p.squashV += 1.5; }]],
  beanie: [[0, (p) => { p.faceId = "content"; p.faceT = performance.now() + 2000; }]],
  beret: [[0, (p) => { p.faceId = "smug"; p.faceT = performance.now() + 1800; p.lookDir = -p.lookDir; }]],
  tophat: [[0, (p) => { p.squashV += 2.5; p.faceId = "smug"; p.faceT = performance.now() + 1800; }]],
  band: [[0, (p) => { p.faceId = "happy"; p.faceT = performance.now() + 1800; p.squashV += 1.5; }]],
  clip: [[0, (p) => { p.lookDir = -p.lookDir; p.squashV += 1; }]],
};
// bits that launch their own little hop — landing doesn't abort them
const PAL_FLY_BITS = { prop: 1, stache: 1, flower: 1, wings: 1, bow: 1, ribbon: 1, pumpkin: 1 };
function startAccAct(run, now) {
  accAct = { id: run, t0: now, step: 0 };
  walkTarget = null; walkGoal = null; hopTarget = null;
  if (run === "flyby") {
    // pick a window top to buzz — the propeller earns its keep
    const wins = plats.filter((p) => p.y > 80 && p.y < petY - 60 && p.w > 120);
    const tgt = wins.length ? wins[(Math.random() * wins.length) | 0]
                            : { x: petX + (petX < winW / 2 ? 300 : -300), y: Math.max(120, petY - 320), w: 200 };
    accAct.tx = tgt.x + tgt.w / 2;
    accAct.ty = Math.max(70, tgt.y - 48);
    accAct.until = now + 6000;
    flying = true; petVY = -60;
    bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "♪" });
    sfx.boing();
  }
}

// ---------- platforms ----------
listen("platforms", (e) => {
  plats = [...monPlats];
  for (const [x, y, w] of e.payload) {
    // ignore the topmost screen strip so thrown slimes always come back down
    if (y > 60) plats.push({ x, y, w });
  }
  if (!held && !flying && !climbing) {
    const sup = plats.find(
      (p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14
    );
    if (sup) petY = sup.y;
    else {
      flying = true; petVY = 0;
      // the window it was surfing just closed — a startled drop, not a
      // quiet slide: shock face + flail on the way down, dazed landing
      if (!petHome) {
        startleFall = true;
        shockUntil = performance.now() + 1400;
        bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "!" });
        sfx.shock();
      }
    }
  }
});

// ---------- cursor tracking (from backend) ----------
listen("cursor", (e) => {
  const [x, y] = e.payload;
  const now = performance.now();
  if (lastCurT > 0) {
    const dt = Math.max(1, now - lastCurT);
    curV = Math.hypot(x - lastCurX, y - lastCurY) / dt * 1000;
    curVX = (x - lastCurX) / dt * 1000;
  }
  lastCurX = x; lastCurY = y; lastCurT = now;
  if (Math.hypot(x - curX, y - curY) > 2) lastCurMove = now;
  curX = x; curY = y;
});

// focused-window [title, exe] from the backend (2s poll) — mood biases by
// app kind: editors = calm focus, media/games = playful energy
listen("focus", (e) => {
  const p = e.payload;
  focusTitle = String(Array.isArray(p) ? p[0] : p || "").toLowerCase();
  focusExe = String(Array.isArray(p) ? p[1] : p || "").toLowerCase();
});
function focusKind() {
  // media shows up in titles first (youtube in a chrome window is still media)
  if (/youtube|twitch|netflix|vlc|player|spotify|music|video/.test(focusTitle)) return "media";
  if (/vlc|mpv|spotify|musicbee|foobar2000|itunes/.test(focusExe)) return "media";
  if (/code|devenv|vim|nvim|emacs|windowsterminal|powershell|idea64|pycharm64|sublime_text|rider64|zed|notepad|cursor|wezterm|alacritty|vscode/.test(focusExe)) return "editor";
  if (/code|studio|vim|neovim|emacs|terminal|powershell|intellij|pycharm|sublime|rider|zed|notepad|cursor/.test(focusTitle)) return "editor";
  if (/chrome|msedge|firefox|brave|opera|arc|iexplore/.test(focusExe)) return "browser";
  if (/youtube|twitch|netflix|video/.test(focusTitle)) return "media";
  if (/steam|game|league|valorant|minecraft|elden|dota|fortnite|overwatch|genshin|hoyo|steamwebhelper/.test(focusExe + " " + focusTitle)) return "game";
  return "other";
}

// ---------- mouse ----------
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function recall() {
  touch();
  if (petHome) bringPetHome(); // parked at the ranch — summon wakes it up
  held = false;
  flying = true;
  startleFall = false;
  climbing = false;
  climbPhase = 0;
  walkTarget = null;
  hopTarget = null;
  snack = null;
  treat = null;
  treatFly = null;
  treatAim = false;
  webbing = false;
  webHeld = false;
  sigT0 = 0;
  sigId = null;
  accAct = null;
  propSpin = 0;
  danceT0 = 0;
  sitUntil = 0;
  spinT0 = 0;
  stretchUntil = 0;
  petX = Math.max(70, Math.min(winW - 70, curX > -9000 ? curX : winW / 2));
  petY = 70;
  petVX = 0;
  petVY = 90;
  // companions come along too — drops them beside the pet
  pals.forEach((p, i) => {
    p.x = Math.max(50, Math.min(winW - 50, petX + [120, -120, 180][i] || -180));
    p.y = 60;
    p.vx = 0;
    p.vy = 120;
    p.fly = true;
    p.plat = null;
    p.stackOn = null;
    p.walkT = null;
    p.tag = null;
  });
  shockUntil = performance.now() + 350;
  for (let i = 0; i < 10; i++) {
    fx.push({ x: petX + Math.random() * 36 - 18, y: petY + Math.random() * 24 - 12, vx: Math.random() * 90 - 45, vy: Math.random() * 60 - 40, life: 0.7, c: "#ffffff" });
  }
  sfx.shock();
  dirty = true;
}

cv.addEventListener("pointerdown", (e) => {
  ac();
  lastUiTap = Date.now();
  const [mx, my] = canvasPos(e);
  if (e.button === 2) {
    // right-click the snack item cycles the treat kind; right-clicking
    // a slime opens its status card (handled in contextmenu)
    if (fabOpen) {
      const [ix, iy, iw, ih] = fabItemRect(1);
      if (mx >= ix && mx <= ix + iw && my >= iy && my <= iy + ih) {
        treatKind = (treatKind + 1) % TREATS.length;
        dirty = true;
        sfx.pop();
        return;
      }
    }
    treatAim = false;
    return;
  }
  if (e.button !== 0) return;
  if (redeemMode) return;   // code entry is keyboard-only; clicks are swallowed
  // bestiary card is modal: any click dismisses it before anything else runs
  if (infoPick !== null) { infoPick = null; return; }
  // album overlay: nav arrows, folder link, X, or click-outside to close.
  // normally the #info overlay owns these clicks — this is the fallback
  if (albumOpen) { albumClick(mx, my); return; }
  // away-report panel: click it to dismiss early
  if (awayReport && Math.abs(mx - winW / 2) < 95 && my >= 54 && my <= 132) { awayReport = null; return; }
  // gem shop modal: BUY opens the itch page, REDEEM swaps to the code modal
  if (gemShop) {
    const [gx, gy, gw, gh] = gemShopRect();
    const rows = gemShopRows();
    const inR = (R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3];
    const packIds = Object.keys(GEM_PACKS);
    for (let i = 0; i < packIds.length; i++) {
      if (inR(packBuyRect(i))) {
        const u = packUrl(packIds[i]);
        if (u) invoke("open_url", { url: u }).catch(() => {});
        else bangs.push({ x: winW / 2, y: 100, life: 1.6, t: "STORE LINK TBD" });
        sfx.pop();
        return;
      }
    }
    if (inR(rows[0])) {
      if (GEM_SHOP_URL) invoke("open_url", { url: GEM_SHOP_URL }).catch(() => {});
      else bangs.push({ x: winW / 2, y: 100, life: 1.6, t: "STORE LINK TBD" });
      sfx.pop();
    } else if (inR(rows[1])) {
      gemShop = false;
      redeemMode = true;
      redeemBuf = "";
      sfx.pop();
    } else if (mx < gx || mx > gx + gw || my < gy || my > gy + gh) gemShop = false;
    return;
  }
  if (settingsOpen) {
    const [px, py, pw, ph] = settingsRect();
    const rows = settingsRows();
    // rows scrolled out of the viewport can't be clicked — they're not
    // drawn there either, so an invisible row must never take a hit
    const inRow = (R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3] && my >= py + SET_VIEW_TOP && my <= py + ph - SET_VIEW_BOT;
    if (inRow(rows[0])) {
      // volume slider: press anywhere on the row to set, then keep
      // dragging — the track maps x-position to 0..100%
      volDrag = { x0: rows[0][0] + 8, w: rows[0][2] - 16 };
      vol = Math.min(1, Math.max(0, (mx - volDrag.x0) / volDrag.w));
      muted = vol <= 0.001;
      volStep = Math.round((1 - vol) * 3);
      grabT0 = performance.now();
      dirty = true;
      try { cv.setPointerCapture(e.pointerId); } catch {}
      invoke("set_dragging", { on: true }).catch(() => {});
      sfx.pop();
    }
    else if (inRow(rows[1])) {
      sizeMul = SIZE_STEPS[(SIZE_STEPS.indexOf(sizeMul) + 1) % SIZE_STEPS.length];
      dirty = true;
      sfx.pop();
    } else if (inRow(rows[2])) { reduceMotion = !reduceMotion; dirty = true; sfx.pop(); }
    else if (inRow(rows[3])) {
      // photo mode: hide every UI element, snapshot the canvas to PNG;
      // the slime smiles for the camera
      settingsOpen = false;
      contentUntil = performance.now() + 2500;
      winkUntil = performance.now() + 1100; // it winks for the camera
      hearts.push({ x: petX + 20, y: petY - 80, life: 1 });
      photoHide = true;
      ranch.style.opacity = "0";
      nursery.style.opacity = "0";
      cardEl.style.opacity = "0";
      infoEl.style.opacity = "0";
      setTimeout(() => {
        const data = cv.toDataURL("image/png").split(",")[1];
        const name = `jellypal_${Date.now()}`;
        invoke("save_png", { data, name }).then(() => {
          bangs.push({ x: winW / 2, y: 100, life: 2, t: "SAVED" });
          sfx.reveal();
          // if the album was left open under the hide, fold the new
          // shot in and jump to it
          if (albumOpen) {
            albumList.push(`${name}.png`);
            albumList.sort();
            albumIdx = albumList.indexOf(`${name}.png`);
            loadAlbumImg(`${name}.png`);
          }
        }).catch(() => {});
        photoHide = false;
        ranch.style.opacity = "";
        nursery.style.opacity = "";
        cardEl.style.opacity = "";
        infoEl.style.opacity = "";
      }, 160);
    }
    else if (inRow(rows[4])) {
      // photo album: browse every PNG the photo mode has saved
      settingsOpen = false;
      openAlbum();
    }
    else if (inRow(rows[5])) {
      // pomodoro: focus sprint -> break, cycling while on
      pomo = !pomo;
      if (pomo) {
        pomoPhase = "focus";
        pomoLen = pomoFocusMin * 60000;
        pomoUntil = Date.now() + pomoLen;
        pomoHeartNext = performance.now() + 8000;
        bangs.push({ x: petX, y: petY - 100, life: 2, t: "FOCUS!" });
        sfx.reveal();
      } else sfx.pop();
      dirty = true;
    }
    else if (inRow(rows[6])) {
      pomoFocusMin = POMO_FOCI[(POMO_FOCI.indexOf(pomoFocusMin) + 1) % POMO_FOCI.length];
      if (pomo && pomoPhase === "focus") { pomoLen = pomoFocusMin * 60000; pomoUntil = Date.now() + pomoLen; }
      dirty = true; sfx.pop();
    }
    else if (inRow(rows[7])) {
      pomoBreakMin = POMO_BREAKS[(POMO_BREAKS.indexOf(pomoBreakMin) + 1) % POMO_BREAKS.length];
      if (pomo && pomoPhase === "break") { pomoLen = pomoBreakMin * 60000; pomoUntil = Date.now() + pomoLen; }
      dirty = true; sfx.pop();
    }
    else if (inRow(rows[8])) {
      // share card: render a pretty collection snapshot to the photos
      // folder — built for "look at my ranch" posts
      settingsOpen = false;
      shareCard();
      sfx.pop();
    }
    else if (inRow(rows[9])) {
      weatherOn = !weatherOn;
      if (weatherOn) pollWeather(); else { wxCode = -1; wxAt = 0; }
      dirty = true; sfx.pop();
    }
    else if (inRow(rows[10])) {
      bootOn = !bootOn;
      invoke("set_autostart", { enable: bootOn }).catch(() => {});
      dirty = true; sfx.pop();
    }
    else if (inRow(rows[11])) {
      // gem shop: pack prices + the store link + the redeem door
      settingsOpen = false;
      gemShop = true;
      sfx.pop();
    }
    else if (inRow(rows[12])) {
      // redeem a paid gem code — typed like the name editor
      settingsOpen = false;
      redeemMode = true;
      redeemBuf = "";
      sfx.pop();
    }
    else if (inRow(rows[13])) { persist(); invoke("quit_app"); }
    else if (mx < px || mx > px + pw || my < py || my > py + ph) settingsOpen = false;
    return;
  }
  // radial menu: the circle is grabbable — a press starts a potential drag,
  // the release decides click-vs-move (handled in pointerup)
  const [fbx, fby] = fabPos();
  if (Math.hypot(mx - fbx, my - fby) < 22) {
    fabDrag = { ox: mx - fbx, oy: my - fby, sx: mx, sy: my, moved: false };
    grabT0 = performance.now();
    return;
  }
  // accordion items — only while the menu is unfolded
  if (fabOpen) {
    const k = fabItemHit(mx, my);
    if (k >= 0) {
      const id = FAB_ITEMS[k];
      if (id === "recall") { fabOpen = false; recall(); }
      else if (id === "snack") { fabOpen = false; treatAim = true; }
      else if (id === "toys") toyboxOpen = !toyboxOpen; // strip hangs off this item
      else if (id === "barn") { fabOpen = false; toggleRanch(); }
      else if (id === "gear") { fabOpen = false; settingsOpen = !settingsOpen; if (settingsOpen) setScroll = 0; }
      sfx.pop();
      return;
    }
    // toybox prop strip: three slots left of the toys item — each toggles
    // its toy: ball (physics), bowl (snack spot), cushion (nap spot)
    if (toyboxOpen) {
      const [sx, sy, sw, sh] = toyboxStripRect();
      if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
        const slot = Math.max(0, Math.min(8, Math.floor((mx - sx) / 36)));
        const kind = ["ball", "bowl", "cushion", "box", "plant", "music", "mirror", "mat", "jar"][slot];
        if (kind === "ball") {
          if (ball) { for (let i = 0; i < 8; i++) fx.push({ x: ball.x + Math.random() * 20 - 10, y: ball.y - Math.random() * 12, vx: Math.random() * 60 - 30, vy: -Math.random() * 50, life: 0.5, c: "#e8dcc8" }); ball = null; }
          else ball = { x: Math.max(30, Math.min(winW - 30, petX + (petX < winW / 2 ? 70 : -70))), y: 60, vx: 0, vy: 0, r: 9, rot: 0 };
        } else {
          const cur = { bowl, cushion, box, plant, music, mirror, mat, jar }[kind];
          if (cur) {
            for (let i = 0; i < 8; i++) fx.push({ x: cur.x + Math.random() * 20 - 10, y: cur.y - Math.random() * 10, vx: Math.random() * 50 - 25, vy: -Math.random() * 40, life: 0.5, c: "#e8dcc8" });
            if (kind === "bowl") bowl = null; else if (kind === "cushion") cushion = null;
            else if (kind === "box") box = null; else if (kind === "plant") plant = null;
            else if (kind === "music") music = null; else if (kind === "mirror") mirror = null;
            else if (kind === "mat") mat = null; else jar = null;
          } else {
            const p = spawnProp();
            if (kind === "bowl") { p.fill = 3; bowl = p; }
            else if (kind === "cushion") cushion = p;
            else if (kind === "box") box = p;
            else if (kind === "plant") plant = p;
            else if (kind === "music") music = p;
            else if (kind === "mirror") mirror = p;
            else if (kind === "mat") mat = p;
            else { p.fill = 2; jar = p; }
          }
        }
        sfx.pop();
        dirty = true;
        return;
      }
      toyboxOpen = false; // clicked off the strip — fold the chooser
    }
    fabOpen = false; // clicked outside the menu — fold it up
    return;
  }
  // aimed cookie throw (runs last so UI buttons still work while aiming)
  if (treatAim) {
    treatAim = false;
    touch();
    // ballistic arc from the slime to the clicked point
    const dx = mx - petX;
    const T = Math.max(0.25, Math.abs(dx) / 480);
    treatFly = {
      x: petX, y: petY - 40,
      vx: dx / T,
      vy: (my - (petY - 40)) / T - 700 * T,
      kind: treatKind,
    };
    sfx.boing();
    return;
  }
  // furniture is grabbable: pick a prop up and set it down on any
  // deck — slimes keep using it at the new spot. a slime under the
  // cursor wins first, so a pet napping on the cushion can be picked
  // up instead of yanking the cushion out from under it
  const _grabPal = palAt(mx, my);
  const _petHit = hitTest(mx, my);
  if (!propHeld && !_grabPal && !_petHit) {
    for (const [kind, q, rad, oy] of [["bowl", bowl, 30, 13], ["cushion", cushion, 34, 14], ["box", box, 36, 14], ["plant", plant, 28, 17], ["music", music, 30, 12], ["mirror", mirror, 26, 18], ["mat", mat, 32, 14], ["jar", jar, 24, 15]]) {
      if (q && Math.hypot(mx - q.x, my - (q.y - oy)) < rad) {
        propHeld = kind;
        propGrabX = mx; propGrabY = my;
        grabT0 = performance.now();
        touch();
        cv.setPointerCapture(e.pointerId);
        cv.style.cursor = "grabbing";
        invoke("set_dragging", { on: true });
        return;
      }
    }
  }
  // the ball is grabbable too — drag and release to toss it to them
  if (ball && Math.hypot(mx - ball.x, my - (ball.y - ball.r)) < ball.r + 12) {
    ballHeld = true;
    grabT0 = performance.now();
    touch();
    ballDX = mx - ball.x; ballDY = my - ball.y;
    ballLX = mx; ballLY = my; ballLT = e.timeStamp;
    ballVX = 0; ballVY = 0;
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = "grabbing";
    invoke("set_dragging", { on: true });
    return;
  }
  // companions are grabbable: drag to throw, tap to poke. the pet wins
  // overlaps — same-species pairs stack up and the pal stole clicks
  const grabPal = palAt(mx, my);
  if (grabPal && !hitTest(mx, my)) {
    palHeld = grabPal;
    grabT0 = performance.now();
    touch();
    grabPal.walkT = null;
    grabPal.fly = false;
    grabPal.vx = 0;
    grabPal.vy = 0;
    grabPal.stackOn = null; // grabbed out of a totem — stack breaks
    grabPal.tag = null;
    grabPal.accAct = null;
    grabPal.restUntil = 0; // grabbing wakes a cushion napper
    grabPal.hideUntil = 0; // and drags a hider out of its box
    for (const r of pals) if (r.stackOn === grabPal) r.stackOn = null;
    palDX = mx - grabPal.x;
    palDY = my - grabPal.y;
    palDownX = mx; palDownY = my; palDownT = e.timeStamp;
    palLX = mx; palLY = my; palLT = e.timeStamp;
    palVX = 0; palVY = 0;
    palRevX = mx;
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = "grabbing";
    invoke("set_dragging", { on: true });
    return;
  }
  if (!hitTest(mx, my) || petHome) return;
  held = true;
  grabT0 = performance.now();
  touch();
  flying = false;
  // grabbing a dangling webby keeps the line: tap = twirl, drag = torn free
  if (webbing) webHeld = true;
  climbing = false;
  climbPhase = 0;
  snack = null;
  sigT0 = 0;
  sigId = null;
  danceT0 = 0;
  cushionNap = 0; cushionNapW = 0; // being picked up wakes a cushion nap
  boxHide = 0; // and yanks it out of a hidey-box too
  huntT0 = 0;
  huntPounce = false;
  walkTarget = null;
  petVX = 0;
  petVY = 0;
  grabDX = mx - petX;
  grabDY = my - petY;
  downX = mx; downY = my; downT = e.timeStamp;
  lastMX = mx; lastMY = my; lastMT = e.timeStamp;
  heldSince = e.timeStamp;
  lastRevX = mx;
  dragVX = 0; dragVY = 0;
  cv.setPointerCapture(e.pointerId);
  cv.style.cursor = "grabbing";
  invoke("set_dragging", { on: true });
  // double-tap: a delighted little trick — spin + happy once released
  if (e.detail >= 2 && !sigT0) {
    if (SPECIES[active].r >= 2 && !reduceMotion) spinT0 = performance.now();
    else squashV += 6;
    contentUntil = performance.now() + 1400;
    bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 0.9, t: "♪" });
    sfx.boing();
    ignoreT = 0;
  }
});

cv.addEventListener("pointermove", (e) => {
  const [mx, my] = canvasPos(e);
  cv.style.cursor = held || palHeld || ballHeld || fabDrag ? "grabbing" : hitTest(mx, my) || palAt(mx, my) || (ball && Math.hypot(mx - ball.x, my - (ball.y - ball.r)) < ball.r + 12) ? "grab" : "default";
  const now = performance.now();

  // volume slider: follows the cursor while the settings row is held
  if (volDrag) {
    vol = Math.min(1, Math.max(0, (mx - volDrag.x0) / volDrag.w));
    muted = vol <= 0.001;
    volStep = Math.round((1 - vol) * 3);
    grabT0 = now;
    dirty = true;
    return;
  }

  // dragging the menu circle: past 6px it's a move, under it stays a click
  if (fabDrag) {
    if (!fabDrag.moved && Math.hypot(mx - fabDrag.sx, my - fabDrag.sy) > 6) fabDrag.moved = true;
    if (fabDrag.moved) {
      fabX = Math.max(24, Math.min(winW - 24, mx - fabDrag.ox));
      fabY = Math.max(24, Math.min(winH - 24, my - fabDrag.oy));
    }
    return;
  }

  // dragging the ball: it follows the cursor, velocity tracked for the toss
  if (ballHeld && ball) {
    const bdt = Math.max(1, e.timeStamp - ballLT);
    ballVX = ballVX * 0.7 + ((mx - ballLX) / bdt) * 1000 * 0.3;
    ballVY = ballVY * 0.7 + ((my - ballLY) / bdt) * 1000 * 0.3;
    ballLX = mx; ballLY = my; ballLT = e.timeStamp;
    ball.x = mx - ballDX;
    ball.y = my - ballDY;
    return;
  }

  // dragging furniture: the prop rides the cursor until it's set down
  if (propHeld) {
    const q = { bowl, cushion, box, plant, music, mirror, mat, jar }[propHeld];
    if (q) { q.x = mx; q.y = my + 10; }
    return;
  }

  // tickle: wiggle cursor over the pet without holding
  if (!held && hitTest(mx, my) && now > tickleCd) {
    const prev = wiggleBuf.length ? wiggleBuf[wiggleBuf.length - 1] : null;
    wiggleBuf.push(mx);
    while (wiggleBuf.length > 20) wiggleBuf.shift();
    if (prev !== null && Math.abs(mx - prev) > 2) {
      let rev = 0, lastDx = 0;
      for (let i = 1; i < wiggleBuf.length; i++) {
        const dx = wiggleBuf[i] - wiggleBuf[i - 1];
        if (Math.abs(dx) > 2 && Math.sign(dx) !== lastDx && lastDx !== 0) rev++;
        if (Math.abs(dx) > 2) lastDx = Math.sign(dx);
      }
      if (rev >= 3) {
        touch();
        tickleUntil = now + 1100;
        contentUntil = now + 2400;
        bondGain(SPECIES[active].id, 2);
        tickleCd = now + 1600;
        wiggleBuf.length = 0;
        squashV += 3;
        sfx.giggle();
        hearts.push({ x: petX + (Math.random() < 0.5 ? -30 : 30), y: petY - 70, life: 1 });
      }
    }
  }

  // companions tickle too — same wiggle buffer, per-pal cooldown.
  // pet wins the overlap again so a same-species pal can't steal strokes
  const ticklePal = !held && !palHeld && !hitTest(mx, my) ? palAt(mx, my) : null;
  if (ticklePal && now > (ticklePal.tickleCd || 0)) {
    const prev = wiggleBuf.length ? wiggleBuf[wiggleBuf.length - 1] : null;
    wiggleBuf.push(mx);
    while (wiggleBuf.length > 20) wiggleBuf.shift();
    if (prev !== null && Math.abs(mx - prev) > 2) {
      let rev = 0, lastDx = 0;
      for (let i = 1; i < wiggleBuf.length; i++) {
        const dx = wiggleBuf[i] - wiggleBuf[i - 1];
        if (Math.abs(dx) > 2 && Math.sign(dx) !== lastDx && lastDx !== 0) rev++;
        if (Math.abs(dx) > 2) lastDx = Math.sign(dx);
      }
      if (rev >= 3) {
        touch();
        ticklePal.faceId = "laugh";
        ticklePal.faceT = now + 1100;
        ticklePal.tickleCd = now + 1600;
        wiggleBuf.length = 0;
        ticklePal.squashV += 3;
        sfx.giggle();
        hearts.push({ x: ticklePal.x + (Math.random() < 0.5 ? -26 : 26), y: ticklePal.y - 60, life: 1 });
      }
    }
  }

  if (palHeld) {
    const pdt = Math.max(1, e.timeStamp - palLT);
    palVX = palVX * 0.7 + ((mx - palLX) / pdt) * 1000 * 0.3;
    palVY = palVY * 0.7 + ((my - palLY) / pdt) * 1000 * 0.3;
    palLX = mx; palLY = my; palLT = e.timeStamp;
    palHeld.x = mx - palDX;
    palHeld.y = my - palDY;
    palHeld.lookDir = mx > palLX + 1 ? 1 : mx < palLX - 1 ? -1 : palHeld.lookDir;
    // slow strokes while held = head pat, same as the main pet
    if (e.timeStamp - palDownT > 700 && Math.hypot(palVX, palVY) < 320) {
      if (palRevX !== null && Math.sign(mx - palRevX) !== 0 && Math.abs(mx - palRevX) > 18) {
        palRevX = mx;
        touch();
        palHeld.faceId = Math.random() < 0.4 ? "love" : "happy";
        palHeld.faceT = now + 1000;
        if (hearts.length < 8) {
          hearts.push({ x: palHeld.x + (Math.random() * 40 - 20), y: palHeld.y - 70, life: 1 });
        }
        // jealousy: another grounded pal sulks and trudges over for its turn
        for (const j of pals) {
          if (j !== palHeld && !j.fly && !j.stackOn && Math.random() < 0.3) {
            j.walkT = palHeld.x + (j.x < palHeld.x ? -50 : 50);
            j.faceId = Math.random() < 0.65 ? "pout" : "grumpy"; // sulks more than it rages
            j.faceT = now + 1100;
          }
        }
      }
    }
    return;
  }
  if (!held) return;
  const dt = Math.max(1, e.timeStamp - lastMT);
  dragVX = dragVX * 0.7 + ((mx - lastMX) / dt) * 1000 * 0.3;
  dragVY = dragVY * 0.7 + ((my - lastMY) / dt) * 1000 * 0.3;
  lastMX = mx; lastMY = my; lastMT = e.timeStamp;
  // fast pulls stretch the jelly — decays so release can check how far it went
  const pull = Math.min(0.45, Math.hypot(dragVX, dragVY) / 1400);
  if (pull > heldStretch) { heldStretch = pull; heldStretchAng = Math.atan2(dragVY, dragVX); }

  // pet: while held, slow strokes with direction reversals = head pat.
  // a good pat leaves the slime content for a while after release
  const strokeV = Math.hypot(dragVX, dragVY);
  if (e.timeStamp - heldSince > 700 && strokeV < 320) {
    if (lastRevX !== null && Math.sign(mx - lastRevX) !== 0 && Math.abs(mx - lastRevX) > 18) {
      lastRevX = mx;
      touch();
      petUntil = performance.now() + 900;
      contentUntil = performance.now() + 1700;
      bondGain(SPECIES[active].id, 2);
      if (hearts.length < 8) {
        hearts.push({ x: petX + (Math.random() * 40 - 20), y: petY - 80, life: 1 });
      }
    }
  }
  // fast ruffling strokes read as tickle-play, not comfort — the slime
  // squirms and laughs instead of purring. roughhousing has a place too
  else if (e.timeStamp - heldSince > 700 && strokeV > 700) {
    if (lastRevX !== null && Math.abs(mx - lastRevX) > 26 && Math.sign(mx - lastRevX) !== 0) {
      lastRevX = mx;
      touch();
      tickleUntil = performance.now() + 550;
      squashV += 3;
      if (Math.random() < 0.4) sfx.pop();
    }
  }
});

cv.addEventListener("pointerup", (e) => {
  // volume slider release
  if (volDrag) {
    volDrag = null;
    dirty = true;
    invoke("set_dragging", { on: false }).catch(() => {});
    return;
  }
  // menu circle release: a still press toggles the accordion, a moved
  // one just parked the menu somewhere nicer
  if (fabDrag) {
    if (fabDrag.moved) { dirty = true; }
    else { fabOpen = !fabOpen; sfx.pop(); }
    fabDrag = null;
    cv.style.cursor = "default";
    return;
  }
  if (propHeld) {
    const [mx, my] = canvasPos(e);
    const kind = propHeld;
    const q = { bowl, cushion, box, plant, music, mirror, mat, jar }[kind];
    propHeld = null;
    cv.style.cursor = "default";
    invoke("set_dragging", { on: false });
    // a tap that didn't go anywhere isn't a move — it's a poke at the
    // furniture: refill the kibble, fluff the pillow
    if (q && Math.hypot(mx - propGrabX, my - propGrabY) < 10) { propTap(kind, q); return; }
    if (q) {
      // settle onto the deck under the drop point — like the ball landing
      let best = null, bs = 1e9;
      for (const pl of plats) {
        if (mx < pl.x - 10 || mx > pl.x + pl.w + 10) continue;
        const dy = pl.y - my;
        if (dy > -40 && Math.abs(dy) < bs) { bs = Math.abs(dy); best = pl; }
      }
      if (!best) { // no deck below — nearest platform it can stand on
        for (const pl of plats) {
          const sc = Math.abs(pl.y - my) + Math.max(0, pl.x - mx, mx - (pl.x + pl.w));
          if (sc < bs) { bs = sc; best = pl; }
        }
      }
      if (best) {
        q.plat = best;
        q.y = best.y;
        q.x = Math.max(best.x + 26, Math.min(best.x + best.w - 26, mx));
      }
      for (let i = 0; i < 5; i++) fx.push({ x: q.x + Math.random() * 20 - 10, y: q.y - Math.random() * 8, vx: Math.random() * 50 - 25, vy: -Math.random() * 40, life: 0.4, c: "#c8b8a0" });
      sfx.pop();
      dirty = true;
    }
    return;
  }
  if (ballHeld) {
    ballHeld = false;
    cv.style.cursor = "default";
    invoke("set_dragging", { on: false });
    if (ball) {
      const bs = Math.hypot(ballVX, ballVY);
      if (bs > 350) { ball.vx = ballVX * 0.75; ball.vy = Math.min(ballVY * 0.75, 0) - 80; }
      else { ball.vx = ballVX * 0.4; ball.vy = ballVY * 0.4; }
      sfx.boing();
    }
    return;
  }
  if (palHeld) {
    const p = palHeld;
    palHeld = null;
    invoke("set_dragging", { on: false });
    const [mx, my] = canvasPos(e);
    // dropped into the HOME slot at the top of the screen: back to the ranch.
    // requires a gentle release — a fling passing through the strip doesn't count
    if (my <= 50 && Math.abs(mx - winW / 2) <= 66 && Math.hypot(palVX, palVY) < 250) { sendPalHome(p); return; }
    if (Math.hypot(mx - palDownX, my - palDownY) < 6 && e.timeStamp - palDownT < 300) {
      // poke: squish + a face + a heart — sometimes they really love it
      p.squashV += 7;
      const pr = Math.random();
      p.faceId = pr < 0.3 ? "love" : pr < 0.5 ? "wink" : "happy";
      p.faceT = performance.now() + 1000;
      hearts.push({ x: p.x + (Math.random() * 30 - 15), y: p.y - 60, life: 1 });
      sfx.heart();
    } else {
      const spd = Math.hypot(palVX, palVY);
      p.fly = true;
      if (spd > 400) { p.vx = palVX * 0.6; p.vy = Math.min(palVY * 0.6, 0) - 120; }
      else { p.vx = 0; p.vy = 0; p.squashV += 4; }
    }
    return;
  }
  if (!held) return;
  held = false;
  if (performance.now() < petUntil) contentUntil = performance.now() + 2000;
  cv.style.cursor = "default";
  invoke("set_dragging", { on: false });
  const [mx, my] = canvasPos(e);
  // dropped into the HOME slot: the main pet goes back to its ranch
  // room — bring it out again from its cell's + button. gentle release only,
  // so an upward throw can't accidentally park it
  if (my <= 50 && Math.abs(mx - winW / 2) <= 66 && Math.hypot(dragVX, dragVY) < 250) { sendPetHome(); return; }
  const moved = Math.hypot(mx - downX, my - downY);
  // released while the silk line was held: a tap twirls it on the thread,
  // a real drag tears it free
  if (webHeld) {
    webHeld = false;
    if (moved < 6 && e.timeStamp - downT < 300) {
      const pnow2 = performance.now();
      webTwirl = pnow2 + 750;
      webAng = Math.sign(petX - curX || 1) * 0.3;
      webAngV = 0.05;
      webUntil = pnow2 + 3200;
      webT0 = pnow2; webFromX = petX; webFromY = petY;
      squashV += 4;
      sfx.pop();
      return;
    }
    webbing = false;
  }
  if (moved < 6 && e.timeStamp - downT < 300) {
    const nowD = Date.now();
    const pnowD = performance.now();
    const { h: bh2 } = blobSize();
    // double click: excited hop; epic+ adds a spin flourish
    if (nowD - lastClickT < 350) {
      lastClickT = 0;
      flying = true;
      petVY = -280;
      petVX = (Math.random() < 0.5 ? -1 : 1) * 40;
      contentUntil = pnowD + 1500;
      if (SPECIES[active].r >= 2) spinT0 = performance.now();
      hearts.push({ x: petX, y: petY - bh2 - 10, life: 1 });
      sfx.heart();
      return;
    }
    lastClickT = nowD;
    // waking a sleeper startles it
    if (state === "sleeping") {
      state = "idle";
      shockUntil = pnowD + 600;
      squashV += 8;
      bangs.push({ x: petX + 26, y: petY - 90, life: 1, t: "!" });
      sfx.shock();
      return;
    }
    // boop the snoot: a precise tap on the face, between pat and poke
    if (Math.abs(mx - petX) < 15 && my > petY - bh2 * 0.82 && my < petY - bh2 * 0.48) {
      contentUntil = pnowD + 1400;
      squashV += 4;
      hearts.push({ x: petX + 8, y: petY - bh2 - 6, life: 1 });
      bangs.push({ x: petX - 20, y: petY - bh2 - 18, life: 1.1, t: "BOOP" });
      if (Math.random() < 0.5) winkUntil = pnowD + 900; // sometimes it winks back
      sfx.heart();
      return;
    }
    // head tap vs belly poke; legendaries answer a head pat with sparkles
    if (my < petY - bh2 * 0.55) {
      contentUntil = pnowD + 1600;
      squashV += 5;
      hearts.push({ x: petX + (Math.random() * 30 - 15), y: petY - bh2 - 8, life: 1 });
      if (SPECIES[active].r >= 3) {
        for (let i = 0; i < 6; i++) {
          fx.push({ x: petX + Math.random() * 44 - 22, y: petY - bh2 - Math.random() * 20, vx: Math.random() * 60 - 30, vy: -Math.random() * 60, life: 0.9, c: "#ffd75e" });
        }
      }
      sfx.heart();
    } else {
      squashV += 7;
      // poke combo: first two pokes earn a sulky pout, the third a real protest
      pokeStreak = pnowD - pokeLast < 1400 ? pokeStreak + 1 : 1;
      pokeLast = pnowD;
      if (pokeStreak >= 3) {
        pokeStreak = 0;
        annoyedUntil = pnowD + 3400;
        squashV += 9;
        bangs.push({ x: petX + 22, y: petY - 96, life: 1.4, t: "HEY!" });
      } else {
        poutUntil = pnowD + 1300; // sulks before it snaps
        bangs.push({ x: petX + 26, y: petY - 90, life: 1, t: "!" });
      }
      sfx.angry();
    }
    return;
  }
  const speed = Math.hypot(dragVX, dragVY);
  flying = true;
  if (speed > 400) {
    petVX = dragVX * 0.6;
    petVY = Math.min(dragVY * 0.6, 0) - 120;
  } else {
    petVY = 0;
    // let go of a stretched jelly gently -> it snaps back with a wobble
    if (heldStretch > 0.26) { squashV += heldStretch * 18; sfx.boing(); }
    else squashV += 4;
  }
  heldStretch = 0;
});

// if the OS cancels a drag mid-hold, release cleanly or clicks get swallowed
cv.addEventListener("pointercancel", () => {
  fabDrag = null;
  if (volDrag) { volDrag = null; invoke("set_dragging", { on: false }); }
  if (propHeld) { propHeld = null; invoke("set_dragging", { on: false }); }
  if (ballHeld) { ballHeld = false; invoke("set_dragging", { on: false }); }
  if (palHeld) { palHeld = null; invoke("set_dragging", { on: false }); }
  if (!held) return;
  held = false;
  heldStretch = 0;
  if (webHeld) { webHeld = false; webbing = false; }
  cv.style.cursor = "default";
  invoke("set_dragging", { on: false });
});

// ---------- pixel font (5x7) ----------
const FONT = {
  " ": [".....",".....",".....",".....",".....",".....","....."],
  "A": [".###.","#...#","#...#","#####","#...#","#...#","#...#"],
  "B": ["####.","#...#","#...#","####.","#...#","#...#","####."],
  "C": [".###.","#...#","#....","#....","#....","#...#",".###."],
  "D": ["###..","#..#.","#...#","#...#","#...#","#..#.","###.."],
  "E": ["#####","#....","#....","####.","#....","#....","#####"],
  "F": ["#####","#....","#....","####.","#....","#....","#...."],
  "G": [".###.","#...#","#....","#.###","#...#","#...#",".###."],
  "H": ["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
  "I": ["#####","..#..","..#..","..#..","..#..","..#..","#####"],
  "J": ["..###","...#.","...#.","...#.","#..#.","#..#.",".##.."],
  "K": ["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"],
  "L": ["#....","#....","#....","#....","#....","#....","#####"],
  "M": ["#...#","##.##","#.#.#","#.#.#","#...#","#...#","#...#"],
  "N": ["#...#","##..#","#.#.#","#..##","#...#","#...#","#...#"],
  "O": [".###.","#...#","#...#","#...#","#...#","#...#",".###."],
  "P": ["####.","#...#","#...#","####.","#....","#....","#...."],
  "Q": [".###.","#...#","#...#","#...#","#.#.#","#..#.",".##.#"],
  "R": ["####.","#...#","#...#","####.","#.#..","#..#.","#...#"],
  "S": [".####","#....","#....",".###.","....#","....#","####."],
  "T": ["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
  "U": ["#...#","#...#","#...#","#...#","#...#","#...#",".###."],
  "V": ["#...#","#...#","#...#","#...#","#...#",".#.#.","..#.."],
  "W": ["#...#","#...#","#...#","#.#.#","#.#.#","##.##","#...#"],
  "X": ["#...#",".#.#.","..#..","..#..","..#..",".#.#.","#...#"],
  "Y": ["#...#",".#.#.","..#..","..#..","..#..","..#..","..#.."],
  "Z": ["#####","....#","...#.","..#..",".#...","#....","#####"],
  "0": [".###.","#...#","#..##","#.#.#","##..#","#...#",".###."],
  "1": ["..#..",".##..","..#..","..#..","..#..","..#..","#####"],
  "2": [".###.","#...#","....#","..##.",".#...","#....","#####"],
  "3": ["####.","....#","....#",".###.","....#","....#","####."],
  "4": ["...#.","..##.",".#.#.","#####","...#.","...#.","...#."],
  "5": ["#####","#....","####.","....#","....#","#...#",".###."],
  "6": [".###.","#....","####.","#...#","#...#","#...#",".###."],
  "7": ["#####","....#","...#.","..#..",".#...",".#...",".#..."],
  "8": [".###.","#...#","#...#",".###.","#...#","#...#",".###."],
  "9": [".###.","#...#","#...#",".####","....#","....#",".###."],
  "?": [".###.","#...#","...#.","..#..","..#..",".....","..#.."],
  "!": ["..#..","..#..","..#..","..#..","..#..",".....","..#.."],
  "+": [".....","..#..","..#..","#####","..#..","..#..","....."],
  "-": [".....",".....",".....","#####",".....",".....","....."],
  ".": [".....",".....",".....",".....",".....","..##.","..##."],
  "(": ["...##","..#..",".#...",".#...",".#...","..#..","...##"],
  ")": ["##...","..#..","...#.","...#.","...#.","..#..","##..."],
  "=": [".....",".....","#####",".....","#####",".....","....."],
  "/": ["....#","....#","...#.","..#..",".#...","#....","#...."],
  ">": ["#....",".#...","..#..","...#.","..#..",".#...","#...."],
  "<": ["....#","...#.","..#..",".#...","..#..","...#.","....#"],
  ":": [".....","..##.","..##.",".....","..##.","..##.","....."],
  "*": [".....",".#.#.","..###","#####","..###",".#.#.","....."],
  "%": ["##..#","##.#.","...#.","..#..",".#...","#..##","#..##"],
  "_": [".....",".....",".....",".....",".....",".....","#####"],
  "'": ["..#..","..#..",".#...",".....",".....",".....","....."],
  ",": [".....",".....",".....",".....","..##.","..##.",".##.."],
};

function drawText(c, text, x, y, s, color, shadow, bold) {
  if (shadow) drawText(c, text, x + s, y + s, s, shadow);
  // bold = second pass offset one pixel right, thickening every stroke
  if (bold) drawText(c, text, x + s, y, s, color);
  c.fillStyle = color;
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "#") c.fillRect(cx + col * s, y + r * s, s, s);
      }
    }
    cx += 6 * s;
  }
  return cx;
}
function textW(text, s) { return String(text).length * 6 * s - s; }

// ---------- doodad sprites: every decorative glyph/icon is a bitmap ----------
// rendered once into tiny offscreen canvases, then blitted like the slimes.
// chars map through `pal`; `.` is transparent.
const SPR = {
  heart: { rows: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."], pal: { "#": "#ff8fb8" } },
  note: { rows: ["....##.", "...###.", "...##..", "...#...", "...#...", ".##.#..", "####...", ".##...."], pal: { "#": "#8fd4f0" } },
  star: { rows: ["...#...", "...#...", "..###..", "#######", "..###..", "...#...", "...#..."], pal: { "#": "#ffd75e" } },
  star5: { rows: ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##"], pal: { "#": "#ffd75e" } },
  gem: { rows: ["..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."], pal: { "#": "#7de8f0" } },
  bubble: { rows: ["..###..", ".#...#.", "#..#..#", "#.....#", "#.....#", ".#...#.", "..###.."], pal: { "#": "#a9d8f7" } },
  ring: { rows: [".######.", "#......#", "#......#", "#......#", "#......#", ".######."], pal: { "#": "#e8dcc8" } },
  ringv: { rows: ["..####..", ".#....#.", "#......#", "#......#", "#......#", ".#....#.", "..####.."], pal: { "#": "#8ad4f0" } },
  cross: { rows: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"], pal: { "#": "#e04f5f" } },
  gear: { rows: ["..#..#..", ".##.##..", "..###...", "#######", "..###...", ".##.##..", "..#..#.."], pal: { "#": "#8a6b4a" } },
  barn: { rows: ["....#....", "...###...", "..#####..", ".#######.", "#.#####.#", "#.#...#.#", "#.#...#.#", "#########"], pal: { "#": "#b05a3c" } },
  house: { rows: ["...#...", "..###..", ".#####.", "#######", ".#...#.", ".#.#.#.", ".#####."], pal: { "#": "#8a6b4a" } },
  cookie: { rows: [".#####.", "#######", "#o####o", "#######", "##o####", "#######", ".#####."], pal: { "#": "#d9a05e", "o": "#5c4632" } },
  cake: { rows: ["...c...", "..cfc..", ".fffff.", "fffffff", "wwwwwww", ".wwwww."], pal: { "c": "#e05a6e", "f": "#f0a0c0", "w": "#f5ead8" } },
  chili: { rows: ["....g..", "...gg..", ".####..", "######.", "######.", ".####..", "..##..."], pal: { "#": "#e03a2a", "g": "#4fbd63" } },
  coffee: { rows: ["######...", "######...", "######.#.", "######.##", "######.#.", "######...", ".####...."], pal: { "#": "#f3e6cd" } },
  file: { rows: ["#####....", "######...", "#######..", "########.", "#hhhhhh#.", "#hhhhhh#.", "#hhhhh#..", "########.", "########."], pal: { "#": "#f5f0e0", "h": "#a8a090" } },
  folder: { rows: ["####.....", "#########", "#########", "#########", "#########", "#########", "#########"], pal: { "#": "#e8c05a" } },
  leg: { rows: ["#......", "##.....", ".##....", "..##...", "...##..", "...###.", ".....##"], pal: { "#": "#3a3048" } },
  egg: { rows: ["...ooo...", "..oWWWo..", ".oWWWWWo.", "oWWsWWWWo", "oWWWWWWWo", "oWWWWsWWo", "oWWWWWWWo", ".oWWWWWo.", "..oWWWo..", "...ooo..."], pal: { "o": "#5c4632", "W": "#fff6e8", "s": "#c9a06c" } },
  eggc: { rows: ["...ooo...", "..oWWWo..", ".oWWWWWo.", "oWWsWWWWo", "okkokkkko", "oWWWWsWWo", "oWWWWWWWo", ".oWWWWWo.", "..oWWWo..", "...ooo..."], pal: { "o": "#5c4632", "W": "#fff6e8", "s": "#c9a06c", "k": "#8a6b4a" } },
  capsule: { rows: ["...ooooo...", "..oWWWRRRo.", ".oWWWWRRRRo", "oWWhWWRRRRR", "oWWWWRRRRRo", "oRRRRRRRRRR", ".oRRRRRRRRo", "..oRRRRRRo.", "...ooooo..."], pal: { "o": "#5c4632", "W": "#fff6e8", "h": "#ffffff", "R": "#e05a6e" } },
  flake: { rows: [".#.#.", "..#..", "#####", "..#..", ".#.#."], pal: { "#": "#e8f4ff" } },
  ember: { rows: ["..#..", ".###.", "#####", ".###.", "..#.."], pal: { "#": "#ff9a4a" } },
  mote: { rows: ["..#..", "..#..", "#####", "..#..", "..#.."], pal: { "#": "#ffe9a8" } },
  tri: { rows: ["#####", ".###.", "..#.."], pal: { "#": "#ffd75e" } },
  umbra: {
    rows: [
      ".....t.....",
      "....uuu....",
      "..uuuuuuu..",
      ".uuuuuuuuu.",
      "uuuuuuuuuuu",
      "..u..u..u..",
      ".....h.....",
      ".....h.....",
      ".....h.hh..",
      ".....hhhh..",
    ],
    pal: { "u": "#e05a6e", "h": "#8a6b4a", "t": "#ffd75e" },
  },
  blanket: {
    rows: [
      ".#########.",
      "#w#w#w#w#w#",
      "###########",
      "#.s.s.s.s.#",
      "###########",
    ],
    pal: { "#": "#f0a0c0", "w": "#fff6e8", "s": "#c9a06c" },
  },
  ball: {
    rows: [
      "...ooooo...",
      "..oWWWWWo..",
      ".oWWRRRWWo.",
      "oWWRRRRRWWo",
      "oWRRRRRRRWo",
      "oWRRRRRRRWo",
      "oWWRRRRRWWo",
      ".oWWRRRWWo.",
      "..oWWWWWo..",
      "...ooooo...",
    ],
    pal: { "o": "#5c4632", "W": "#fff6e8", "R": "#e05a6e" },
  },
  // prop sprites for the toybox: a kibble bowl and a nap cushion
  egg: {
    rows: [
      "..####..",
      ".######.",
      "########",
      "##o####o",
      "########",
      "o######o",
      "########",
      ".##bb##.",
      "..####..",
    ],
    pal: { "#": "#f4ead8", "o": "#d9a05b", "b": "#cbb090" },
  },
  bowl: {
    // wooden bowl, metal rim, a little heart emblem on the front
    rows: [
      "....kkkkkkkkk....",
      "..kWWWWWWWWWWWk..",
      ".okWfffffffffWko.",
      ".okffffffffffko..",
      "..okkkkkkkkkko....",
      "...oKKKKKKKKKo...",
      "...oKKhKKKhKo....",
      "....oKKhKhKo.....",
      ".....ooooooo.....",
    ],
    pal: { "o": "#8a6b4a", "k": "#d9a05e", "W": "#5c4632", "f": "#eec23f", "K": "#b97f45", "h": "#f0d0d8" },
  },
  cushion: {
    // tufted puff: piping ring, center button, tassels at the corners
    rows: [
      ".....ooooooooo.....",
      "..oPPPPPPPPPPPPPo..",
      ".oPpPPPPPPPPPPpPo.",
      "oPPPPPPPPPPPPPPPPPo",
      "oPPPPPPPPbPPPPPPPPo",
      ".oPpPPPPPPPPPPpPo.",
      "..oPPPPPPPPPPPPPo..",
      "....oPPPPPPPPPo....",
      "t....ooooooooo....t",
    ],
    pal: { "o": "#a8506e", "P": "#f0a0c0", "p": "#ffcee0", "b": "#d06088", "t": "#ffd75e" },
  },
  box: {
    // open-top cardboard box — the dark hole slimes vanish into
    rows: [
      ".bbbbbbbbbbbbbbbbbbbb.",
      "bDDDDDDDDDDDDDDDDDDDDb",
      "bDDDDDDDDDDDDDDDDDDDDb",
      "bbbbbbbbbbbbbbbbbbbbbb",
      "bbbbbbttttttttbbbbbb",
      "bbbbbbttttttttbbbbbb",
      "bbbbbbbbbbbbbbbbbbbbbb",
      "bbbbbbbbbbbbbbbbbbbbbb",
      ".bbbbbbbbbbbbbbbbbbbb.",
    ],
    pal: { "b": "#b0895a", "D": "#4a3828", "t": "#d8c49a" },
  },
  plant: {
    // little potted sprout — slimes stop to sniff it
    rows: [
      "....gg..gg....",
      "...ggg..ggg...",
      "....ggg.ggg...",
      ".....ggggg....",
      ".g....ggg....g",
      "..g...ggg...g.",
      ".......s......",
      "....pppppp....",
      "...pppppppp...",
      "...pppppppp...",
      "....pppppp....",
    ],
    pal: { "g": "#4f9e4f", "s": "#3a7a3f", "p": "#b06a4a" },
  },
  music: {
    // wind-up music box — key slits on top, base trim
    rows: [
      "...wwwwwwwwww...",
      "..wkkskkskkskw..",
      "..wwwwwwwwwwww..",
      ".wwwwwwwwwwwwww.",
      ".wkkkkkkkkkkkkw.",
      ".wwwwwwwwwwwwww.",
      ".wwwwwwwwwwwwww.",
      "..oooooooooooo..",
    ],
    pal: { "w": "#c9a06c", "k": "#5c4632", "s": "#ffd75e", "o": "#8a6b4a" },
  },
  mirror: {
    // standing vanity mirror — pale glass with a diagonal shine, wooden
    // frame and a little footed stand
    rows: [
      "....oooooooo....",
      "...oMMMMMMMMMo...",
      "..oMwwswwwwwwMo..",
      "..oMwwswwwwwMo..",
      "..oMwwwswwwwMo..",
      "..oMwwwwswwwMo..",
      "..oMwwwwwswwMo..",
      "..oMMMMMMMMMMMo..",
      "...oMMMMMMMMMo...",
      "......oooo......",
      "....oooooooo....",
      "...oooooooooo...",
    ],
    pal: { "o": "#8a6b4a", "M": "#5c4632", "w": "#bfe8f4", "s": "#ffffff" },
  },
  mat: {
    // jelly bounce mat — a low green disc with stitch dots and rim piping
    rows: [
      ".....oooooooooo.....",
      "..oPPPPPPPPPPPPPPo..",
      ".oPpPpPpPpPpPpPpPo.",
      "oPPPPPPPPPPPPPPPPPPo",
      "oPpPPPPbbPPbbPPpPo",
      "oPPPPPPPPPPPPPPPPPPo",
      ".oPpPpPpPpPpPpPpPo.",
      "..oPPPPPPPPPPPPPPo..",
      ".....oooooooooo.....",
    ],
    pal: { "o": "#4a7a5a", "P": "#7ac89a", "p": "#a8e8c0", "b": "#3a6a4a" },
  },
  jar: {
    // cookie jar — glass belly with cookie lumps inside, cork lid on top
    rows: [
      ".....cccccc.....",
      "....kkkkkkkk....",
      "...kGGGGGGGGk...",
      "..kGbGGbbGGbGk..",
      "..kGGbbGGbbGGk..",
      "..kGbGGbbGGbGk..",
      "..kGGbbGGbbGGk..",
      "...kGGGGGGGGk...",
      "....kkkkkkkk....",
    ],
    pal: { "c": "#b0895a", "k": "#d8ecf4", "G": "#aee0f0", "b": "#d9a05b" },
  },
  // crack overlays drawn over the egg as hatch time nears
  crack1: {
    rows: [
      "...c.c..",
      "....c.c.",
      "...c....",
      "........",
      "........",
    ],
    pal: { "c": "#8a6b4a" },
  },
  crack2: {
    rows: [
      "...c.c..",
      "....c.c.",
      "...c..c.",
      "..c....c",
      ".c......",
      ".....c..",
    ],
    pal: { "c": "#8a6b4a" },
  },
  toys: {
    rows: [
      ".##..##.",
      "oRRooCCo",
      "oRRooCCo",
      ".oo..oo.",
    ],
    pal: { "o": "#5c4632", "R": "#e05a6e", "C": "#5ac8f0", "#": "#eec23f" },
  },
};
// wing flap frames — 3 poses, chars: m=main feather, d=dark shaft/edge,
// l=lite tip. tinted per species at cache time so Stella gets ivory and
// Drago gets maroon from the same frames
const WING_F = [
  // raised
  ["......m......", "....mmm.....", "...mmmmm....", "..mmmmmmm...", ".mmmmmmmmm..", "mmmmmmmmmmm.", "mmmddmmmddmm", "mmmdmmmmdmmm"],
  // mid
  ["............", "..m.........", ".mmm........", "mmmmmm......", "mmmmmmmm....", "mmmmmmmmmm..", "mmmddmmmddm.", "mmdmmmmmdmm."],
  // downbeat
  ["............", "............", "............", "m...........", "mm..........", "mmm.........", "mmmmm.......", "mmmmmmmm...."],
];
const sprCache = {};
function sprImg(id, tint) {
  const key = tint ? id + ":" + tint : id;
  if (sprCache[key]) return sprCache[key];
  const def = SPR[id];
  if (!def) return null;
  const w = Math.max(...def.rows.map((r) => r.length)), h = def.rows.length;
  const oc = document.createElement("canvas");
  oc.width = w; oc.height = h;
  const g = oc.getContext("2d");
  for (let y = 0; y < h; y++)
    for (let x = 0; x < def.rows[y].length; x++) {
      const col = def.pal[def.rows[y][x]];
      if (!col) continue;
      // a flat tint repaints single-color doodads (icons) — multi-palette
      // sprites keep their own colors unless tinted explicitly
      g.fillStyle = tint && Object.keys(def.pal).length === 1 ? tint : col;
      g.fillRect(x, y, 1, 1);
    }
  sprCache[key] = oc;
  return oc;
}
// wing frames are tinted at blit-time via an offscreen paint (per species color)
const wingCache = {};
function wingImg(frame, base) {
  const key = frame + ":" + base;
  if (wingCache[key]) return wingCache[key];
  const rows = WING_F[frame];
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const oc = document.createElement("canvas");
  oc.width = w; oc.height = h;
  const g = oc.getContext("2d");
  const bR = hexRgb(base);
  const dR = mixRgb(bR, hexRgb("#241b2e"), 0.4);
  const lR = mixRgb(bR, hexRgb("#ffffff"), 0.45);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      const rgb = ch === "m" ? bR : ch === "d" ? dR : ch === "l" ? lR : null;
      if (!rgb) continue;
      g.fillStyle = `rgb(${rgb.join(",")})`;
      g.fillRect(x, y, 1, 1);
    }
  wingCache[key] = oc;
  return oc;
}
// blit a doodad sprite centered on (x, y) at integer scale
function drawSpr(c, id, x, y, s, tint) {
  const img = sprImg(id, tint);
  if (!img) return;
  c.drawImage(img, Math.round(x - img.width * s / 2), Math.round(y - img.height * s / 2), img.width * s, img.height * s);
}
// glyph -> doodad id for the bang channel (✦ ♪ ♥ ★ 💎 ride as sprites)
const BANG_SPR = { "✦": "star", "♪": "note", "♫": "note", "♥": "heart", "★": "star5", "💎": "gem" };

// soft blobs are pre-rendered once and blitted scaled — still bitmaps,
// so the whole scene stays sprite-drawn even where soft edges help
let shadowCv = null;
function shadowImg() {
  if (shadowCv) return shadowCv;
  const oc = document.createElement("canvas");
  oc.width = 44; oc.height = 12;
  const g = oc.getContext("2d");
  const gr = g.createRadialGradient(22, 6, 2, 22, 6, 21);
  gr.addColorStop(0, "rgba(0,0,0,0.22)");
  gr.addColorStop(0.65, "rgba(0,0,0,0.10)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(22, 6, 21, 5.5, 0, 0, 7); g.fill();
  shadowCv = oc;
  return oc;
}
let haloCv = null;
function haloImg() {
  if (haloCv) return haloCv;
  const oc = document.createElement("canvas");
  oc.width = 48; oc.height = 16;
  const g = oc.getContext("2d");
  g.strokeStyle = "rgba(238,194,63,0.9)";
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(24, 8, 20, 5.5, 0, 0, 7); g.stroke();
  g.strokeStyle = "rgba(255,240,180,0.5)";
  g.lineWidth = 1;
  g.beginPath(); g.ellipse(24, 8, 20, 5.5, 0, 0, 7); g.stroke();
  haloCv = oc;
  return oc;
}

// ---------- ranch: everything sprite-drawn ----------
const ranch = document.getElementById("ranch");
const rc = document.getElementById("rc");
const rctx = rc.getContext("2d");
// nursery is its own floating panel — babies no longer live inside the ranch
const nursery = document.getElementById("nursery");
const nc = document.getElementById("nc");
const nctx = nc.getContext("2d");
// status card: floating live panel for a slime's mood/state/stats —
// opened by right-clicking any slime, draggable like the ranch
const cardEl = document.getElementById("card");
const kc = document.getElementById("kc");
const kctx = kc.getContext("2d");
const KW = 264, KH = 224;
kc.width = KW;
kc.height = KH;
let cardTarget = null; // "pet" | a pal object
let cardAccPg = 0;     // gear-modal page for pal cards with many doodads
let cardAccCells = []; // live hit rects, rebuilt every drawCard frame
let cardGearCell = null; // the single gear cell on a pal card — opens the modal
let cardAccModal = false; // accessory picker overlay inside the pal card
const KC_CLOSE = [KW - 26, 5, 20, 20];
// pal cards are taller — they carry the accessory gear strip
const cardKH = () => (cardTarget === "pet" ? 224 : 254);
const cardHomeR = () => [KW - 116, cardKH() - 32, 100, 22];
// bestiary card overlay: sits above every window, owns its clicks
const infoEl = document.getElementById("info");
const ic = document.getElementById("ic");
const ictx = ic.getContext("2d");
infoEl.addEventListener("pointerdown", (e) => {
  lastUiTap = Date.now();
  if (redeemMode) return; // code entry is keyboard-only; swallow the click
  if (infoPick !== null) { infoPick = null; sfx.pop(); return; }
  if (albumOpen) albumClick(e.clientX, e.clientY);
});
infoEl.addEventListener("contextmenu", (e) => e.preventDefault());
const NW = 470;
nc.width = NW;
nc.height = 120;
let nurseryOpen = false;
let infoHost = "ranch";   // which panel currently owns the bestiary card
const RW = 470;
const RH = 290;
rc.width = RW;
rc.height = RH;

const ROW_H = 104;
const PAGE_N = 12;          // 4 cols x 3 rows per page
const FOOT_H = 28;          // pager/sort/filter bar above the baseboard
// babies live in a pinned NURSERY row, not the collection grid
const babyIdx = () => SPECIES.map((s, i) => i).filter((i) => isBaby(SPECIES[i]));
// collection grid: babies excluded, then filter + sort
const SORTS = ["DEX", "RARE", "NAME"];
const FILTS = ["ALL", "OWNED", "MISS", "SHINY"];
let ranchPage = 0;
let sortMode = 0;
let filtMode = 0;
const gridIdx = () => {
  let list = SPECIES.map((s, i) => i).filter((i) => !isBaby(SPECIES[i]));
  const f = FILTS[filtMode];
  if (f === "OWNED") list = list.filter((i) => owned.includes(SPECIES[i].id));
  else if (f === "MISS") list = list.filter((i) => !owned.includes(SPECIES[i].id));
  else if (f === "SHINY") list = list.filter((i) => shinyOwned[SPECIES[i].id]);
  const s = SORTS[sortMode];
  if (s === "RARE") list = list.slice().sort((a, b) => SPECIES[b].r - SPECIES[a].r || a - b);
  else if (s === "NAME") list = list.slice().sort((a, b) => spName(SPECIES[a]).localeCompare(spName(SPECIES[b])) || a - b);
  return list;
};
// the paged list driving both grid and shop cells; seasonal accessories
// only appear while their event window is open (owned ones stay equippable)
const pageList = () => (shopMode ? ACCS.map((a, i) => i).filter((i) => !ACCS[i].season || seasonOpen(ACCS[i])) : gridIdx());
const pageCount = () => Math.max(1, Math.ceil(pageList().length / PAGE_N));
const pageItems = () => pageList().slice(ranchPage * PAGE_N, ranchPage * PAGE_N + PAGE_N);
const nurseryH = () => 0;   // nursery is a separate window now, never inline
const cellOf = (i) => ({ x: 14 + (i % 4) * 112, y: 46 + nurseryH() + Math.floor(i / 4) * ROW_H });
const PULL_R = [254, 12, 56, 22];
const BREED_R = [190, 12, 60, 22];
const SHOP_R = [316, 12, 56, 22];
const RESET_R = [376, 12, 56, 22];
const CLOSE_R = [438, 12, 18, 22];
const footY = () => rc.height - FOOT_H - 2;
const PG_L = () => [14, footY(), 20, 18];
const PG_R = () => [40, footY(), 20, 18];
const SORT_R = () => [284, footY(), 84, 18];
const FILT_R = () => [374, footY(), 84, 18];
const NURSERY_BTN = () => [146, footY(), 92, 18];
const BREED_COST = 20;
const BREED_CD = 5 * 3600 * 1000;
const ACC_COST = 300;
const slotPh = SPECIES.map(() => Math.random() * 5);
let pullAnim = null;
let breedMode = false;
let breedSel = [];
let breedReadyAt = 0;
let shopMode = false;

// player-given names + shiny (gold-tint) variants, both persisted
let customNames = {};
let shinyOwned = {};
let nameEdit = null;    // { i, buf } — ranch cell name being typed
let awayReport = null;  // offline-earnings panel { mins, gems, until }
const spName = (sp) => customNames[sp.id] || sp.name;
const SHINY_PAL = (pal) => ({ ...pal, b: "#fff2b8", l: "#fffbe8", s: "#ffe27a" });
// ranch room wall tint per slime trait
const ROOM_THEME = {
  drip: "#d8ecfa", spark: "#fbe4c8", wisp: "#e4dcf4", glint: "#f8ecd0",
  bubble: "#dcf0f4", climb: "#e8dcc8", chomp: "#f0dcd8",
  web: "#ece4f4", gravity: "#dcd4ee", royal: "#f4e4c8",
};

function fitRanch() {
  // fixed-size paged window: header + optional nursery + 3 rows + footer
  rc.height = 46 + nurseryH() + 3 * ROW_H + FOOT_H;
  ranchPage = Math.max(0, Math.min(ranchPage, pageCount() - 1));
}

rc.addEventListener("wheel", (e) => {
  e.preventDefault();
  ranchPage = Math.max(0, Math.min(ranchPage + (e.deltaY > 0 ? 1 : -1), pageCount() - 1));
  sfx.pop();
}, { passive: false });

// move-cursor affordance over the draggable title strip
rc.addEventListener("pointermove", (e) => {
  const r = rc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const onBtn = [PULL_R, BREED_R, SHOP_R, RESET_R, CLOSE_R]
    .some((R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3]);
  rc.style.cursor = my < 42 && !onBtn ? "move" : "default";
});

function bubbleIcon(c, x, y) {
  // pixel gem: light-cyan rhombus + white sparkle
  const rows = [2, 6, 10, 12, 10, 6, 2];
  c.fillStyle = "#7de8f0";
  for (let i = 0; i < rows.length; i++) c.fillRect(x - rows[i] / 2, y - 7 + i * 2, rows[i], 2);
  c.fillStyle = "#3fa8b8";
  c.fillRect(x - 1, y - 8, 2, 1);
  c.fillRect(x - 1, y + 7, 2, 1);
  c.fillRect(x - 7, y - 1, 1, 2);
  c.fillRect(x + 6, y - 1, 1, 2);
  c.fillStyle = "#ffffff";
  c.fillRect(x - 3, y - 4, 2, 2);
  c.fillRect(x + 1, y - 2, 1, 1);
}

// bestiary panel: full species card — personality, movement, trait, skill
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function seasonText(sp) {
  if (!sp.season) return "ALWAYS";
  const [a, b] = SEASONS[sp.season];
  return `${MONTHS[a[0]]} ${a[1]} - ${MONTHS[b[0]]} ${b[1]}`;
}
function drawInfo(c, W, H, t) {
  const i = infoPick;
  const sp = SPECIES[i];
  const has = owned.includes(sp.id);
  const pw = 380, ph = 296;
  const px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
  // modal: dim the whole screen behind the card
  c.fillStyle = "rgba(46, 34, 18, 0.55)";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#f7ecd7";
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = "#5c4632";
  c.lineWidth = 3;
  c.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  c.strokeStyle = RARITY_COLOR[sp.r];
  c.lineWidth = 2;
  c.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

  const nm = has ? spName(sp) : "???";
  const nx = drawText(c, nm, px + pw / 2 - textW(nm, 2) / 2, py + 14, 2, "#5c4632");
  if (has && shinyOwned[sp.id]) drawText(c, "*", nx + 5, py + 14, 2, "#eec23f", "#4a2e18");

  // sprite showcase box: trait-tinted wall + floor, like a bigger cell
  const bx = px + 18, by = py + 44, bw = 108, bh = 88;
  c.fillStyle = ROOM_THEME[sp.trait] || "#f3e6cd";
  c.fillRect(bx, by, bw, bh);
  c.strokeStyle = "#8a6b4a";
  c.lineWidth = 2;
  c.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  c.fillStyle = "#c9a06c";
  c.fillRect(bx + 2, by + bh - 18, bw - 4, 16);
  c.fillStyle = "#8a6b4a";
  c.fillRect(bx + 2, by + bh - 20, bw - 4, 2);
  const bob = Math.sin(t * 2.2) * 2;
  c.drawImage(sprite("idle", i, !has), bx + 18, by + bh - 20 - 44 + bob, 72, 50);
  if (isBaby(sp)) drawPaci(c, bx + 54, by + bh - 28, 1.2);
  // rarity pips on the box wall
  c.fillStyle = RARITY_COLOR[sp.r];
  for (let p = 0; p <= sp.r; p++) c.fillRect(bx + 7 + p * 8, by + 7, 5, 5);
  drawText(c, RARITY_NAME[sp.r], bx + bw / 2 - textW(RARITY_NAME[sp.r], 1) / 2, by + bh + 9, 1, RARITY_COLOR[sp.r], null, true);

  // stat rows: label on one line, value underneath — real gaps this time
  const sx = px + 142;
  let rowY = py + 48;
  const row = (label, val, col) => {
    drawText(c, label, sx, rowY, 1, "#a8845c");
    drawText(c, val, sx, rowY + 9, 1, col || "#3a2a18", null, true);
    rowY += 24;
  };
  const NONE = ["NONE", "#b09a78"];
  if (has) {
    row("NATURE", sp.ps ? `${sp.ps.toUpperCase()} - ${PSY_INFO[sp.ps] || ""}` : NONE[0], sp.ps ? null : NONE[1]);
    row("MOVE", sp.mv ? (MV_INFO[sp.mv] || sp.mv.toUpperCase()) : "WADDLES ABOUT");
    row("TRAIT", sp.trait ? `${sp.trait.toUpperCase()} - ${TRAIT_INFO[sp.trait] || ""}` : NONE[0], sp.trait ? null : NONE[1]);
    row("SKILL", sp.sig ? (SIG_INFO[sp.sig] || sp.sig.toUpperCase()) : NONE[0], sp.sig ? null : NONE[1]);
    row("SEASON", seasonText(sp));
    if (isBaby(sp)) {
      const left = Math.max(1, Math.ceil((BABY_MS - (Date.now() - sp.bornAt)) / 60000));
      row("BABY", `GROWS UP IN ~${left}MIN`, "#5c86b0");
    } else {
      row("SEEN", stats.pulls ? `${stats.pulls} PULLS TOTAL` : NONE[0], "#8a6b4a");
    }
    if (sp.kr) row("KEYS", sp.kr, "#2f7a9e");
  } else {
    row("RARITY", RARITY_NAME[sp.r], RARITY_COLOR[sp.r]);
    row("SEASON", seasonText(sp));
    drawText(c, "NOT COLLECTED YET", sx, rowY + 4, 1, "#a8845c");
    drawText(c, sp.season && !seasonOpen(sp) ? "COMES BACK IN SEASON" : "PULL OR BREED TO REVEAL", sx, rowY + 16, 1, "#c4a05c");
  }

  // lore line at the bottom of the card
  const fl = has ? (FLAVOR[sp.id] || FLAVOR.hyb) : "?????|?????";
  const flLines = fl.split("|");
  const flY = py + ph - 46;
  flLines.forEach((ln, k) => {
    drawText(c, `"${ln}"`, px + pw / 2 - textW(`"${ln}"`, 1) / 2, flY + k * 11, 1, "#8a6b4a");
  });
  drawText(c, "CLICK TO CLOSE", px + pw / 2 - textW("CLICK TO CLOSE", 1) / 2, py + ph - 16, 1, "#a8845c");
}

function drawRanch(ms) {
  const t = ms / 1000;
  // nursery appearing/vanishing changes the panel height on the fly
  const wantH = 46 + nurseryH() + 3 * ROW_H + FOOT_H;
  if (rc.height !== wantH) rc.height = wantH;
  ranchPage = Math.min(ranchPage, pageCount() - 1);
  const RHc = rc.height;
  rctx.imageSmoothingEnabled = false;
  rctx.clearRect(0, 0, RW, RHc);
  rctx.fillStyle = "#f7ecd7";
  rctx.fillRect(0, 0, RW, RHc - 12);
  rctx.fillStyle = "#b9834f";
  rctx.fillRect(0, RHc - 12, RW, 12);
  rctx.fillStyle = "#8a6b4a";
  rctx.fillRect(0, RHc - 14, RW, 2);

  drawText(rctx, "RANCH", 14, 14, 2, "#5c4632");
  bubbleIcon(rctx, 96, 19);
  const jellyX = drawText(rctx, String(jelly), 108, 13, 2, "#5c4632");
  // collection counter: owned base/total base + hybrids
  const nBase = owned.filter((id) => !id.startsWith("hyb")).length;
  const nHyb = owned.length - nBase;
  const mBase = SPECIES.filter((p) => !p.id.startsWith("hyb") && (seasonOpen(p) || owned.includes(p.id))).length;
  const dexEnd = drawText(rctx, `${nBase}/${mBase}${nHyb ? ` +${nHyb}` : ""}`, jellyX + 8, 20, 1, "#8a6b4a");
  // gold EVENT tag pulses while any seasonal window is open
  if (SPECIES.some((p) => p.season && seasonOpen(p)) || ACCS.some((a) => a.season && seasonOpen(a))) {
    drawText(rctx, "EVENT", dexEnd + 8, 20, 1, Math.sin(t * 4) > 0 ? "#d98a2b" : "#eec23f", null, true);
  }

  // BREED button (5h cooldown between breedings)
  const breedCd = Math.max(0, breedReadyAt - Date.now());
  const canBreed = jelly >= BREED_COST && owned.length >= 2 && !pullAnim && !shopMode && breedCd <= 0 && !DEMO;
  rctx.fillStyle = breedMode ? "#e05a6e" : canBreed ? "#c48fd9" : "#cbb896";
  rctx.fillRect(BREED_R[0], BREED_R[1], BREED_R[2], BREED_R[3]);
  rctx.strokeStyle = "#5c4632";
  rctx.lineWidth = 2;
  rctx.strokeRect(BREED_R[0] + 1, BREED_R[1] + 1, BREED_R[2] - 2, BREED_R[3] - 2);
  if (breedCd > 0 && !shopMode) {
    const hh = Math.floor(breedCd / 3600000);
    const mm = Math.floor((breedCd % 3600000) / 60000);
    drawText(rctx, `${hh}H${String(mm).padStart(2, "0")}`, BREED_R[0] + 5, BREED_R[1] + 8, 1, "#5c4632");
    // RUSH button in the header row: pay 100 gems to skip the 5h cooldown
    rctx.fillStyle = jelly >= 100 ? "#eec23f" : "#cbb896";
    rctx.fillRect(RESET_R[0], RESET_R[1], RESET_R[2], RESET_R[3]);
    rctx.strokeStyle = "#5c4632";
    rctx.lineWidth = 2;
    rctx.strokeRect(RESET_R[0] + 1, RESET_R[1] + 1, RESET_R[2] - 2, RESET_R[3] - 2);
    drawText(rctx, ">>", RESET_R[0] + 5, RESET_R[1] + 8, 1, "#2b1030");
    bubbleIcon(rctx, RESET_R[0] + 26, RESET_R[1] + 11);
    drawText(rctx, "100", RESET_R[0] + 34, RESET_R[1] + 8, 1, "#2b1030");
  } else {
    drawText(rctx, "BREED", BREED_R[0] + 7, BREED_R[1] + 8, 1, "#2b1030");
  }

  // PULL button
  const canPull = jelly >= PULL_COST && !pullAnim && !breedMode && !shopMode;
  rctx.fillStyle = canPull ? "#4fbd82" : "#cbb896";
  rctx.fillRect(PULL_R[0], PULL_R[1], PULL_R[2], PULL_R[3]);
  rctx.strokeStyle = "#5c4632";
  rctx.strokeRect(PULL_R[0] + 1, PULL_R[1] + 1, PULL_R[2] - 2, PULL_R[3] - 2);
  drawText(rctx, "PULL", PULL_R[0] + 5, PULL_R[1] + 8, 1, "#10231a");
  bubbleIcon(rctx, PULL_R[0] + 38, PULL_R[1] + 11);
  drawText(rctx, String(PULL_COST), PULL_R[0] + 48, PULL_R[1] + 8, 1, "#10231a");

  // SHOP button: accessory store
  rctx.fillStyle = shopMode ? "#e05a6e" : "#8fd4f0";
  rctx.fillRect(SHOP_R[0], SHOP_R[1], SHOP_R[2], SHOP_R[3]);
  rctx.strokeStyle = "#5c4632";
  rctx.lineWidth = 2;
  rctx.strokeRect(SHOP_R[0] + 1, SHOP_R[1] + 1, SHOP_R[2] - 2, SHOP_R[3] - 2);
  drawText(rctx, shopMode ? "BACK" : "SHOP", SHOP_R[0] + (shopMode ? 8 : 7), SHOP_R[1] + 8, 1, "#10231a");

  drawText(rctx, "X", CLOSE_R[0] + 6, CLOSE_R[1] + 7, 1, "#8a6b4a");
  rctx.strokeStyle = "#a8845c";
  rctx.strokeRect(CLOSE_R[0], CLOSE_R[1], CLOSE_R[2], CLOSE_R[3]);

  if (breedMode) drawText(rctx, "PICK 2", 14, 36, 1, "#8a5a20");
  else {
    // second header row: weekly spotlight + demo flag
    const spot = spotIdx();
    if (spot && !shopMode) drawText(rctx, `WEEK: ${spName(spot).toUpperCase()}`, 14, 36, 1, "#d98a2b", null, true);
    if (DEMO) drawText(rctx, "FREE DEMO", 380, 36, 1, "#e05a6e", null, true);
  }

  rctx.save();
  rctx.beginPath();
  rctx.rect(0, 42 + nurseryH(), RW, RHc - 42 - nurseryH() - FOOT_H);
  rctx.clip();
  if (shopMode) drawShopCells(t);
  else {
    const items = pageItems();
    for (let k = 0; k < items.length; k++) {
    const i = items[k];
    const { x, y } = cellOf(k);
    const sp = SPECIES[i];
    const has = owned.includes(sp.id);
    const picked = breedMode && breedSel.includes(i);
    // mini room: trait-tinted wall + floor + baseboard; border = rarity color
    rctx.fillStyle = ROOM_THEME[sp.trait] || "#f3e6cd";
    rctx.fillRect(x, y, 100, 92);
    rctx.strokeStyle = picked ? "#e05a6e" : i === active ? "#2f9e63" : RARITY_COLOR[sp.r];
    rctx.lineWidth = picked || i === active || sp.r >= 2 ? 3 : 2;
    rctx.strokeRect(x + 1, y + 1, 98, 90);
    rctx.fillStyle = "#c9a06c";
    rctx.fillRect(x + 2, y + 76, 96, 14);
    rctx.fillStyle = "#8a6b4a";
    rctx.fillRect(x + 2, y + 74, 96, 2);
    if (has) {
      const ph = slotPh[i];
      let face = "idle";
      if (petHome && i === active) face = "sleeping"; // parked at home: dozing in its room
      else if ((t + ph) % 4 < 0.16) face = "blink";
      else if (i === active && (t + ph) % 7 < 1.4) face = "happy";
      else if ((t + ph) % 9 < 1.0) face = Math.sin(ph * 10) > 0 ? "lookL" : "lookR";
      rctx.drawImage(sprite(face, i, false), x + 25, y + 74 - 36, 50, 36);
      if (accEquip[sp.id]) drawAcc(rctx, accEquip[sp.id], x + 50, y + 39, 1.4);
      // rarity pips on the wall, top-left corner
      rctx.fillStyle = RARITY_COLOR[sp.r];
      for (let p = 0; p <= sp.r; p++) rctx.fillRect(x + 6 + p * 8, y + 6, 5, 5);
      // accessory slot button (bottom-right of the room)
      if (accOwned.length) {
        rctx.fillStyle = "#e8d9b8";
        rctx.fillRect(x + 82, y + 78, 16, 12);
        rctx.strokeStyle = "#8a6b4a";
        rctx.lineWidth = 1;
        rctx.strokeRect(x + 82.5, y + 78.5, 15, 11);
        const eq = accEquip[sp.id];
        if (eq) drawAcc(rctx, eq, x + 90, y + 82, 0.7);
        else drawText(rctx, "-", x + 88, y + 81, 1, "#a8845c");
      }
      // summon toggle (bottom-left): drops a companion slime onto the
      // desktop. the parked-at-home main pet shows a green + instead
      const isPal = pals.some((p) => p.sp === i);
      const parked = petHome && i === active;
      rctx.fillStyle = isPal ? "#7de8f0" : parked ? "#7dd87d" : "#e8d9b8";
      rctx.fillRect(x + 4, y + 78, 16, 12);
      rctx.strokeStyle = "#8a6b4a";
      rctx.lineWidth = 1;
      rctx.strokeRect(x + 4.5, y + 78.5, 15, 11);
      drawText(rctx, isPal ? "-" : "+", x + 10, y + 81, 1, "#5c4632");
    } else {
      rctx.drawImage(sprite("idle", i, true), x + 25, y + 74 - 36, 50, 36);
      drawText(rctx, "?", x + 47, y + 44, 2, "#8a6b4a");
      if (sp.season && !seasonOpen(sp)) {
        const tw = textW("SOON", 1);
        rctx.fillStyle = "#8a6b4a";
        rctx.fillRect(x + 50 - (tw + 8) / 2, y + 56, tw + 8, 11);
        drawText(rctx, "SOON", x + 50 - tw / 2, y + 58, 1, "#ffe9c4");
      }
    }
    // name on the floor strip: light text + dark shadow for contrast
    const editing = nameEdit && nameEdit.i === i;
    const nm = has ? (editing ? nameEdit.buf + (Math.floor(t * 3) % 2 ? "_" : " ") : spName(sp)) : "???";
    drawText(rctx, nm, x + 50 - textW(nm, 1) / 2, y + 80, 1, editing ? "#ffd0d8" : has ? "#fff2dc" : "#e0cba4", "#4a2e18", true);
    if (has && shinyOwned[sp.id]) drawText(rctx, "*", x + 50 + textW(nm, 1) / 2 + 3, y + 80, 1, "#eec23f", "#4a2e18");
    // personality/baby tag: dark pill just left of the info button
    if (has && (sp.ps || isBaby(sp))) {
      const tag = isBaby(sp) ? "BABY" : sp.ps.toUpperCase();
      const tw = textW(tag, 1);
      rctx.fillStyle = isBaby(sp) ? "#5c86b0" : "#6b5338";
      rctx.fillRect(x + 80 - tw - 6, y + 4, tw + 6, 11);
      drawText(rctx, tag, x + 80 - tw - 3, y + 6, 1, "#ffe9c4", null, true);
    }
    // info button: opens the bestiary panel (works for silhouettes too)
    rctx.fillStyle = "#e8d9b8";
    rctx.fillRect(x + 84, y + 4, 12, 11);
    rctx.strokeStyle = "#8a6b4a";
    rctx.lineWidth = 1;
    rctx.strokeRect(x + 84.5, y + 4.5, 11, 10);
    drawText(rctx, "I", x + 88, y + 6, 1, "#5c4632", null, true);
    }
  }
  rctx.restore();

  // footer: pager arrows + page number + sort/filter cyclers
  {
    const fy = footY();
    rctx.fillStyle = "#e8d9b8";
    rctx.fillRect(0, fy - 4, RW, 2);
    const nPages = pageCount();
    const canPrev = ranchPage > 0;
    const canNext = ranchPage < nPages - 1;
    const btn = (R, label, on, labelCol) => {
      rctx.fillStyle = on ? "#e8d9b8" : "#d9c9ac";
      rctx.fillRect(R[0], R[1], R[2], R[3]);
      rctx.strokeStyle = "#8a6b4a";
      rctx.lineWidth = 1;
      rctx.strokeRect(R[0] + 0.5, R[1] + 0.5, R[2] - 1, R[3] - 1);
      drawText(rctx, label, R[0] + R[2] / 2 - textW(label, 1) / 2, R[1] + 6, 1, on ? (labelCol || "#5c4632") : "#b09a78", null, true);
    };
    btn(PG_L(), "<", canPrev);
    btn(PG_R(), ">", canNext);
    drawText(rctx, `${ranchPage + 1}/${nPages}`, 66, fy + 6, 1, "#5c4632", null, true);
    const nb = babyIdx().length;
    btn(NURSERY_BTN(), nb ? `NURSERY ${nb}` : "NURSERY", true, "#5c86b0");
    if (shopMode) {
      drawText(rctx, "ACCESSORY SHOP", 284, fy + 6, 1, "#8a6b4a");
    } else {
      btn(SORT_R(), `SORT:${SORTS[sortMode]}`, true, "#2f5f8e");
      btn(FILT_R(), `FILT:${FILTS[filtMode]}`, true, "#2f5f8e");
    }
  }

  // accessory picker: grid of owned accessories pinned to the panel bottom
  if (accPick !== null && SPECIES[accPick]) {
    const items = [null, ...accOwned];
    const cols = 4;
    const rows2 = Math.ceil(items.length / cols);
    const pw2 = cols * 34 + 14, ph3 = rows2 * 26 + 30;
    const px3 = Math.round(RW / 2 - pw2 / 2), py3 = Math.round(RHc - ph3 - 10);
    rctx.fillStyle = "#f7ecd7";
    rctx.fillRect(px3, py3, pw2, ph3);
    rctx.strokeStyle = "#8a6b4a";
    rctx.lineWidth = 2;
    rctx.strokeRect(px3 + 1, py3 + 1, pw2 - 2, ph3 - 2);
    drawText(rctx, "EQUIP", px3 + pw2 / 2 - textW("EQUIP", 1) / 2, py3 + 6, 1, "#5c4632");
    const curEq = accEquip[SPECIES[accPick].id] || null;
    for (let k = 0; k < items.length; k++) {
      const ix = px3 + 7 + (k % cols) * 34;
      const iy = py3 + 22 + Math.floor(k / cols) * 26;
      const eqd = items[k] === curEq;
      rctx.fillStyle = eqd ? "#b8e8c8" : "#e8d9b8";
      rctx.fillRect(ix, iy, 30, 22);
      rctx.strokeStyle = eqd ? "#2f9e63" : "#8a6b4a";
      rctx.lineWidth = 1;
      rctx.strokeRect(ix + 0.5, iy + 0.5, 29, 21);
      if (items[k]) drawAcc(rctx, items[k], ix + 15, iy + 11, 1.2);
      else drawText(rctx, "-", ix + 13, iy + 9, 1, "#a8845c");
    }
  }

  if (pullAnim) drawPull(ms);
}

// ---------- nursery: its own floating window for baby hybrids ----------
const NC_CLOSE = [NW - 32, 12, 18, 22];
const babyCell = (k) => ({ x: 14 + (k % 4) * 112, y: 46 + Math.floor(k / 4) * ROW_H });
function fitNursery() {
  const n = babyIdx().length;
  nc.height = n ? 46 + Math.ceil(n / 4) * ROW_H + 12 : 120;
}
// photo album: fullscreen overlay browsing photo-mode PNGs saved on disk
function openAlbum() {
  invoke("list_photos").then((names) => {
    albumList = (names || []).slice().sort();
    if (!albumList.length) {
      bangs.push({ x: petX, y: petY - 100, life: 2, t: "NO PHOTOS YET - USE PHOTO MODE" });
      return;
    }
    albumIdx = albumList.length - 1;   // newest photo first (names sort by timestamp)
    albumOpen = true;
    for (const n of albumList) loadAlbumImg(n);
    sfx.reveal();
  }).catch(() => {});
}
function loadAlbumImg(n) {
  if (albumImgs[n]) return;
  albumImgs[n] = "loading";
  invoke("load_photo", { name: n }).then((b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    albumImgs[n] = img;
  }).catch(() => { delete albumImgs[n]; });
}
function drawAlbum(c, W, H) {
  c.fillStyle = "rgba(24,18,14,0.6)";
  c.fillRect(0, 0, W, H);
  const bw = Math.min(W * 0.62, 660), bh = Math.min(H * 0.6, 400);
  const bx = W / 2 - bw / 2, by = H / 2 - bh / 2 - 12;
  c.fillStyle = "#f7ecd7";
  c.fillRect(bx - 8, by - 30, bw + 16, bh + 76);
  c.strokeStyle = "#8a6b4a";
  c.lineWidth = 2;
  c.strokeRect(bx - 7, by - 29, bw + 14, bh + 74);
  drawText(c, "PHOTO ALBUM", bx + 4, by - 21, 1, "#5c4632", null, true);
  drawText(c, "X", bx + bw - 8, by - 21, 1, "#e05a6e", null, true);
  const n = albumList[albumIdx];
  const img = n ? albumImgs[n] : null;
  c.fillStyle = "#241b2e";
  c.fillRect(bx, by, bw, bh);
  if (img && img.complete && img.naturalWidth) {
    const s = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, W / 2 - dw / 2, by + bh / 2 - dh / 2, dw, dh);
  } else {
    drawText(c, "LOADING...", W / 2 - 36, by + bh / 2 - 4, 1, "#8a6b4a");
  }
  // nav: < prev  n/N  next >  |  OPEN FOLDER link
  drawText(c, "<", bx + 4, by + bh + 12, 2, "#5c4632", null, true);
  const pg = `${albumIdx + 1}/${albumList.length}`;
  drawText(c, pg, W / 2 - textW(pg, 1) / 2, by + bh + 16, 1, "#5c4632", null, true);
  drawText(c, ">", bx + bw - 14, by + bh + 12, 2, "#5c4632", null, true);
  drawText(c, "OPEN FOLDER", W / 2 - textW("OPEN FOLDER", 1) / 2, by + bh + 30, 1, "#4a90c4");
  // delete is a two-tap confirm — first tap arms it, second executes
  const armed = n && performance.now() < albumDelArm;
  drawText(c, armed ? "SURE?" : "DELETE", bx + bw - 14 - textW(armed ? "SURE?" : "DELETE", 1), by + bh + 30, 1, armed ? "#e05a6e" : "#b09a78", null, armed);
  if (n) drawText(c, n.slice(0, 26), bx + 26, by + bh + 16, 1, "#b09a78");
}
// album card geometry shared by draw + hit-testing
function albumRect() {
  const bw = Math.min(winW * 0.62, 660), bh = Math.min(winH * 0.6, 400);
  return [winW / 2 - bw / 2, winH / 2 - bh / 2 - 12, bw, bh];
}
// shared hit-test: nav arrows, OPEN FOLDER, X, or click-outside to close.
// works from the main canvas AND the #info overlay (same screen coords)
function albumClick(mx, my) {
  const [bx, by, bw, bh] = albumRect();
  const n = albumList.length;
  if (mx >= bx + bw - 20 && mx <= bx + bw + 4 && my >= by - 30 && my <= by - 6) { albumOpen = false; sfx.pop(); return; }
  if (mx >= bx - 8 && mx <= bx + bw + 8 && my >= by - 30 && my <= by + bh + 46) {
    if (my >= by + bh + 24 && my <= by + bh + 44 && mx >= bx + bw - 76) {
      // DELETE — two taps within 3s: first arms, second removes the file
      const name = albumList[albumIdx];
      if (!name) return;
      if (performance.now() < albumDelArm) {
        albumDelArm = 0;
        invoke("delete_photo", { name }).then(() => {
          albumList.splice(albumIdx, 1);
          delete albumImgs[name];
          if (!albumList.length) albumOpen = false;
          else albumIdx = Math.min(albumIdx, albumList.length - 1);
          sfx.pop();
        }).catch(() => {});
      } else {
        albumDelArm = performance.now() + 3000;
        sfx.pop();
      }
    } else if (my >= by + bh + 24 && my <= by + bh + 44 && Math.abs(mx - winW / 2) < 60) {
      invoke("open_photos").catch(() => {});
    } else if (my >= by + bh + 4 && mx <= bx + 30) {
      albumIdx = (albumIdx - 1 + n) % n; sfx.pop();
    } else if (my >= by + bh + 4 && mx >= bx + bw - 30) {
      albumIdx = (albumIdx + 1) % n; sfx.pop();
    } else if (my <= by + bh) {
      albumIdx = (albumIdx + (mx < winW / 2 ? -1 : 1) + n) % n; sfx.pop();
    }
    return;
  }
  albumOpen = false;
}

function toggleNursery(force) {
  nurseryOpen = force !== undefined ? force : !nurseryOpen;
  nursery.classList.toggle("open", nurseryOpen);
  // infoPick survives — the card overlays nursery the same way
  if (nurseryOpen) {
    fitNursery();
    if (panelPos.nursery) {
      nursery.style.left = `${Math.max(4, Math.min(winW - nursery.offsetWidth - 4, panelPos.nursery.x))}px`;
      nursery.style.top = `${Math.max(4, Math.min(winH - nursery.offsetHeight - 4, panelPos.nursery.y))}px`;
    } else {
      nursery.style.left = `${Math.max(8, Math.min(winW - NW - 20, petX - NW / 2))}px`;
      // stack below the ranch when both windows are open
      const top = ranchOpen ? ranch.offsetTop + ranch.offsetHeight + 12 : petY - nc.height - 40;
      nursery.style.top = `${Math.max(8, Math.min(winH - nc.height - 20, top))}px`;
    }
  }
}

function drawNursery(ms) {
  const t = ms / 1000;
  const babies = babyIdx();
  const wantH = babies.length ? 46 + Math.ceil(babies.length / 4) * ROW_H + 12 : 120;
  if (nc.height !== wantH) nc.height = wantH;
  const NHc = nc.height;
  nctx.imageSmoothingEnabled = false;
  nctx.clearRect(0, 0, NW, NHc);
  nctx.fillStyle = "#eaf4fc";
  nctx.fillRect(0, 0, NW, NHc - 12);
  nctx.fillStyle = "#7db8e8";
  nctx.fillRect(0, NHc - 12, NW, 12);
  nctx.fillStyle = "#5c86b0";
  nctx.fillRect(0, NHc - 14, NW, 2);

  drawText(nctx, "NURSERY", 14, 14, 2, "#5c86b0");
  drawText(nctx, babies.length ? `${babies.length} BAB${babies.length > 1 ? "IES" : "Y"}` : "EMPTY", 120, 20, 1, "#8a9bb0");
  drawText(nctx, "X", NC_CLOSE[0] + 6, NC_CLOSE[1] + 7, 1, "#8a6b4a");
  nctx.strokeStyle = "#a8845c";
  nctx.strokeRect(NC_CLOSE[0], NC_CLOSE[1], NC_CLOSE[2], NC_CLOSE[3]);

  if (!babies.length) {
    drawText(nctx, "NO BABIES", NW / 2 - textW("NO BABIES", 1) / 2, 58, 1, "#8a9bb0");
    drawText(nctx, "BREED TO MAKE ONE", NW / 2 - textW("BREED TO MAKE ONE", 1) / 2, 76, 1, "#b8c8d8");
  }
  babies.forEach((bi, k) => {
    const { x, y } = babyCell(k);
    const bsp = SPECIES[bi];
    nctx.fillStyle = ROOM_THEME[bsp.trait] || "#f3e6cd";
    nctx.fillRect(x, y, 100, 92);
    nctx.strokeStyle = bi === active ? "#2f9e63" : "#7db8e8";
    nctx.lineWidth = bi === active ? 3 : 2;
    nctx.strokeRect(x + 1, y + 1, 98, 90);
    nctx.fillStyle = "#c9a06c";
    nctx.fillRect(x + 2, y + 76, 96, 14);
    nctx.fillStyle = "#8a6b4a";
    nctx.fillRect(x + 2, y + 74, 96, 2);
    // baby bounces with its pacifier
    const bob = Math.abs(Math.sin(t * 3 + k * 1.7)) * 4;
    nctx.drawImage(sprite("idle", bi, false), x + 25, y + 74 - 36 - bob, 50, 36);
    drawPaci(nctx, x + 50, y + 48 - bob, 1.1);
    // grow countdown top-left, BABY pill left of the info button
    const left = Math.max(1, Math.ceil((BABY_MS - (Date.now() - bsp.bornAt)) / 60000));
    drawText(nctx, `${left}MIN`, x + 6, y + 6, 1, "#8a6b4a", null, true);
    const tw = textW("BABY", 1);
    nctx.fillStyle = "#5c86b0";
    nctx.fillRect(x + 80 - tw - 6, y + 4, tw + 6, 11);
    drawText(nctx, "BABY", x + 80 - tw - 3, y + 6, 1, "#ffe9c4", null, true);
    nctx.fillStyle = "#e8d9b8";
    nctx.fillRect(x + 84, y + 4, 12, 11);
    nctx.strokeStyle = "#8a6b4a";
    nctx.lineWidth = 1;
    nctx.strokeRect(x + 84.5, y + 4.5, 11, 10);
    drawText(nctx, "I", x + 88, y + 6, 1, "#5c4632", null, true);
    const isPal = pals.some((p) => p.sp === bi);
    nctx.fillStyle = isPal ? "#7de8f0" : "#e8d9b8";
    nctx.fillRect(x + 4, y + 78, 16, 12);
    nctx.strokeStyle = "#8a6b4a";
    nctx.strokeRect(x + 4.5, y + 78.5, 15, 11);
    drawText(nctx, isPal ? "-" : "+", x + 10, y + 81, 1, "#5c4632");
    drawText(nctx, spName(bsp), x + 50 - textW(spName(bsp), 1) / 2, y + 80, 1, "#fff2dc", "#4a2e18", true);
  });
}

nc.addEventListener("pointerdown", (e) => {
  lastUiTap = Date.now();
  if (e.button !== 0) return;
  const r = nc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const inR = (R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3];
  if (inR(NC_CLOSE)) { toggleNursery(false); return; }
  // header grip: drag the title strip to move the nursery window
  if (my < 42 && !inR(NC_CLOSE)) {
    const ox = e.clientX - nursery.offsetLeft, oy = e.clientY - nursery.offsetTop;
    nc.setPointerCapture(e.pointerId);
    const move = (ev) => {
      nursery.style.left = `${Math.max(4, Math.min(winW - nursery.offsetWidth - 4, ev.clientX - ox))}px`;
      nursery.style.top = `${Math.max(4, Math.min(winH - nursery.offsetHeight - 4, ev.clientY - oy))}px`;
    };
    const up = () => {
      nc.removeEventListener("pointermove", move);
      nc.removeEventListener("pointerup", up);
      nc.removeEventListener("pointercancel", up);
      panelPos.nursery = { x: nursery.offsetLeft, y: nursery.offsetTop };
      panelPos._res = `${winW}x${winH}`;
      dirty = true;
    };
    nc.addEventListener("pointermove", move);
    nc.addEventListener("pointerup", up);
    nc.addEventListener("pointercancel", up);
    return;
  }
  if (infoPick !== null) { infoPick = null; sfx.pop(); return; }
  const babies = babyIdx();
  for (let k = 0; k < babies.length; k++) {
    const { x, y } = babyCell(k);
    if (mx >= x && mx <= x + 100 && my >= y && my <= y + 92) {
      const bi = babies[k];
      if (mx >= x + 84 && mx <= x + 96 && my >= y + 4 && my <= y + 15) {
        infoHost = "nursery";
        infoPick = bi;
        sfx.pop();
        return;
      }
      if (mx >= x + 4 && mx <= x + 20 && my >= y + 78 && my <= y + 90) {
        const pi = pals.findIndex((p) => p.sp === bi);
        if (pi >= 0) { pals.splice(pi, 1); sfx.pop(); }
        else if (spawnPal(bi)) sfx.reveal();
        else sfx.pop();
        return;
      }
      active = bi;
      dirty = true;
      sfx.pop();
      return;
    }
  }
});
nc.addEventListener("pointermove", (e) => {
  const r = nc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const onX = mx >= NC_CLOSE[0] && mx <= NC_CLOSE[0] + NC_CLOSE[2] && my >= NC_CLOSE[1] && my <= NC_CLOSE[1] + NC_CLOSE[3];
  nc.style.cursor = my < 42 && !onX ? "move" : "default";
});
// right-click a crib cell: status card if the baby is out, else bestiary
nc.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (infoPick !== null) return;
  const r = nc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (my < 42) return;
  const babies = babyIdx();
  for (let k = 0; k < babies.length; k++) {
    const { x, y } = babyCell(k);
    if (mx >= x && mx <= x + 100 && my >= y && my <= y + 92) {
      const bi = babies[k];
      const pal = pals.find((p) => p.sp === bi);
      if (pal) openCard(pal);
      else if (active === bi) openCard("pet");
      else { infoHost = "nursery"; infoPick = bi; }
      sfx.pop();
      return;
    }
  }
});

// ---------- status card (right-click any slime) ----------
function openCard(target) {
  cardTarget = target;
  cardAccPg = 0;
  cardAccModal = false;
  kc.height = cardKH();
  cardEl.classList.add("open");
  // reopen where the user last parked the card; first open floats
  // beside whichever slime was clicked
  const saved = panelPos.card;
  if (saved) {
    cardEl.style.left = `${Math.max(4, Math.min(winW - cardEl.offsetWidth - 4, saved.x))}px`;
    cardEl.style.top = `${Math.max(4, Math.min(winH - cardEl.offsetHeight - 4, saved.y))}px`;
  } else {
    const tx = target === "pet" ? petX : target.x;
    const ty = target === "pet" ? petY : target.y;
    cardEl.style.left = `${Math.max(8, Math.min(winW - KW - 12, tx + 64))}px`;
    cardEl.style.top = `${Math.max(8, Math.min(winH - KH - 12, ty - KH - 24))}px`;
  }
  sfx.pop();
}
function closeCard() {
  cardTarget = null;
  cardAccModal = false;
  cardEl.classList.remove("open");
}
function cardMood(t2, now) {
  if (t2 === "pet") {
    if (now < annoyedUntil) return "ANNOYED";
    if (now < dizzyUntil) return "DIZZY";
    if (state === "sleeping") return "SLEEPY";
    if (now < munchUntil) return "EATING";
    if (now < shockUntil) return "STARTLED";
    if (now < petUntil) return "PAMPERED";
    if (now < contentUntil) return "HAPPY";
    if (now < begUntil) return "NEEDY";
    if (energy > 0.72) return "PLAYFUL";
    if (energy < 0.3) return "LAZY";
    return "CONTENT";
  }
  if (now < t2.faceT) {
    return { love: "IN LOVE", laugh: "LAUGHING", happy: "HAPPY", shock: "STARTLED", grumpy: "GRUMPY", dizzy: "DIZZY" }[t2.faceId] || "HAPPY";
  }
  return "CONTENT";
}
function cardStatus(t2, now) {
  if (t2 === "pet") {
    if (held) return "BEING HELD";
    if (webbing) return "SWINGING";
    if (climbing) return "CLIMBING";
    if (state === "sleeping") return "NAPPING";
    if (flying) return "AIRBORNE";
    if (danceT0 && now - danceT0 < 1700) return "DANCING";
    if (sigT0 || spinT0) return "SHOWING OFF";
    if (huntPounce) return "POUNCING!";
    if (huntT0) return "STALKING";
    if (now < begUntil) return "BEGGING";
    if (treatAim && curX > -9000) return "EYEBALLING";
    if (walkTarget !== null || hopTarget !== null) return "WANDERING";
    return "IDLE";
  }
  if (t2 === palHeld) return "BEING HELD";
  if (t2.web && now < t2.web) return "SWINGING";
  if (t2.stackOn) return `RIDING ${spName(SPECIES[t2.stackOn.sp])}`;
  if (t2.tag) return t2.tag.it ? "PLAYING TAG" : "FLEEING!";
  if (t2.sigT && now < t2.sigT) return "SHOWING OFF";
  if (t2.fly) return "AIRBORNE";
  if (t2.walkT !== null) return "WANDERING";
  return "IDLE";
}
function drawCard(now) {
  if (!cardTarget) return;
  if (cardTarget !== "pet" && !pals.includes(cardTarget)) { closeCard(); return; }
  const isPet = cardTarget === "pet";
  const sp = isPet ? SPECIES[active] : SPECIES[cardTarget.sp];
  const t = now / 1000;
  kctx.fillStyle = "#f7ecd7";
  kctx.fillRect(0, 0, KW, cardKH());
  // header
  kctx.fillStyle = "#5c4632";
  kctx.fillRect(0, 0, KW, 30);
  const nm = spName(sp) + (shinyOwned[sp.id] ? " *" : "");
  drawText(kctx, nm.slice(0, 16), 10, 11, 2, "#fff6e8", null, true);
  kctx.fillStyle = "#a83240";
  kctx.fillRect(KC_CLOSE[0], KC_CLOSE[1], KC_CLOSE[2], KC_CLOSE[3]);
  drawText(kctx, "X", KC_CLOSE[0] + 6, KC_CLOSE[1] + 6, 1, "#fff6e8", null, true);
  // sprite stage — live sprite with its real current face
  kctx.fillStyle = "#e8d8bc";
  kctx.fillRect(10, 38, 96, 74);
  kctx.strokeStyle = "#b89a72";
  kctx.lineWidth = 2;
  kctx.strokeRect(10, 38, 96, 74);
  const bob = Math.sin(t * 2.6) * 2;
  const spr = isPet ? currentSprite(now) : sprite(cardTarget.pf || "idle", cardTarget.sp, false, true);
  kctx.drawImage(spr, 34, 66 + bob, 48, 34);
  // mood + status (live)
  const mood = cardMood(cardTarget, now);
  const stat = cardStatus(cardTarget, now);
  drawText(kctx, "MOOD", 116, 44, 1, "#8a6b4a", null, true);
  drawText(kctx, mood, 116, 56, 1, mood === "CONTENT" || mood === "IDLE" ? "#5c4632" : "#c05a2a", null, true);
  drawText(kctx, "STATUS", 116, 74, 1, "#8a6b4a", null, true);
  drawText(kctx, stat.slice(0, 18), 116, 86, 1, "#5c4632", null, true);
  drawText(kctx, RARITY_NAME[sp.r] || "?", 116, 104, 1, RARITY_COLOR[sp.r] || "#5c4632", null, true);
  // stat rows
  const row = (y, k, v, col) => {
    drawText(kctx, k, 16, y, 1, "#8a6b4a", null, true);
    drawText(kctx, String(v).slice(0, 30), 76, y, 1, col || "#5c4632", null, true);
  };
  let ry = 124;
  row(ry, "NATURE", (sp.ps || "?").toUpperCase()); ry += 14;
  row(ry, "MOVE", MV_INFO[sp.mv] || "-"); ry += 14;
  row(ry, "TRAIT", sp.trait ? TRAIT_INFO[sp.trait] || sp.trait.toUpperCase() : "-"); ry += 14;
  row(ry, "SKILL", sp.sig ? SIG_INFO[sp.sig] || sp.sig.toUpperCase() : "-"); ry += 14;
  // bond: heart pips + a name — affection per species, earned by playing
  const bl = bondLvl(sp.id);
  drawText(kctx, "BOND", 16, ry, 1, "#8a6b4a", null, true);
  for (let h = 0; h < 5; h++) {
    kctx.fillStyle = h < bl ? "#d84a5e" : "#d8c4a0";
    const hx = 76 + h * 14, hy = ry - 1;
    kctx.fillRect(hx + 1, hy, 3, 2); kctx.fillRect(hx + 5, hy, 3, 2);
    kctx.fillRect(hx, hy + 2, 9, 3); kctx.fillRect(hx + 2, hy + 5, 5, 2); kctx.fillRect(hx + 3.5, hy + 7, 2, 2);
  }
  drawText(kctx, BOND_NAMES[Math.min(bl, BOND_NAMES.length - 1)], 158, ry, 1, "#5c4632", null, true);
  ry += 14;
  if (isPet) {
    row(ry, "LEVEL", `${level}  (${xp} KEYS)`);
    // xp progress bar toward the next level
    kctx.fillStyle = "#d8c4a0";
    kctx.fillRect(76, ry + 10, 160, 6);
    kctx.fillStyle = "#7dc24a";
    const prog = level >= 3 ? 1 : (xp % KEYS_PER_LEVEL) / KEYS_PER_LEVEL;
    kctx.fillRect(76, ry + 10, Math.round(160 * prog), 6);
    ry += 22;
  }
  // gear cell (pals only): one doodad shown — the currently equipped
  // accessory, or "-" for none. click it to open the picker modal
  cardAccCells = [];
  cardGearCell = null;
  if (!isPet) {
    drawText(kctx, "GEAR", 16, ry + 4, 1, "#8a6b4a", null, true);
    const cur = accEquip[sp.id];
    const cx = 56, cy = ry - 6;
    kctx.fillStyle = "#ffe9b0";
    kctx.fillRect(cx, cy, 26, 20);
    kctx.strokeStyle = "#8a6b4a";
    kctx.strokeRect(cx, cy, 26, 20);
    if (cur) drawAcc(kctx, cur, cx + 13, cy + 7, 1);
    else drawText(kctx, "+", cx + 10, cy + 6, 1, "#8a6b4a", null, true);
    drawText(kctx, "CHANGE", cx + 34, cy + 7, 1, "#a89478", null, true);
    cardGearCell = [cx, cy, 26, 20];
    ry += 30;
  }
  // SEND HOME — works for the main pet too: it parks itself in the ranch
  const homeR = cardHomeR();
  kctx.fillStyle = "#e8d8bc";
  kctx.fillRect(homeR[0], homeR[1], homeR[2], homeR[3]);
  kctx.strokeStyle = "#8a6b4a";
  kctx.strokeRect(homeR[0], homeR[1], homeR[2], homeR[3]);
  drawText(kctx, "SEND HOME", homeR[0] + 10, homeR[1] + 7, 1, "#5c4632", null, true);
  if (!isPet) drawText(kctx, "DRAG ME", 16, cardKH() - 24, 1, "#a89478", null, true);
  // accessory picker modal: covers the card body below the header —
  // a grid of every owned doodad, current one marked, "-" unequips
  if (cardAccModal && !isPet) {
    const items = [null, ...accOwned];
    const cols = 6, cw = 38, chh = 28;
    const gx = 14, gy = 38;
    const vrows = Math.floor((cardKH() - gy - 34) / chh); // pager row reserved
    const per = cols * vrows;
    const pgs = Math.max(1, Math.ceil(items.length / per));
    cardAccPg = Math.max(0, Math.min(cardAccPg, pgs - 1));
    kctx.fillStyle = "#f7ecd7";
    kctx.fillRect(6, gy - 4, KW - 12, cardKH() - gy - 2);
    kctx.strokeStyle = "#8a6b4a";
    kctx.lineWidth = 2;
    kctx.strokeRect(7, gy - 3, KW - 14, cardKH() - gy - 4);
    drawText(kctx, "EQUIP", gx + 2, gy + 2, 1, "#5c4632", null, true);
    const curEq = accEquip[sp.id] || null;
    const show = items.slice(cardAccPg * per, cardAccPg * per + per);
    for (let k = 0; k < show.length; k++) {
      const ix = gx + (k % cols) * cw, iy = gy + 16 + Math.floor(k / cols) * chh;
      const eqd = show[k] === curEq;
      kctx.fillStyle = eqd ? "#b8e8c8" : "#e8d9b8";
      kctx.fillRect(ix, iy, 34, 24);
      kctx.strokeStyle = eqd ? "#2f9e63" : "#8a6b4a";
      kctx.lineWidth = 1;
      kctx.strokeRect(ix + 0.5, iy + 0.5, 33, 23);
      if (show[k]) drawAcc(kctx, show[k], ix + 17, iy + 12, 1.2);
      else drawText(kctx, "-", ix + 15, iy + 10, 1, "#a8845c", null, true);
      cardAccCells.push([ix, iy, 34, 24, show[k]]);
    }
    if (!accOwned.length) {
      drawText(kctx, "NO GEAR YET", gx + 2, gy + 16 + vrows * chh - 30, 1, "#a8845c", null, true);
      drawText(kctx, "BUY AT RANCH SHOP", gx + 2, gy + 16 + vrows * chh - 18, 1, "#a8845c", null, true);
    }
    if (pgs > 1) {
      drawText(kctx, "<", KW - 60, cardKH() - 20, 1, "#5c4632", null, true);
      drawText(kctx, `${cardAccPg + 1}/${pgs}`, KW - 44, cardKH() - 20, 1, "#5c4632", null, true);
      drawText(kctx, ">", KW - 20, cardKH() - 20, 1, "#5c4632", null, true);
    }
  }
}
kc.addEventListener("pointerdown", (e) => {
  lastUiTap = Date.now();
  if (e.button !== 0) return;
  const r = kc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const inR = (R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3];
  if (inR(KC_CLOSE)) { closeCard(); sfx.pop(); return; }
  const homeR = cardHomeR();
  if (cardTarget === "pet" && inR(homeR)) { sendPetHome(); closeCard(); return; }
  if (cardTarget !== "pet" && cardTarget) {
    if (cardAccModal) {
      // picker modal: click a doodad to equip it on THIS pal, "-" to
      // unequip — any pick closes the modal back to the card
      const items2 = [null, ...accOwned];
      for (const [cx, cy, cw, ch, accId] of cardAccCells) {
        if (mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch) {
          const sid = SPECIES[cardTarget.sp].id;
          if (accId) accEquip[sid] = accId; else delete accEquip[sid];
          dirty = true;
          cardAccModal = false;
          sfx.pop();
          return;
        }
      }
      if (items2.length > 36) {
        if (mx >= KW - 66 && mx <= KW - 48 && my >= cardKH() - 26 && my <= cardKH() - 12) { cardAccPg = Math.max(0, cardAccPg - 1); sfx.pop(); return; }
        if (mx >= KW - 24 && mx <= KW - 6 && my >= cardKH() - 26 && my <= cardKH() - 12) { cardAccPg++; sfx.pop(); return; }
      }
      if (my < cardKH() - 26) { cardAccModal = false; sfx.pop(); } // click off the grid dismisses
      return; // the modal swallows every other click while it's up
    }
    // the single gear cell opens the picker modal
    if (cardGearCell && inR(cardGearCell)) {
      cardAccModal = true;
      cardAccPg = 0;
      sfx.pop();
      return;
    }
    if (inR(homeR)) {
      sendPalHome(cardTarget);
      closeCard();
      return;
    }
  }
  // header grip: drag the title strip to move the card
  if (my < 30 && !inR(KC_CLOSE)) {
    const ox = e.clientX - cardEl.offsetLeft, oy = e.clientY - cardEl.offsetTop;
    kc.setPointerCapture(e.pointerId);
    const move = (ev) => {
      cardEl.style.left = `${Math.max(4, Math.min(winW - cardEl.offsetWidth - 4, ev.clientX - ox))}px`;
      cardEl.style.top = `${Math.max(4, Math.min(winH - cardEl.offsetHeight - 4, ev.clientY - oy))}px`;
    };
    const up = () => {
      kc.removeEventListener("pointermove", move);
      kc.removeEventListener("pointerup", up);
      kc.removeEventListener("pointercancel", up);
      panelPos.card = { x: cardEl.offsetLeft, y: cardEl.offsetTop };
      panelPos._res = `${winW}x${winH}`;
      dirty = true;
    };
    kc.addEventListener("pointermove", move);
    kc.addEventListener("pointerup", up);
    kc.addEventListener("pointercancel", up);
  }
});
kc.addEventListener("pointermove", (e) => {
  const r = kc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const onX = mx >= KC_CLOSE[0] && mx <= KC_CLOSE[0] + KC_CLOSE[2] && my >= KC_CLOSE[1] && my <= KC_CLOSE[1] + KC_CLOSE[3];
  kc.style.cursor = my < 30 && !onX ? "move" : "default";
});
kc.addEventListener("contextmenu", (e) => e.preventDefault());

// accessory shop: each item costs ACC_COST gems, drawn in the same
// room-cell layout as the ranch
function drawShopCells(t) {
  const items = pageItems();
  for (let k = 0; k < items.length; k++) {
    const i = items[k];
    const { x, y } = cellOf(k);
    const a = ACCS[i];
    const has = accOwned.includes(a.id);
    rctx.fillStyle = "#f3e6cd";
    rctx.fillRect(x, y, 100, 92);
    // premium line gets a gold frame so the pricey shelf reads as deluxe
    rctx.strokeStyle = has ? "#4fbd82" : a.prem ? "#e8b83f" : "#8fd4f0";
    rctx.lineWidth = a.prem ? 3 : 2;
    rctx.strokeRect(x + 1, y + 1, 98, 90);
    rctx.fillStyle = "#c9a06c";
    rctx.fillRect(x + 2, y + 76, 96, 14);
    rctx.fillStyle = "#8a6b4a";
    rctx.fillRect(x + 2, y + 74, 96, 2);
    // pedestal + big accessory preview with a gentle bob
    rctx.fillStyle = "#d9c49a";
    rctx.fillRect(x + 34, y + 58, 32, 4);
    drawAcc(rctx, a.id, x + 50, y + 34 + Math.sin(t * 2 + i) * 2, 2.6);
    if (a.season) drawText(rctx, "EVT", x + 6, y + 6, 1, "#d98a2b", null, true);
    if (a.prem) drawSpr(rctx, "star5", x + 6, y + 6, 1);
    drawText(rctx, a.name, x + 50 - textW(a.name, 1) / 2, y + 62, 1, "#6b5338");
    if (has) {
      drawText(rctx, "OWNED", x + 50 - textW("OWNED", 1) / 2, y + 80, 1, "#2f9e63");
    } else {
      const cost = a.cost || ACC_COST;
      const afford = jelly >= cost;
      bubbleIcon(rctx, x + 40, y + 85);
      drawText(rctx, String(cost), x + 48, y + 80, 1, afford ? "#5c4632" : "#c47070");
    }
  }
}

function drawPull(ms) {
  const el = ms - pullAnim.t0;
  const cx = RW / 2;
  const floorY = rc.height - 60;
  // dim the slots area
  rctx.fillStyle = "rgba(60, 45, 25, 0.45)";
  rctx.fillRect(0, 42, RW, rc.height - 42);

  if (el < 700) {
    if (pullAnim.egg) {
      // egg wobbles then cracks
      const wob = Math.sin(el / 70) * (el > 420 ? 0.25 : 0.08);
      rctx.save();
      rctx.translate(cx, floorY - 14);
      rctx.rotate(wob);
      drawSpr(rctx, el > 560 ? "eggc" : "egg", 0, 0, 4);
      rctx.restore();
      drawText(rctx, "...", cx - 9, floorY + 18, 2, "#fff6e8");
      return;
    }
    const tt = Math.min(1, el / 400);
    const cy = -30 + (floorY - 14 + 30) * (tt * tt);
    const sq = el > 400 && el < 560 ? Math.sin(((el - 400) / 160) * Math.PI) * 0.25 : 0;
    rctx.save();
    rctx.translate(cx, Math.min(cy, floorY - 14));
    rctx.scale(1 + sq, 1 - sq);
    drawSpr(rctx, "capsule", 0, 0, 4);
    rctx.restore();
    drawText(rctx, "...", cx - 9, floorY + 18, 2, "#fff6e8");
    return;
  }
  const sp = SPECIES[pullAnim.idx];
  const rt = Math.min(1, (el - 700) / 250);
  const pop = 1 + Math.sin(rt * Math.PI) * 0.25;
  rctx.save();
  rctx.translate(cx, floorY - 26);
  rctx.scale(pop, pop);
  rctx.drawImage(sprite("happy", pullAnim.idx, false), -45, -65, 90, 65);
  rctx.restore();
  rctx.fillStyle = "#ffd75e";
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + el / 300;
    drawText(rctx, "+", cx + Math.cos(ang) * 55 - 2, floorY - 50 + Math.sin(ang) * 30, 1, "#ffd75e");
  }
  const label = pullAnim.egg
    ? `${pullAnim.shiny ? "SHINY BORN! " : "BORN! "}${spName(sp)}`
    : pullAnim.shiny ? `SHINY! ${spName(sp)}` : pullAnim.isNew ? `NEW! ${spName(sp)}` : `${spName(sp)} +${DUP_REFUND}`;
  drawText(rctx, label, cx - textW(label, 2) / 2, floorY + 14, 2, "#fff6e8");
  if (pullAnim.acc) {
    const an = ACCS.find((a) => a.id === pullAnim.acc).name;
    const t2 = `BONUS ${an}`;
    drawText(rctx, t2, cx - textW(t2, 1) / 2, floorY + 34, 1, "#ffd75e");
  }
  if (el > 2100) {
    // the pet celebrates a fresh reveal — stars in its eyes for a new
    // friend, sparklier for a shiny
    if (pullAnim.isNew || pullAnim.shiny) starUntil = ms + 1400;
    pullAnim = null;
  }
}

function toggleRanch(force) {
  ranchOpen = force !== undefined ? force : !ranchOpen;
  ranch.classList.toggle("open", ranchOpen);
  accPick = null;
  // infoPick survives — the card is its own overlay, not ranch content
  if (ranchOpen) {
    fitRanch();
    if (!seen) { seen = true; dirty = true; }
    breedMode = false;
    breedSel = [];
    if (panelPos.ranch) {
      ranch.style.left = `${Math.max(4, Math.min(winW - ranch.offsetWidth - 4, panelPos.ranch.x))}px`;
      ranch.style.top = `${Math.max(4, Math.min(winH - ranch.offsetHeight - 4, panelPos.ranch.y))}px`;
    } else {
      ranch.style.left = `${Math.max(8, Math.min(winW - RW - 20, petX - RW / 2))}px`;
      ranch.style.top = `${Math.max(8, Math.min(winH - rc.height - 20, petY - rc.height - 40))}px`;
    }
  }
}

rc.addEventListener("pointerdown", (e) => {
  lastUiTap = Date.now();
  if (e.button !== 0) return;
  nameEdit = null; // any ranch click abandons an in-progress rename
  const r = rc.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const inR = (R) => mx >= R[0] && mx <= R[0] + R[2] && my >= R[1] && my <= R[1] + R[3];
  if (inR(CLOSE_R)) { toggleRanch(false); return; }
  if (pullAnim) return;
  // header grip: drag any button-free strip of the title bar to move the
  // window; the nursery rides along when it's stacked below
  if (my < 42 && ![PULL_R, BREED_R, SHOP_R, RESET_R, CLOSE_R].some(inR)) {
    const ox = e.clientX - ranch.offsetLeft, oy = e.clientY - ranch.offsetTop;
    rc.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const nl = Math.max(4, Math.min(winW - ranch.offsetWidth - 4, ev.clientX - ox));
      const nt = Math.max(4, Math.min(winH - ranch.offsetHeight - 4, ev.clientY - oy));
      const dx = nl - ranch.offsetLeft, dy = nt - ranch.offsetTop;
      ranch.style.left = `${nl}px`;
      ranch.style.top = `${nt}px`;
      if (nurseryOpen) {
        nursery.style.left = `${Math.max(4, nursery.offsetLeft + dx)}px`;
        nursery.style.top = `${Math.max(4, nursery.offsetTop + dy)}px`;
      }
    };
    const up = () => {
      rc.removeEventListener("pointermove", move);
      rc.removeEventListener("pointerup", up);
      rc.removeEventListener("pointercancel", up);
      panelPos.ranch = { x: ranch.offsetLeft, y: ranch.offsetTop };
      // the nursery rides along on a ranch drag — keep its spot too
      if (nurseryOpen) panelPos.nursery = { x: nursery.offsetLeft, y: nursery.offsetTop };
      panelPos._res = `${winW}x${winH}`;
      dirty = true;
    };
    rc.addEventListener("pointermove", move);
    rc.addEventListener("pointerup", up);
    rc.addEventListener("pointercancel", up);
    return;
  }
  // bestiary panel covers everything — any click closes it
  if (infoPick !== null) { infoPick = null; sfx.pop(); return; }
  // accessory picker overlay: pick an item (or NONE), any click closes it.
  // sits above the footer so it must be hit-tested first
  if (accPick !== null) {
    const items = [null, ...accOwned];
    const cols = 4;
    const rows2 = Math.ceil(items.length / cols);
    const pw2 = cols * 34 + 14, ph3 = rows2 * 26 + 30;
    const px3 = Math.round(RW / 2 - pw2 / 2), py3 = Math.round(rc.height - ph3 - 10);
    if (mx >= px3 && mx <= px3 + pw2 && my >= py3 && my <= py3 + ph3) {
      for (let k = 0; k < items.length; k++) {
        const ix = px3 + 7 + (k % cols) * 34;
        const iy = py3 + 22 + Math.floor(k / cols) * 26;
        if (mx >= ix && mx <= ix + 30 && my >= iy && my <= iy + 22) {
          const id = SPECIES[accPick].id;
          if (items[k]) accEquip[id] = items[k];
          else delete accEquip[id];
          dirty = true;
          sfx.pop();
          break;
        }
      }
    }
    accPick = null;
    return;
  }
  // footer: pager + sort/filter cyclers
  if (inR(PG_L()) && ranchPage > 0) { ranchPage--; sfx.pop(); return; }
  if (inR(PG_R()) && ranchPage < pageCount() - 1) { ranchPage++; sfx.pop(); return; }
  if (!shopMode && inR(SORT_R())) { sortMode = (sortMode + 1) % SORTS.length; ranchPage = 0; sfx.pop(); return; }
  if (!shopMode && inR(FILT_R())) { filtMode = (filtMode + 1) % FILTS.length; ranchPage = 0; sfx.pop(); return; }
  if (inR(NURSERY_BTN())) { toggleNursery(); sfx.pop(); return; }
  if (inR(SHOP_R)) { shopMode = !shopMode; breedMode = false; breedSel = []; ranchPage = 0; accPick = null; infoPick = null; sfx.pop(); return; }
  if (shopMode) {
    // buy accessories: 250 gems each
    const items = pageItems();
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      if (my < 42) break;
      const { x, y } = cellOf(k);
      if (mx >= x && mx <= x + 100 && my >= y && my <= y + 92) {
        const a = ACCS[i];
        const cost = a.cost || ACC_COST;
        if (!accOwned.includes(a.id) && jelly >= cost) {
          jelly -= cost;
          accOwned.push(a.id);
          dirty = true;
          sfx.reveal();
        } else sfx.pop();
        return;
      }
    }
    return;
  }
  if (inR(RESET_R) && Date.now() < breedReadyAt) {
    if (jelly >= 100) {
      jelly -= 100;
      breedReadyAt = 0;
      dirty = true;
      sfx.reveal();
    } else sfx.pop();
    return;
  }
  if (inR(BREED_R)) {
    if (DEMO) {
      bangs.push({ x: petX, y: petY - 110, life: 2.2, t: "BREED IS FULL VER ONLY" });
      sfx.pop();
    } else if (jelly >= BREED_COST && owned.length >= 2 && Date.now() >= breedReadyAt) {
      breedMode = !breedMode;
      breedSel = [];
      accPick = null;
      infoPick = null;
      sfx.pop();
    }
    return;
  }
  if (inR(PULL_R) && !breedMode) { doPull(); return; }
  const items = pageItems();
  for (let k = 0; k < items.length; k++) {
    const i = items[k];
    if (my < 42 + nurseryH()) break;
    const { x, y } = cellOf(k);
    if (mx >= x && mx <= x + 100 && my >= y && my <= y + 104) {
      // info button (top-right) — works even for silhouette cells
      if (mx >= x + 84 && mx <= x + 96 && my >= y + 4 && my <= y + 15) {
        infoHost = "ranch";
        infoPick = i;
        sfx.pop();
        return;
      }
      if (!owned.includes(SPECIES[i].id)) return;
      // summon toggle (bottom-left corner of the cell). for the active
      // species while it's parked home, + brings the main pet back out
      if (!breedMode && mx >= x + 4 && mx <= x + 20 && my >= y + 78 && my <= y + 90) {
        if (i === active && petHome) { bringPetHome(); return; }
        const pi = pals.findIndex((p) => p.sp === i);
        if (pi >= 0) { pals.splice(pi, 1); sfx.pop(); }
        else if (spawnPal(i)) sfx.reveal();
        else sfx.pop();
        return;
      }
      // accessory slot button: opens the equip picker grid
      if (!breedMode && accOwned.length && mx >= x + 82 && mx <= x + 98 && my >= y + 78 && my <= y + 90) {
        accPick = i;
        sfx.pop();
        return;
      }
      if (breedMode) {
        if (!breedSel.includes(i)) {
          breedSel.push(i);
          sfx.munch();
          if (breedSel.length === 2) doBreed();
        }
        return;
      }
      // name row click: rename this slime (type, Enter commits, Esc cancels)
      if (mx >= x + 24 && mx <= x + 80 && my >= y + 78 && my <= y + 90) {
        nameEdit = { i, buf: customNames[SPECIES[i].id] || "" };
        sfx.pop();
        return;
      }
      active = i;
      dirty = true;
      sfx.pop();
      return;
    }
  }
});

// right-click a ranch cell: the status card if that slime is out
// walking around, otherwise the bestiary card
rc.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const r = rc.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (my < 42 || infoPick !== null || accPick !== null || shopMode || pullAnim) return;
  const items = pageItems();
  for (let k = 0; k < items.length; k++) {
    const i = items[k];
    if (my < 42 + nurseryH()) break;
    const { x, y } = cellOf(k);
    if (mx >= x && mx <= x + 100 && my >= y && my <= y + 104) {
      const pal = pals.find((p) => p.sp === i);
      if (pal) openCard(pal);
      else if (active === i) openCard("pet");
      else { infoHost = "ranch"; infoPick = i; }
      sfx.pop();
      return;
    }
  }
});
// gacha: rarity roll first, then uniform pick inside that tier.
// pity timers (Chillquarium-style): rare+ guaranteed within 12 pulls,
// legendary guaranteed within 50.
const RARITY_W = [60, 28, 9.5, 2.5];
function rollSpecies() {
  pityRare += 1;
  pityLeg += 1;
  let r = 0;
  if (pityLeg >= 50) r = 3;
  else {
    const total = RARITY_W.reduce((a, b) => a + b, 0);
    let x = Math.random() * total;
    for (let i = 0; i < 4; i++) { x -= RARITY_W[i]; if (x <= 0) { r = i; break; } }
    if (r === 0 && pityRare >= 12) r = 1;
  }
  if (r >= 1) pityRare = 0;
  if (r >= 3) pityLeg = 0;
  const pool = SPECIES.filter((s) => s.r === r && !s.id.startsWith("hyb") && seasonOpen(s));
  // weekly spotlight: this week's featured species gets a 15% boost
  const spot = spotIdx();
  if (spot && pool.includes(spot) && Math.random() < 0.15) return spot;
  return pool[(Math.random() * pool.length) | 0];
}

function doPull() {
  if (jelly < PULL_COST || pullAnim) return;
  // free demo: the collection caps at DEMO_MAX base species
  if (DEMO && owned.filter((id) => !id.startsWith("hyb")).length >= DEMO_MAX) {
    bangs.push({ x: petX, y: petY - 110, life: 2.2, t: "DEMO FULL - GET FULL VER" });
    sfx.pop();
    return;
  }
  jelly -= PULL_COST;
  stats.pulls++;
  const sp = rollSpecies();
  const idx = SPECIES.indexOf(sp);
  const isNew = !owned.includes(sp.id);
  if (isNew) owned.push(sp.id);
  else jelly += DUP_REFUND;
  // 8% shiny (gold-tinted) variant on new species — Chillquarium-style tint
  const shiny = isNew && Math.random() < 0.08;
  if (shiny) { shinyOwned[sp.id] = true; stats.shiny++; }
  // 18% bonus accessory drop
  let acc = null;
  const locked = ACCS.filter((a) => !accOwned.includes(a.id));
  if (locked.length && Math.random() < 0.18) {
    acc = locked[(Math.random() * locked.length) | 0].id;
    accOwned.push(acc);
  }
  dirty = true;
  checkDex();
  pullAnim = { t0: performance.now(), idx, isNew, acc, shiny };
  sfx.drop();
  setTimeout(() => sfx.reveal(), 700);
}

// breeding: two parents -> hybrid mixing their colors, or (25%) an
// unowned base species. legendary never comes from breeding.
function mixHex(h1, h2) {
  const a = hexRgb(h1);
  const b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round((v + b[i]) / 2).toString(16).padStart(2, "0")).join("");
}

function makeHybrid(A, B) {
  const pal = {
    o: mixHex(A.pal.o, B.pal.o), b: mixHex(A.pal.b, B.pal.b),
    l: mixHex(A.pal.l, B.pal.l), s: mixHex(A.pal.s, B.pal.s),
    e: "#23332c", w: "#ffffff", m: "#23332c", k: mixHex(A.pal.k, B.pal.k),
  };
  const raw = A.name.slice(0, Math.ceil(A.name.length / 2)) + B.name.slice(Math.floor(B.name.length / 2));
  const bump = A.r === B.r && Math.random() < 0.1 ? 1 : 0;
  return {
    id: `hyb${hybSeq++}`,
    name: raw[0].toUpperCase() + raw.slice(1).toLowerCase(),
    r: Math.min(2, Math.max(A.r, B.r) + bump),
    shape: Math.random() < 0.5 ? A.shape : B.shape,
    trait: Math.random() < 0.5 ? A.trait : B.trait,
    mv: Math.random() < 0.5 ? A.mv : B.mv,
    sig: Math.random() < 0.5 ? A.sig : B.sig,
    ps: Math.random() < 0.5 ? A.ps : B.ps,
    kr: (A.kr || B.kr) ? "REACTS TO TYPING" : undefined,
    bornAt: Date.now(),
    pal,
    top: Math.random() < 0.5 ? A.top : B.top,
  };
}

function doBreed() {
  if (breedSel.length !== 2 || jelly < BREED_COST || Date.now() < breedReadyAt) return;
  jelly -= BREED_COST;
  stats.breeds++;
  breedReadyAt = Date.now() + BREED_CD;
  const A = SPECIES[breedSel[0]];
  const B = SPECIES[breedSel[1]];
  let child;
  const unownedBase = SPECIES.filter((s) => s.r <= 2 && !s.id.startsWith("hyb") && !owned.includes(s.id) && seasonOpen(s));
  if (unownedBase.length && Math.random() < 0.25) {
    child = unownedBase[(Math.random() * unownedBase.length) | 0];
  } else {
    child = makeHybrid(A, B);
    SPECIES.push(child);
    slotPh.push(Math.random() * 5);
    fitRanch();
  }
  owned.push(child.id);
  // shiny parents pass the spark down: 15% when either parent is shiny
  const bShiny = (shinyOwned[A.id] || shinyOwned[B.id]) && Math.random() < 0.15;
  if (bShiny) { shinyOwned[child.id] = true; stats.shiny++; }
  breedMode = false;
  breedSel = [];
  dirty = true;
  checkDex();
  pullAnim = { t0: performance.now(), idx: SPECIES.indexOf(child), isNew: true, egg: true, shiny: bShiny };
  sfx.drop();
  setTimeout(() => sfx.reveal(), 700);
  // a hybrid arrives as a baby — pop the nursery open to show the crib
  if (isBaby(child)) toggleNursery(true);
}

cv.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const [mx, my] = canvasPos(e);
  // right-click a slime -> its live status card. pals sit on top of the
  // pet when they overlap, so they win the pick; the ranch has its own
  // button now
  const rp = palAt(mx, my);
  if (rp) { openCard(rp); return; }
  if (hitTest(mx, my)) { openCard("pet"); return; }
  if (cardTarget) closeCard();
});
rc.addEventListener("contextmenu", (e) => e.preventDefault());
// the settings panel is canvas-drawn — its own wheel handler scrolls the
// row list when the panel is shorter than its content (small monitors)
cv.addEventListener("wheel", (e) => {
  if (!settingsOpen) return;
  const [mx, my] = canvasPos(e);
  const [px, py, pw, ph] = settingsRect();
  if (mx < px || mx > px + pw || my < py || my > py + ph) return;
  setScroll = Math.max(0, Math.min(setMaxScroll(), setScroll + Math.sign(e.deltaY) * 26));
  e.preventDefault();
}, { passive: false });
addEventListener("keydown", (e) => {
  // redeem mode: type or paste a purchased gem code, Enter redeems,
  // Esc cancels. codes are long (signed), so Ctrl+V drops focus onto a
  // trap input and lets the native paste land, then we lift the text
  if (redeemMode) {
    if (e.key === "Escape") { redeemMode = false; return; }
    if (e.key === "Enter") {
      const code = redeemBuf;
      redeemMode = false;
      redeemBuf = "";
      tryRedeem(code).then((msg) => {
        bangs.push({ x: winW / 2, y: winH / 2 - 60, life: 2.4, t: msg });
        if (msg.startsWith("+")) sfx.reveal(); else sfx.pop();
      });
      return;
    }
    if (e.key === "Backspace") { redeemBuf = redeemBuf.slice(0, -1); return; }
    if (e.ctrlKey && e.key.toLowerCase() === "v") {
      const trap = document.createElement("input");
      trap.style.cssText = "position:fixed;left:-999px;top:0;opacity:0";
      document.body.appendChild(trap);
      trap.focus();
      setTimeout(() => {
        redeemBuf = (redeemBuf + trap.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")).slice(0, 160);
        trap.remove();
      }, 40);
      return;
    }
    if (/^[a-zA-Z0-9-]$/.test(e.key) && redeemBuf.length < 160) redeemBuf += e.key.toUpperCase();
    return;
  }
  // rename mode: type on the ranch cell's name row, Enter commits, Esc cancels
  if (nameEdit) {
    if (e.key === "Escape") { nameEdit = null; return; }
    if (e.key === "Enter") {
      const id = SPECIES[nameEdit.i].id;
      if (nameEdit.buf.trim()) customNames[id] = nameEdit.buf.trim().slice(0, 10);
      else delete customNames[id];
      nameEdit = null;
      dirty = true;
      sfx.pop();
      return;
    }
    if (e.key === "Backspace") { nameEdit.buf = nameEdit.buf.slice(0, -1); return; }
    if (/^[a-zA-Z0-9 ]$/.test(e.key) && nameEdit.buf.length < 10) nameEdit.buf += e.key.toUpperCase();
    return;
  }
  if (e.key === "Escape") { treatAim = false; settingsOpen = false; gemShop = false; shopMode = false; breedMode = false; accPick = null; infoPick = null; albumOpen = false; if (cardTarget) closeCard(); if (nurseryOpen) toggleNursery(false); }
});

// ---------- clickable regions ----------
setInterval(() => {
  const rects = petHome ? [] : [petRect()];
  { const [fx, fy] = fabPos(); rects.push([fx - 20, fy - 20, 40, 40]); }
  if (fabOpen) for (let k = 0; k < FAB_ITEMS.length; k++) rects.push(fabItemRect(k));
  for (const p of pals) rects.push(palRect(p));
  if (ball) rects.push([ball.x - 14, ball.y - 22, 28, 24]); // the toy is grabbable
  // furniture grab zones — sized to the sprite bounds: top covers the
  // lifted floor position, bottom covers the unlifted overhang on decks
  if (bowl) rects.push([bowl.x - 27, bowl.y - 33, 54, 49]);
  if (cushion) rects.push([cushion.x - 32, cushion.y - 33, 64, 49]);
  if (box) rects.push([box.x - 34, box.y - 33, 68, 49]);
  if (plant) rects.push([plant.x - 24, plant.y - 39, 48, 55]);
  if (music) rects.push([music.x - 26, music.y - 30, 52, 46]);
  if (mirror) rects.push([mirror.x - 26, mirror.y - 42, 52, 58]);
  if (mat) rects.push([mat.x - 34, mat.y - 33, 68, 49]);
  if (jar) rects.push([jar.x - 23, jar.y - 36, 46, 52]);
  if (egg) rects.push([egg.x - 16, egg.y - 36, 32, 52]);      // egg is a promise, not a wall
  if (fabOpen && toyboxOpen) rects.push(toyboxStripRect()); // chooser strip
  if (awayReport) rects.push([Math.round(winW / 2 - 95), 54, 190, 78]);
  if (treatAim || infoPick !== null || albumOpen || redeemMode) rects.push([0, 0, winW, winH]);
  if (settingsOpen) rects.push(settingsRect());
  if (gemShop) rects.push(gemShopRect());
  if (ranchOpen) rects.push([ranch.offsetLeft, ranch.offsetTop, ranch.offsetWidth, ranch.offsetHeight]);
  if (nurseryOpen) rects.push([nursery.offsetLeft, nursery.offsetTop, nursery.offsetWidth, nursery.offsetHeight]);
  if (cardTarget) rects.push([cardEl.offsetLeft, cardEl.offsetTop, cardEl.offsetWidth, cardEl.offsetHeight]);
  invoke("set_clickable", { rects });
}, 250);

// ---------- mood ----------
let sleepMs = 0;
setInterval(() => {
  if (held || flying) return;
  const idleMs = Date.now() - awakeAt;
  const h = new Date().getHours();
  const spsy = PSYCH[(SPECIES[active] || {}).ps] || {};
  // pomodoro phases flip on wall-clock time
  if (pomo && Date.now() > pomoUntil) {
    pomoPhase = pomoPhase === "focus" ? "break" : "focus";
    pomoLen = (pomoPhase === "focus" ? 25 : 5) * 60000;
    pomoUntil = Date.now() + pomoLen;
    bangs.push({ x: petX, y: petY - 100, life: 2, t: pomoPhase === "focus" ? "FOCUS!" : "BREAK!" });
    if (pomoPhase === "focus") sfx.heart(); else sfx.reveal();
  }
  // breaks make it sleepy fast — that's the point
  sleepMs = (h >= 23 || h < 7 ? SLEEP_AFTER / 2 : SLEEP_AFTER) * (spsy.sleep || 1) * (pomo && pomoPhase === "break" ? 0.3 : 1);
  if (idleMs > sleepMs && Date.now() >= noSleepUntil) {
    if (state !== "sleeping") {
      // doze-off breaks any errand in progress — no sleepwalking to a
      // walkTarget picked while still awake. acts die too: a pet that
      // nods off mid-signature stopped moving but kept "performing"
      walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0;
      sigT0 = 0; sigId = null; accAct = null; propSpin = 0;
      danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0;
      spinT0 = 0; huntScore = 0; circScore = 0; petVX = 0;
      // mid-climb / mid-web doze: let go and drop straight down — a
      // sideways drift on a sleeping face read as sleepwalking
      if (climbing) { climbing = false; flying = true; petVY = 50; petVX = 0; }
      if (webbing) { webbing = false; webHeld = false; flying = true; petVY = 40; petVX = 0; }
      climbPhase = 0;
    }
    state = "sleeping";
  }
  else state = "idle";
}, 1000);

// ---------- render ----------
function faceName(now) {
  if (now < splatUntil || now < dizzyUntil) return "dizzy";
  if (climbing) return now % 160 < 80 ? "held1" : "held2";
  if (held) return now < cuddleUntil ? "content" : now < petUntil ? "happy" : now < tickleUntil ? "laugh" : now % 160 < 80 ? "held1" : "held2";
  if (now < shockUntil) return "shock";
  if (now < tickleUntil) return "laugh";
  if (now < annoyedUntil) return "grumpy";
  if (now < starUntil) return "star";
  if (now < winkUntil) return "wink";
  if (now < cryUntil) return "cry";
  if (now < poutUntil) return "pout";
  if (now < smugUntil) return "smug";
  if (now < blepUntil) return "blep";
  if (now < contentUntil) return "content";
  if (state === "grumpy") return "grumpy";
  if (state === "sleeping") return "sleeping";
  if (now < cushionNap) return "sleeping"; // dozing on the cushion
  if (now < munchUntil) return now % 180 < 90 ? "munch" : "chew";
  if (now < blinkUntil) return "blink";
  if (lookDir < 0 && now < lookUntil) return "lookL";
  if (lookDir > 0 && now < lookUntil) return "lookR";
  return "idle";
}
function currentSprite(now) {
  const f = faceName(now);
  // transition beat: a face swap lands a tiny squash, so expressions
  // arrive with a little bodily emphasis instead of a hard cut —
  // repeated alternations (held squirm, munch chew) read as wobble
  if (f !== lastFace) {
    if (lastFace) { faceSwapT = now; squashV += 0.45; }
    lastFace = f;
  }
  return sprite(f, active, false);
}

let prev = performance.now();
// frame wrapper: rAF is re-queued BEFORE the body runs, so a throw can
// never kill the loop — it just skips that frame's tail (which is how a
// render-section error can still leave the screen frozen). catch it,
// log it once per signature to crash.log, keep the loop alive.
const crashSeen = {};
let lastBeat = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    frameBody(now);
  } catch (e) {
    const k = String((e && e.message) || e).slice(0, 100);
    if (!crashSeen[k]) {
      crashSeen[k] = 1;
      try { invoke("log_crash", { msg: "FRAME " + String(e.stack || e).slice(0, 2400) }); } catch {}
    }
  }
  // heartbeat every 20s: if the user reports a freeze and ticks stop,
  // JS was dead; if ticks continue, it was a raster/rAF-side freeze.
  // doubles as the self-heal sweep — cheap sanity so a wedged state
  // never needs a restart
  if (now - lastBeat > 20000) {
    lastBeat = now;
    try { invoke("log_crash", { msg: "tick" }); } catch {}
    // NaN watchdog: a poisoned position makes the pet silently invisible
    // (drawImage(NaN) is a no-op) — that reads as "frozen". snap it back.
    if (!isFinite(petX) || !isFinite(petY) || !isFinite(squash) || !isFinite(squashV)) {
      try { invoke("log_crash", { msg: `NAN-GUARD petX=${petX} petY=${petY} sq=${squash} sqV=${squashV}` }); } catch {}
      petX = winW / 2; petY = winH; petVX = 0; petVY = 0; squash = 0; squashV = 0;
    }
    // offscreen rescue: flung past the frame edge → drop back in view
    if (!petHome && isFinite(petX) && (petX < -140 || petX > winW + 140 || petY < -300 || petY > winH + 240)) {
      try { invoke("log_crash", { msg: `OFFSCREEN petX=${petX} petY=${petY}` }); } catch {}
      petX = Math.max(80, Math.min(winW - 80, petX));
      petY = Math.min(Math.max(petY, 120), winH - 80);
      petVX = 0; petVY = 0; flying = true; accAct = null; propSpin = 0;
    }
    // wedged act: a routine older than 12s (all scripts end ≤ 6s) is a
    // stuck step-runner — drop it so the next routine can roll
    if (accAct && now - accAct.t0 > 12000) {
      try { invoke("log_crash", { msg: `ACT-WEDGED id=${accAct.id}` }); } catch {}
      accAct = null; propSpin = 0;
    }
    if (!accAct && propSpin !== 0) propSpin = 0; // stray blades parked
    if (sigT0 && now - sigT0 > 20000) { sigT0 = 0; sigInit = 0; try { invoke("log_crash", { msg: `SIG-WEDGED id=${sigId}` }); } catch {} }
    // stuck-grab watchdog: if a pointerup is ever lost (capture dropped,
    // click-through flip mid-gesture) the held flag would pin DRAGGING on
    // forever and the overlay would eat every click — looks like a freeze.
    // 20s of uninterrupted hold is longer than any real gesture here
    if ((held || palHeld || ballHeld || propHeld || fabDrag || volDrag) && grabT0 && now - grabT0 > 20000) {
      try { invoke("log_crash", { msg: `GRAB-STUCK held=${held} pal=${!!palHeld} ball=${ballHeld} prop=${propHeld} fab=${!!fabDrag} vol=${!!volDrag}` }); } catch {}
      held = false; palHeld = null; ballHeld = false; propHeld = null; fabDrag = null; volDrag = null;
      cv.style.cursor = "default";
      try { invoke("set_dragging", { on: false }); } catch {}
    }
    if (spinT0 && now - spinT0 > 4000) spinT0 = 0;
    for (const p of pals) {
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.squash)) {
        try { invoke("log_crash", { msg: `NAN-PAL sp=${p.sp} x=${p.x} y=${p.y} sq=${p.squash}` }); } catch {}
        p.x = winW / 2; p.y = winH; p.vx = 0; p.vy = 0; p.squash = 0; p.squashV = 0;
      } else if (p.x < -140 || p.x > winW + 140 || p.y < -300 || p.y > winH + 240) {
        try { invoke("log_crash", { msg: `PAL-OFFSCREEN sp=${p.sp} x=${p.x} y=${p.y}` }); } catch {}
        p.x = Math.max(80, Math.min(winW - 80, p.x)); p.y = winH - 60;
        p.vx = 0; p.vy = 0; p.fly = true; p.accAct = null;
      }
      if (p.accAct && now - p.accAct.t0 > 8000) p.accAct = null;
    }
    // furniture anchored to a platform object from an old poll re-snaps
    // to the nearest live deck instead of floating where it vanished
    for (const q of [bowl, cushion, egg]) {
      if (q && q.plat && !plats.includes(q.plat) && !monPlats.includes(q.plat)) {
        const live = platUnder(q.x, q.y) || plats[0];
        if (live) { q.plat = live; q.y = live.y; q.x = Math.max(live.x + 26, Math.min(live.x + live.w - 26, q.x)); }
      }
    }
    if (ball && (!isFinite(ball.x) || !isFinite(ball.y))) {
      try { invoke("log_crash", { msg: `NAN-BALL x=${ball.x} y=${ball.y}` }); } catch {}
      ball.x = winW / 2; ball.y = 60; ball.vx = 0; ball.vy = 0;
    }
    // memory caps: particle arrays only grow via bugs — trim the oldest
    if (fx.length > 420) fx.splice(0, fx.length - 420);
    if (bangs.length > 90) bangs.splice(0, bangs.length - 90);
    if (hearts.length > 50) hearts.splice(0, hearts.length - 50);
    if (ripples.length > 70) ripples.splice(0, ripples.length - 70);
  }
}
function frameBody(now) {
  // deep-idle throttle: pet is home, no companions, nothing animated,
  // no UI — the scene is static, so run at quarter rate and save the
  // battery. `prev` stays current so the next live frame gets a sane dt
  const deepIdle = petHome && !pals.length && !ball && !snack && !treat && !treatFly &&
    !hearts.length && !fx.length && !bangs.length && !zzzs.length && !crumbs.length &&
    !ripples.length && !gravRings.length && !egg && !sigT0 &&
    !settingsOpen && !ranchOpen && !gemShop && !albumOpen && !cardTarget &&
    !nurseryOpen && !awayReport && !redeemMode && !treatAim;
  if (deepIdle) {
    idleSkip = (idleSkip + 1) & 3;
    if (idleSkip) { prev = now; return; }
  } else idleSkip = 0;
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  const t = now / 1000;
  // petBusy: a cushion nap or a box hide both park the slime — no AI,
  // no movement, no acts until it's back out
  const petBusy = now < cushionNap || now < boxHide;
  // a pet hiding in the box rides it — dragging the box used to leave the
  // hidden pet behind, then it popped out where the box no longer was
  if (now < boxHide && box) petX = box.x;

  // jelly spring: slower + looser than a rigid bounce — the squash unfolds
  // over ~100ms and keeps a little overshoot instead of snapping flat
  squashV += (-95 * squash - 6.5 * squashV) * dt;
  squash += squashV * dt;

  // verlet-lite side jiggle: a second spring tracks horizontal velocity
  // so the blob's top lags behind its feet — acceleration shears the
  // silhouette like real fat. driven by actual petX delta so walking,
  // flying and being dragged all feed it
  {
    const vxe = (petX - jigPX) / Math.max(dt, 0.001);
    jigPX = petX;
    jigV += (vxe * 0.0011 - jigX * 70 - jigV * 6.5) * dt;
    jigX = Math.max(-0.4, Math.min(0.4, jigX + jigV * dt));
  }

  if (now >= nextBlink) {
    const ap = animProf(active);
    blinkUntil = now + ap.blinkLen;
    nextBlink = now + ap.blink + Math.random() * 1600;
  }

  const { w: bw, h: bh, scale } = blobSize();

  // support platform under the pet
  const sup = plats.find(
    (p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14
  ) || platUnder(petX, petY);

  // platform bounds live at frame scope — signature acts (rollout,
  // frenzy, umbral) clamp with them too; they used to be declared
  // inside the wander block which crashed those acts outright
  const lo = Math.max(40, sup.x + 30);
  const hi = Math.min(winW - 40, sup.x + sup.w - 30);

  const onGround = !held && !flying && !webbing && !petHome;

  // window surf: if the platform under the pet slid sideways between
  // platform polls, the pet rides it — dragged along the title bar with
  // a wobble (jigX picks up the injected velocity for the shear too)
  if (onGround && prevSupY && Math.abs(sup.y - prevSupY) < 10 && now >= boxHide) {
    const wdx = sup.x - prevSupX;
    if (wdx !== 0 && Math.abs(wdx) < 400) {
      // a sliding ride jolts a sleeper awake — otherwise it surfed the
      // title bar with its eyes closed, which read as sleepwalking
      if (Math.abs(wdx) > 10 && (state === "sleeping" || now < cushionNap)) {
        awakeAt = Date.now(); cushionNap = 0; cushionNapW = 0;
        shockUntil = now + 600;
        bangs.push({ x: petX, y: petY - bh - 14, life: 0.9, t: "!" });
      }
      petX += wdx;
      rideWob = Math.min(1, rideWob + Math.abs(wdx) / 50);
      if (Math.abs(wdx) > 12) squashV += 0.45;
      if (Math.abs(wdx) > 34 && Math.random() < dt * 2) shockUntil = now + 700;
    }
  }
  prevSupX = sup.x; prevSupY = sup.y;
  rideWob *= Math.pow(0.4, dt); // decays fast once the window stops

  const sp = SPECIES[active];
  const psy = PSYCH[sp.ps] || {};
  // a bred hybrid celebrates growing up once it outlives the baby window
  if (sp.id.startsWith("hyb") && sp.bornAt) {
    if (isBaby(sp)) sp._wasBaby = true;
    else if (sp._wasBaby) {
      sp._wasBaby = false;
      bangs.push({ x: petX, y: petY - 96, life: 2, t: "GROWN UP" });
      squashV += 8;
      sfx.reveal();
    }
  }

  // cursor speed decays when no fresh cursor event arrives (backend only
  // emits on >3px moves) — otherwise a parked cursor re-triggers startle
  if (now - lastCurT > 200) { curV = 0; curVX = 0; }

  // ---- organic life-layer ----
  // energy drifts like a mood tide: high = bouncy/playful, low = lazy.
  // it wanders on its own so behavior clusters into lively and lazy
  // phases instead of a perfectly even random soup
  energy += energyDir * dt * (0.04 + Math.random() * 0.05);
  if (energy > 1) { energy = 1; energyDir = -1; }
  else if (energy < 0.15) { energy = 0.15; energyDir = 1; }
  ignoreT += dt;

  const cdist = Math.hypot(curX - petX, curY - (petY - bh / 2));

  // sleeping pets stir when the cursor gets really close — half-open
  // eyes for a beat, then settle back unless it lingers closer still
  if (state === "sleeping" && cdist < 150 && now > stirT) {
    stirT = now + 2400;
    // waking to a friendly face: a beat of surprise, then content
    if (cdist < 85) { awakeAt = Date.now(); contentUntil = now + 1700; bangs.push({ x: petX, y: petY - bh - 14, life: 0.9, t: "!?" }); }
    else { squashV += 2; fx.push({ x: petX + (Math.random() * 20 - 10), y: petY - 10, vx: 0, vy: -14, life: 0.6, c: "#b8c4d4" }); }
  }

  // look toward the cursor when it is near — radius scales with rarity
  // so legendaries track you from farther away
  if (onGround && state === "idle" && !petBusy) {
    const lookR = 280 + sp.r * 70;
    if (cdist < lookR) {
      lookDir = Math.sign(curX - petX) || 0;
      lookUntil = now + 300;
      // the pet NOTICES a cursor that lingers: first a glance, then a
      // small reaction — this is the "it's alive" beat users were missing
      if (cdist < 150 && curV < 200) {
        noticeT += dt;
        if (noticeT > 1.1 && now > noticeCd) {
          noticeCd = now + 6000;
          noticeT = 0;
          // per-species glee tilts the reaction: giddy species favor
          // hearts, deadpan ones favor the curious "?" — same species
          // keeps a consistent personality across sessions
          const nr = Math.random() + (animProf(active).glee - 0.5) * 0.5;
          if (nr < 0.4) { squashV += 3.5; sfx.pop(); }                    // curious bounce
          else if (nr < 0.7) { hearts.push({ x: petX + 16, y: petY - 66, life: 1 }); sfx.heart(); }
          else { bangs.push({ x: petX, y: petY - bh - 14, life: 0.9, t: "?" }); }
        }
      } else noticeT = Math.max(0, noticeT - dt * 2);
    } else {
      noticeT = 0;
      if (now >= nextLook) {
        lookDir = Math.random() < 0.5 ? -1 : 1;
        lookUntil = now + 900 + Math.random() * 900;
        nextLook = now + 3000 + Math.random() * 3000;
      }
    }
    // a quick glance when the cursor sweeps past fast, even out of range
    if (cdist >= lookR && cdist < 620 && curV > 900 && now > lookUntil) {
      lookDir = Math.sign(curVX) || lookDir;
      lookUntil = now + 400;
    }
    // startle: fast cursor rush near the pet -> hop away
    if (!sigT0 && curV > 1400 / (psy.startle || 1) && cdist < 180 && now > shockUntil - 300) {
      flying = true;
      petVX = (petX < curX ? -1 : 1) * (110 + Math.random() * 70);
      petVY = -(190 + Math.random() * 90);
      shockUntil = now + 700;
      walkTarget = null;
      sfx.shock();
    }
    // cursor hunt: a swishing cursor reads as prey. prey-drive builds
    // while it whips around nearby, then the pet stalks and pounces.
    // follow-hungry personalities hunt the most; lazy phases just watch
    if (!sigT0 && !huntT0 && !huntPounce && now > huntCd && now > begUntil && now > shockUntil && cdist < 500 && curV > 400) {
      huntScore += dt * (psy.follow || 1) * (energy > 0.45 ? 1 : 0.35);
      if (huntScore > 0.35) {
        huntScore = 0;
        huntT0 = now;
        walkTarget = null;
        hopTarget = null;
        hopWind = 0;
        sfx.pop();
      }
    } else huntScore = Math.max(0, huntScore - dt * 2.5);
    // hunt stalk: haunches drop, butt-wiggles while it tracks the cursor,
    // then the pounce — led at where the cursor is heading, not where it was
    if (huntT0) {
      const hEl = now - huntT0;
      // a signature act or leaving the ground aborts the stalk
      if (!sigT0 && onGround && hEl < 400) {
        sitUntil = now + 120;
        squashV += Math.sin(hEl / 46) * 0.09;
        lookDir = Math.sign(curX - petX) || lookDir;
        lookUntil = now + 120;
      } else {
        huntT0 = 0;
        huntCd = now + 8000 + Math.random() * 6000;
        if (!sigT0 && onGround && hEl < 1500) {
          flying = true;
          huntPounce = true;
          const dxh = Math.max(-340, Math.min(340, curX + curVX * 0.28 - petX));
          petVX = dxh * 2.6;
          petVY = -(230 + Math.min(170, Math.abs(dxh) * 0.55)) * animProf(active).arc;
          sfx.boing();
          // nearby pals join the hunt — a chase pack hopping after the
          // same cursor with a lighter arc. ~40% sit it out
          for (const p of pals) {
            if (p === palHeld || p.fly || now < p.web || p.stackOn || p.tag || now < p.restUntil) continue;
            if (Math.abs(p.x - petX) > 340 || Math.random() > 0.6) continue;
            p.fly = true;
            p.walkT = null;
            p.vx = Math.max(-220, Math.min(220, (curX - p.x) * 1.8));
            p.vy = -(150 + Math.random() * 90);
            p.faceId = "happy";
            p.faceT = now + 1000;
          }
        }
      }
    }
    // attention-seek: ignored too long while you hover nearby — it
    // walks over and begs under your cursor. the loneliness payoff
    if (!sigT0 && ignoreT > 75 && cdist < 700 && cdist > 60 && walkTarget === null &&
        hopTarget === null && !psy.flee && Math.random() < dt * 0.5 * (psy.follow || 1)) {
      walkTarget = Math.max(lo, Math.min(hi, curX));
      walkSpd = 55 * (psy.spd || 1) * (isBaby(sp) ? 0.8 : 1) * (now < hyperUntil ? 1.5 : 1);
      begUntil = now + 4000;
      ignoreT = 0;
    }
    // tuck-in: a cursor parked for 5+ minutes looks asleep, so the pet
    // waddles over and tucks it in — wholesome clip bait
    if (!sigT0 && !blanketT0 && state === "idle" && !petBusy && now - lastCurMove > 300000 && now > blanketCd &&
        curX > 40 && curX < winW - 40 && cdist > 80 && cdist < 900 &&
        walkTarget === null && hopTarget === null && Math.random() < dt * 0.8) {
      walkTarget = Math.max(lo, Math.min(hi, curX));
      walkSpd = 50 * (psy.spd || 1) * (isBaby(sp) ? 0.8 : 1);
      blanketT0 = now;
    }
    // arriving: drop the quilt just under the cursor, sit a beat, done
    if (blanketT0) {
      if (now - lastCurMove < 3000) blanketT0 = 0; // cursor woke up — abort
      else if (Math.abs(curX - petX) < 46) {
        blanketT0 = 0;
        blanketX = curX; blanketY = curY + 20;
        blanketUntil = now + 9000;
        blanketCd = now + 10 * 60000;
        sitUntil = now + 1400;
        hearts.push({ x: curX + 8, y: curY - 18, life: 1.4 });
        bangs.push({ x: curX, y: curY - 46, life: 1.6, t: "TUCKED IN" });
        sfx.heart();
      }
    }
    // begging under the cursor: sits, looks up, waves a little paw —
    // a heart if you finally pet it (the reward loop)
    if (!sigT0 && now < begUntil && cdist < 90) {
      walkTarget = null;
      sitUntil = now + 400;
      lookDir = Math.sign(curX - petX) || lookDir;
      lookUntil = now + 300;
      if (Math.random() < dt * 2.4) squashV += 1.6; // paw-wiggle bounce
      if (Math.random() < dt * 0.7) bangs.push({ x: petX + (Math.random() * 30 - 15), y: petY - bh - 8, life: 0.8, t: Math.random() < 0.5 ? "♥" : "!" });
    }
    // a cursor parked beside the pet earns its attention — it pauses what
    // it's doing and glances over (climbing ON the cursor was cut: janky)
    if (!sigT0 && !huntT0 && !huntPounce && onGround && now > petUntil) {
      if (cdist < 140 && curV < 120) {
        walkTarget = null;
        hopTarget = null;
        hopWind = 0;
        lookDir = Math.sign(curX - petX) || lookDir;
        lookUntil = now + 300;
      }
    }
    // boop: a cursor slowly pressing INTO the body is a shove — it
    // squirms, then hops back a step with a pout. personal space!
    if (cdist < 55 && curV > 30 && curV < 400) {
      boopT += dt;
      squashV += Math.sin(now / 60) * 0.06; // uncomfortable wriggle
      lookDir = Math.sign(curX - petX) || lookDir;
      lookUntil = now + 200;
      if (boopT > 1.2) {
        boopT = 0;
        flying = true;
        petVY = -170;
        petVX = Math.sign(petX - curX || 1) * 140;
        poutUntil = now + 1300;
        bangs.push({ x: petX, y: petY - bh - 14, life: 0.9, t: "!" });
        sfx.pop();
      }
    } else boopT = Math.max(0, boopT - dt * 2);
    // scritch: sweeping the cursor back and forth over the body without
    // clicking is petting — three direction flips and it melts
    if (cdist < 65 && curV > 150 && curV < 1400 && now > rubCd) {
      const rd = Math.sign(curVX);
      if (rd && rd !== rubDir) { rubDir = rd; rubCount++; }
      if (rubCount >= 3) {
        rubCount = 0;
        rubCd = now + 3500;
        contentUntil = now + 2400;
        petUntil = now + 900;
        squashV += 4;
        hearts.push({ x: petX + (Math.random() * 20 - 10), y: petY - 62, life: 1.1 });
        if (Math.random() < 0.4) bangs.push({ x: petX, y: petY - bh - 12, life: 0.9, t: "♪" });
        sfx.heart();
      }
    } else { rubCount = Math.max(0, rubCount - dt * 2); if (!rubCount) rubDir = 0; }
    // cursor circle trick: swirling loops around the pet winds it up —
    // complete a loop and it can't help but spin, then wobbles off dizzy
    if (!sigT0 && now > circCd && cdist > 90 && cdist < 300 && curV > 420) {
      const ang = Math.atan2(curY - (petY - bh / 2), curX - petX);
      if (circAng !== null) {
        let da = ang - circAng;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 1.2) circScore += da; // ignore mouse teleports
        if (Math.abs(circScore) > 5.2) {
          circScore = 0;
          circCd = now + 9000;
          spinT0 = now;
          dizzyUntil = now + 1600;
          squashV += 5;
          bangs.push({ x: petX, y: petY - bh - 14, life: 1.3, t: "WHEE!" });
          sfx.boing();
        }
      }
      circAng = ang;
    } else { circAng = null; circScore *= Math.pow(0.1, dt); }
    // legendary idle flourish: while it's just standing around, each
    // legendary species periodically does its own signature micro-act —
    // that's the whole point of being legendary (legFlair in helpers).
    if (sp.r >= 3 && !sigT0 && walkTarget === null && hopTarget === null &&
        !huntT0 && !huntPounce && !blanketT0 &&
        now > legFlairT) {
      legFlairT = now + (5200 + Math.random() * 4200) * (psy.pace || 1);
      legFlair(sp, now);
    }
  }

  // hold-cuddle: a grabbed slime that stops being shaken melts into the
  // palm — flailing stops, content face, a heart. hold still ~1.2s
  if (held && !webHeld && Math.hypot(dragVX, dragVY) < 80) {
    cuddleT += dt;
    if (cuddleT > 1.2 && now > cuddleUntil) {
      cuddleT = 0;
      cuddleUntil = now + 2200;
      contentUntil = now + 2000;
      hearts.push({ x: petX + 10, y: petY - 60, life: 1.1 });
      squashV += 3;
      if (Math.random() < 0.5) sfx.heart();
    }
  } else cuddleT = 0;

  // autonomous behaviors. higher rarity = more proactive: rare+ seeks the
  // cursor, epic+ dances/spins, legendaries run, climb walls and hunt snacks
  // !sigT0: no wander/follow decisions while a signature act is live —
  // mid-act rolls could re-trigger it and follow kept injecting
  // walkTarget, which read as stuttering during the performance
  if (onGround && !climbing && state === "idle" && !sigT0 && !petBusy) {
    const baseSpd = 55 * (psy.spd || 1) * (isBaby(sp) ? 0.8 : 1) * (now < hyperUntil ? 1.5 : 1);
    if (climbPhase === 1) {
      const dx = climbEdge - petX;
      if (Math.abs(dx) < 34) {
        climbPhase = 0;
        climbing = true;
        climbUntil = now + 3200;
        sfx.pop();
      } else {
        petX += Math.sign(dx) * 70 * dt;
        lookDir = Math.sign(dx);
        lookUntil = now + 200;
      }
    } else if (snack && state !== "sleeping" && !petBusy) {
      const dx = snack.x - petX;
      if (Math.abs(dx) < 20) {
        // CHOMP: eat the desktop file
        const sy2 = snack.y;
        snack = null;
        munchUntil = now + 600;
        contentUntil = now + 2200;
        bondGain(SPECIES[active].id, 3); // fed a snack — the good stuff
        jelly += 1;
        starUntil = now + 900;
        dirty = true;
        squashV += 5;
        sfx.munch();
        setTimeout(() => sfx.munch(), 140);
        setTimeout(() => sfx.pop(), 320);
        for (let i = 0; i < 8; i++) {
          fx.push({ x: petX + Math.random() * 40 - 20, y: sy2 - Math.random() * 30 - 6, vx: Math.random() * 90 - 45, vy: -Math.random() * 70, life: 0.8, c: "#e8e0c8" });
        }
        bangs.push({ x: petX + 16, y: sy2 - 60, life: 1, t: "💎" });
      } else {
        petX += Math.sign(dx) * 160 * dt;
        lookDir = Math.sign(dx);
        lookUntil = now + 200;
        munchUntil = now + 120;
        if (Math.random() < dt * 8) fx.push({ x: petX, y: petY - 6, vx: -Math.sign(dx) * 30, vy: -20, life: 0.5, c: "#b84055" });
      }
    } else if (treatAim && state !== "sleeping" && !petBusy && curX > -9000 && cdist < 560) {
      // fishing: while a treat is aimed, the cursor IS the snack — the
      // pet drools and shadows it until you click to drop the real thing
      const dx = curX - petX;
      walkTarget = null;
      if (Math.abs(dx) > 20) {
        petX += Math.sign(dx) * Math.min(150 * (psy.spd || 1), Math.abs(dx) * 3) * dt;
        lookDir = Math.sign(dx);
        lookUntil = now + 250;
        if (now > stepDustT) { stepDustT = now + 260; fx.push({ x: petX - Math.sign(dx) * 12, y: sup.y - 3, vx: -Math.sign(dx) * 10, vy: -10, life: 0.4, c: "#c8b8a0" }); }
      }
      munchUntil = now + 120;
      if (Math.random() < dt * 0.5) bangs.push({ x: petX + 14, y: petY - bh - 8, life: 0.8, t: "♥" });
    } else if (danceT0 && now - danceT0 < 1700) {
      contentUntil = now + 300;
      if (sp.r >= 2 && Math.random() < dt * 2.5) {
        bangs.push({ x: petX + Math.random() * 50 - 25, y: petY - bh - 8, life: 1, t: "♪" });
      }
      if (sp.r >= 3 && Math.random() < dt * 1.2) {
        fx.push({ x: petX + Math.random() * 40 - 20, y: petY - 10, vx: 0, vy: -40, life: 0.8, c: "#ffd75e" });
      }
    } else if (sitUntil > now) {
      if (now > lookFlipT) {
        lookDir = Math.random() < 0.5 ? -1 : 1;
        lookUntil = now + 600;
        lookFlipT = now + 900 + Math.random() * 500;
      }
    } else if (hopTarget !== null) {
      const dx = hopTarget - petX;
      if (Math.abs(dx) < 14) {
        hopTarget = null;
        squashV += 3;
      } else if (!hopWind) {
        // anticipation: a quick crouch sells the leap (animation principle)
        hopWind = now + 120;
        squashV += 5;
      } else if (now >= hopWind) {
        hopWind = 0;
        flying = true;
        petVY = -260 * animProf(active).hop * animProf(active).arc;
        petVX = Math.sign(dx) * Math.min(260, Math.abs(dx) * 4);
        lookDir = Math.sign(dx);
        lookUntil = now + 400;
      }
    } else if (walkTarget !== null) {
      const dx = walkTarget - petX;
      if (Math.abs(dx) < 8) {
        walkTarget = null;
        petSpd = 0;
        if (walkSpd !== baseSpd && !treat) followCd = now + 4000;
        walkSpd = baseSpd;
        squashV += 3;
        if (walkGoal) { const g = walkGoal; walkGoal = null; propArrive(g, now); }
      } else if (sp.mv === "hop") {
        // frogs bounce instead of walking — crouch, then a little leap
        lookDir = Math.sign(dx);
        lookUntil = now + 300;
        if (!hopWind) { hopWind = now + 110; squashV += 4; }
        else if (now >= hopWind) {
          hopWind = 0;
          flying = true;
          petVY = -230 * animProf(active).hop;
          petVX = Math.sign(dx) * Math.min(240, Math.abs(dx) * 3.2);
          munchUntil = now + 120;
        }
      } else if (sp.mv === "blink") {
        // Stella moves in little teleports instead of walking
        lookDir = Math.sign(dx);
        lookUntil = now + 200;
        if (now > blinkStepT) {
          blinkStepT = now + 380;
          for (let i = 0; i < 5; i++) fx.push({ x: petX + (Math.random() - 0.5) * 24, y: petY - Math.random() * 34, vx: 0, vy: -18, life: 0.5, c: "#9aadff" });
          // stella's teleports pop a little star where she vanishes
          if (LEG[sp.id] && LEG[sp.id].starburst) bangs.push({ x: petX, y: petY - 40, life: 0.5, t: "✦" });
          petX = Math.max(lo, Math.min(hi, petX + Math.sign(dx) * Math.min(36, Math.abs(dx))));
          for (let i = 0; i < 5; i++) fx.push({ x: petX + (Math.random() - 0.5) * 24, y: petY - Math.random() * 34, vx: 0, vy: -18, life: 0.5, c: "#9aadff" });
          squashV += 1.2;
        }
      } else if (sp.mv === "scurry") {
        // dart-pause-dart: fast skitters, then a beat frozen mid-step
        lookDir = Math.sign(dx);
        lookUntil = now + 160;
        if ((now + active * 137) % 760 < 280) {
          petX += Math.sign(dx) * walkSpd * 2.7 * dt;
          munchUntil = now + 80;
        }
      } else if (sp.mv === "hover") {
        // frictionless glide: accelerates out, eases into the target
        petX += Math.sign(dx) * Math.min(walkSpd * 1.4, Math.abs(dx) * 2.6 + 20) * dt;
        lookDir = Math.sign(dx);
        lookUntil = now + 260;
      } else {
        // skid: a direction flip at speed kicks up dust AND costs a beat —
        // the blob stalls ~95ms turning around, which reads as weight far
        // better than teleporting its velocity
        const wsign = Math.sign(dx);
        if (wsign !== walkDirPrev && walkDirPrev !== 0 && petSpd > 45) {
          squashV += 1.6;
          turnPause = now + 95;
          for (let k = 0; k < 3; k++) fx.push({ x: petX - wsign * 12, y: sup.y - 4, vx: -wsign * (30 + Math.random() * 40), vy: -20 - Math.random() * 25, life: 0.5, c: "#c8b8a0" });
        }
        walkDirPrev = wsign;
        if (now < turnPause) {
          // mid-turn: bleed speed, face the new way, don't move yet
          petSpd = Math.max(0, petSpd - dt * 900);
          lookDir = wsign;
          lookUntil = now + 150;
        } else {
        // ease into the walk — instant full speed made every stride pop
        petSpd = Math.min(petSpd + dt * 420, walkSpd);
        petX += Math.sign(dx) * petSpd * dt;
        lookDir = Math.sign(dx);
        lookUntil = now + 200;
        // gait: distance-driven step cycle — each "footfall" dips the blob
        // a touch, so the bounce tempo follows the real speed, not a clock
        gaitPhase += petSpd * dt * 0.14;
        const gs = Math.floor(gaitPhase / Math.PI);
        if (gs !== gaitStep) { gaitStep = gs; squashV += 0.35; }
        }
        // footstep dust puffs while actually walking
        if (now > stepDustT) { stepDustT = now + 240; fx.push({ x: petX - Math.sign(dx) * 14, y: sup.y - 3, vx: -Math.sign(dx) * 14, vy: -12, life: 0.4, c: "#c8b8a0" }); }
        if (walkSpd > 120 && sp.r >= 3 && Math.random() < dt * 10) {
          fx.push({ x: petX - Math.sign(dx) * 20, y: petY - 14, vx: -Math.sign(dx) * 40, vy: -15, life: 0.5, c: "#ffd75e" });
        }
      }
    } else if (
      !accAct && state !== "sleeping" && !petBusy &&
      curV < 300 && Math.abs(curX - petX) > 48 && cdist < (
        sp.r >= 1 ? [0, 240, 420, 700][sp.r] * (psy.follow || 1) * (now > followCd ? 1 : 0)
                  : 160 * (psy.follow || 1)
      )
    ) {
      // a sig-capable pet sometimes pauses mid-pursuit to show off —
      // legendaries chase the cursor for minutes straight otherwise
      // and their signature act never gets a turn
      if (state !== "sleeping" && !petBusy && sp.sig && !isBaby(sp) && Math.random() < dt * 0.07) {
        sigId = sp.sig;
        sigT0 = now;
        sigInit = 0;
        walkTarget = null;
        hopTarget = null;
        hopWind = 0;
        sigWow(now, sp, petX, petY);
      } else if (psy.flee) {
        // shy: edge away from the cursor instead of toward it
        walkTarget = Math.max(lo, Math.min(hi, petX + Math.sign(petX - curX || 1) * 140));
        walkSpd = baseSpd * 1.2;
      } else {
        // rare+ proactively approaches the cursor; legendary runs;
        // commons amble over slowly when you're really close
        walkTarget = Math.max(lo, Math.min(hi, curX));
        walkSpd = [35, 60, 100, 220][sp.r] * (psy.spd || 1);
      }
    } else if (now >= nextWander && !accAct && !petBusy) {
      const roll = Math.random();
      const dir = Math.random() < 0.5 ? -1 : 1;
      const tx = Math.max(lo, Math.min(hi, petX + dir * (50 + Math.random() * 130)));
      // focused-app mood: editors keep it calm, media/games make it playful
      const fk = focusKind();
      const sitB = fk === "editor" ? 0.08 : 0;
      const danceB = fk === "media" || fk === "game" ? 0.08 : 0;
      // signature acts roll their own dice — before this, the wander
      // chain's trait branches (climb/chomp/web) starved them to ~3%
      // and even plain species only reached the sig slot ~11% of rolls
      const sigGo = state !== "sleeping" && !petBusy && sp.sig && !isBaby(sp) && Math.random() < 0.16;
      // egg curiosity trumps the usual roll — a fresh egg on the deck
      // is news, and news gets investigated right away
      if (egg && state !== "sleeping" && !petBusy && Math.abs(egg.y - sup.y) < 16 && Math.abs(egg.x - petX) > 46 &&
          now > egg.t0 + 4000 && !walkGoal) {
        walkTarget = Math.max(lo, Math.min(hi, egg.x + (petX < egg.x ? -16 : 16)));
        walkSpd = baseSpd;
        walkGoal = { kind: "egg", tx: walkTarget };
      } else if (sigGo) {
        sigId = sp.sig;
        sigT0 = now;
        sigInit = 0;
        walkTarget = null;
        hopTarget = null;
        hopWind = 0;
        sigWow(now, sp, petX, petY);
      } else if (roll < 0.28) {
        // ledge-hop: ~15% of walks instead aim at a neighboring platform's
        // near edge (within 300px horizontally, +-120px vertically)
        let hopX = null;
        if (Math.random() < 0.15) {
          let bd = 1e9;
          for (const p of plats) {
            if (p === sup || Math.abs(p.y - sup.y) > 120) continue;
            const ex = petX > p.x + p.w / 2 ? p.x + p.w - 30 : p.x + 30;
            const d = Math.abs(ex - petX);
            if (d > 40 && d <= 300 && d < bd) { bd = d; hopX = ex; }
          }
        }
        if (hopX !== null) hopTarget = hopX;
        else { walkTarget = tx; walkSpd = baseSpd; }
      }
      else if (roll < 0.44) hopTarget = tx;
      else if (roll < 0.56 + sitB) { sitUntil = now + 2000 + Math.random() * 2000; lookFlipT = now; }
      else if (roll < 0.66) stretchUntil = now + 700;
      else if (roll < 0.78 + danceB) { danceT0 = now; sfx.heart(); }
      else if (roll < 0.9 && sp.trait === "climb" && !isBaby(sp)) { climbPhase = 1; climbEdge = petX < winW / 2 ? 24 : winW - 24; }
      else if (roll < 0.9 && sp.trait === "chomp" && !isBaby(sp)) {
        const sx2 = Math.max(lo + 30, Math.min(hi - 30, petX + dir * (120 + Math.random() * 180)));
        snack = { x: sx2, y: sup.y, kind: Math.random() < 0.5 ? "file" : "folder", t0: now };
      }
      else if (roll < 0.9 && sp.trait === "web" && !isBaby(sp) && now > webCd && curX > -9000 &&
               Math.hypot(curX - petX, curY - petY) < 480) {
        // silk line to the cursor: dangle a few seconds, then drop free
        webbing = true;
        webUntil = now + 4200 + Math.random() * 3200;
        webAng = Math.sign(petX - curX || 1) * 0.35;
        webAngV = 0;
        webT0 = now; webFromX = petX; webFromY = petY;
        webLen = 92; webIdleT = 0;
        walkTarget = null; hopTarget = null;
        sfx.pop();
      }
      else if (roll < 0.95) {
        // signature acts moved to their own dice (sigGo above) — this
        // slot is just the generic spin/sit now
        if (sp.r >= 2) { if (reduceMotion) danceT0 = now; else spinT0 = now; }
        else sitUntil = now + 1500;
      }
      else if (roll < 0.98 && ball && !ballHeld && Math.abs(ball.y - sup.y) < 16) {
        // ball interest: stroll over and give it a shove
        walkTarget = Math.max(lo, Math.min(hi, ball.x + (petX < ball.x ? -22 : 22)));
        walkSpd = baseSpd;
      }
      else if (roll < 0.988 && bowl && Math.abs(bowl.y - sup.y) < 16 && now > bowlCd && Math.abs(bowl.x - petX) > 70) {
        // hungry amble: stroll over to the bowl for a little snack
        walkTarget = Math.max(lo, Math.min(hi, bowl.x + (petX < bowl.x ? -18 : 18)));
        walkSpd = baseSpd;
        walkGoal = { kind: "bowl", tx: walkTarget };
      }
      else if (roll < 0.996 && cushion && Math.abs(cushion.y - sup.y) < 16 && now > cushionCd && Math.abs(cushion.x - petX) > 50) {
        // sleepy amble: stroll to the cushion and plop down on it
        walkTarget = Math.max(lo, Math.min(hi, cushion.x));
        walkSpd = baseSpd * 0.8;
        walkGoal = { kind: "cushion", tx: walkTarget };
      }
      else if (roll < 0.999) {
        // rare prop whims — the box, the plant, the music box each get
        // their own little ritual when they're on this deck and rested
        const propPick = Math.random();
        if (propPick < 0.28 && box && Math.abs(box.y - sup.y) < 16 && now > boxCd && Math.abs(box.x - petX) > 60) {
          walkTarget = Math.max(lo, Math.min(hi, box.x + (petX < box.x ? -10 : 10)));
          walkSpd = baseSpd * 0.9;
          walkGoal = { kind: "box", tx: walkTarget };
        } else if (propPick < 0.5 && plant && Math.abs(plant.y - sup.y) < 16 && now > plantCd && Math.abs(plant.x - petX) > 50) {
          walkTarget = Math.max(lo, Math.min(hi, plant.x + (petX < plant.x ? -16 : 16)));
          walkSpd = baseSpd * 0.8;
          walkGoal = { kind: "plant", tx: walkTarget };
        } else if (propPick < 0.7 && music && Math.abs(music.y - sup.y) < 16 && now > musicCd && Math.abs(music.x - petX) > 50) {
          walkTarget = Math.max(lo, Math.min(hi, music.x + (petX < music.x ? -20 : 20)));
          walkSpd = baseSpd;
          walkGoal = { kind: "music", tx: walkTarget };
        } else if (propPick < 0.82 && mirror && Math.abs(mirror.y - sup.y) < 16 && now > mirrorCd && Math.abs(mirror.x - petX) > 55) {
          walkTarget = Math.max(lo, Math.min(hi, mirror.x + (petX < mirror.x ? -26 : 26)));
          walkSpd = baseSpd * 0.85;
          walkGoal = { kind: "mirror", tx: walkTarget };
        } else if (propPick < 0.91 && mat && Math.abs(mat.y - sup.y) < 16 && now > matCd && Math.abs(mat.x - petX) > 55) {
          walkTarget = Math.max(lo, Math.min(hi, mat.x));
          walkSpd = baseSpd * 1.1;
          walkGoal = { kind: "mat", tx: walkTarget };
        } else if (jar && Math.abs(jar.y - sup.y) < 16 && now > jarCd && Math.abs(jar.x - petX) > 50) {
          walkTarget = Math.max(lo, Math.min(hi, jar.x + (petX < jar.x ? -18 : 18)));
          walkSpd = baseSpd;
          walkGoal = { kind: "jar", tx: walkTarget };
        } else sitUntil = now + 1500;
      }
      else sitUntil = now + 1500;
      // higher rarities stay busier; personality sets the tempo; chili
      // rush doubles it; energy makes lively phases actually livelier
      nextWander = now + ((sp.r >= 3 ? 2600 : sp.r >= 2 ? 3600 : 5200) + Math.random() * (sp.r >= 2 ? 5000 : 7000)) * (psy.pace || 1) * (now < hyperUntil ? 0.5 : 1) * (1.25 - energy * 0.6);
    }
  } else {
    walkTarget = null;
    walkGoal = null; // a hijacked stroll drops its errand too
    hopTarget = null;
    hopWind = 0;
    petSpd = 0;
    walkSpd = 55;
  }
  // stale speed bleeds off when the pet isn't walking — otherwise the
  // next stroll starts mid-stride and slides its first steps
  if (walkTarget === null && petSpd) petSpd = Math.max(0, petSpd - dt * 600);
  if (walkTarget === null) walkDirPrev = 0;

  // snack despawn if ignored
  if (snack && now - snack.t0 > 9000) snack = null;

  // first-launch hello: one hop toward the cursor + a wave — the whole
  // onboarding fits in a second and never repeats once seen
  if (!introDone && !seen && !petHome && now > 1500 && petX > 0 && onGround) {
    introDone = true;
    flying = true; petVY = -240; petVX = 0;
    lookDir = Math.sign(curX - petX) || 1;
    lookUntil = now + 1400;
    hearts.push({ x: petX + 14, y: petY - 66, life: 1.2 });
    bangs.push({ x: petX, y: petY - bh - 14, life: 1.6, t: "HELLO!" });
    sfx.heart();
  }
  // bond greeting: a well-bonded slime notices you coming back — one
  // happy hop with a heart, once per boot, only if it's on the desktop
  if (!greeted && seen && !petHome && now > 2200 && petX > 0 && onGround && bondLvl(SPECIES[active].id) >= 3) {
    greeted = true;
    flying = true; petVY = -200; petVX = 0;
    lookDir = Math.sign(curX - petX) || 1;
    lookUntil = now + 1200;
    hearts.push({ x: petX - 12, y: petY - 62, life: 1 });
    hearts.push({ x: petX + 14, y: petY - 66, life: 1.2 });
    bangs.push({ x: petX, y: petY - bh - 14, life: 1.3, t: "HI!" });
    sfx.heart();
  }

  // mystery egg: once a day a spotted egg drops on the deck — marked at
  // spawn, so closing the app before the hatch costs the day's egg
  const eggDay = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
  if (!egg && lastEgg !== eggDay && seen && now > 20000 && plats.length) {
    lastEgg = eggDay;
    dirty = true;
    dropEgg();
  }
  if (egg && now - egg.t0 > 150000) hatchEgg(); // unpecked eggs hatch on their own

  // discovery hints: one move at a time — a contextual pop the moment
  // the user is mid-gesture, or a 150s drip for moves they haven't
  // bumped into. never while a modal is up or a hand is on a slime
  if (now > hintUntil && !petHome && !held && !palHeld && !settingsOpen && !ranchOpen &&
      !gemShop && !albumOpen && !redeemMode && !treatAim && !photoHide) {
    for (const h of HINTS) {
      if (hintsSeen[h.id]) continue;
      if ((h.trig && h.trig()) || now > hintDrip) {
        hintsSeen[h.id] = 1;
        hintText = h.t;
        hintUntil = now + 6000;
        hintDrip = now + 150000;
        dirty = true;
        break;
      }
    }
  }

  // accessory routines: anything grabbing the pet aborts mid-act; the
  // step-runner advances timed scripts; flyby steers in the flying block
  if (accAct && (held || sigT0 || petHome || climbing || settingsOpen || ranchOpen)) { accAct = null; propSpin = 0; }
  // the stroll gates are gone on purpose: rare+legendary species wander
  // so constantly that walkTarget was almost never null — their accessory
  // acts could never fire. startAccAct cancels the stroll itself, so an
  // act may legitimately interrupt an idle walk (still rare via accActNext)
  if (!accAct && onGround && state === "idle" && !sigT0 && curV < 700 && now > accActNext && !petBusy) {
    const eq = accEquip[SPECIES[active].id];
    const run = eq === "prop" ? "flyby" : ACC_RUN_ID[eq];
    if (run && ACC_ACTS[eq] && !reduceMotion) startAccAct(run, now);
    accActNext = now + (ACC_ACTS[eq] || 40000) * (0.8 + Math.random() * 0.5) * (psy.pace || 1);
  }
  if (accAct && accAct.id !== "flyby") {
    const steps = ACC_RUNS[accAct.id] || [];
    const e = now - accAct.t0;
    while (accAct.step < steps.length && e >= steps[accAct.step][0]) {
      try { steps[accAct.step][1](accAct); }
      catch (err) { accAct = null; propSpin = 0; break; }
      accAct.step++;
    }
    if (accAct && accAct.step >= steps.length) accAct = null;
  }

  // fresh kibble steams for a little while after a refill
  if (bowl && now < (bowl.steamUntil || 0) && Math.random() < dt * 5) {
    fx.push({ x: bowl.x + (Math.random() - 0.5) * 16, y: bowl.y - 16, vx: (Math.random() - 0.5) * 8, vy: -16 - Math.random() * 10, life: 0.9, c: "#e8e0d0" });
  }

  // species ambient trait particles
  const trait = SPECIES[active].trait;
  if (trait && !held && !petHome && now > nextTraitFx) {
    nextTraitFx = now + 1400 + Math.random() * 1600;
    if (trait === "spark") fx.push({ x: petX + Math.random() * 24 - 12, y: petY - 8, vx: 0, vy: -32, life: 1, c: "#f0a05c" });
    if (trait === "drip") fx.push({ x: petX + Math.random() * 20 - 10, y: petY - 4, vx: 0, vy: 55, life: 0.6, c: "#69b7ec" });
    if (trait === "wisp") fx.push({ x: petX + Math.random() * 40 - 20, y: petY - 30 - Math.random() * 16, vx: Math.random() * 10 - 5, vy: -12, life: 1.5, c: "#c4b2f0" });
    if (trait === "glint") bangs.push({ x: petX + Math.random() * 40 - 20, y: petY - Math.random() * 50 - 10, life: 0.8, t: "✦" });
    if (trait === "bubble") fx.push({ x: petX + Math.random() * 24 - 12, y: petY - 20, vx: Math.random() * 8 - 4, vy: -35, life: 1.2, c: "#b8e8f5" });
  }
  // legendary ambient quirks — trails, embers, notes, drool
  if (!petHome) legTick(sp, petX, petY, dt, walkTarget !== null, flying, (v) => { squashV += v; });
  // idle fidgets: a menu of micro-animations so standing still never
  // looks static — weighted by mood: lazy pets yawn and sigh, lively
  // ones shuffle and peek around
  if (onGround && walkTarget === null && hopTarget === null && !held && state === "idle" && now > nextFidget && now > begUntil && !petBusy) {
    const lazy = energy < 0.4;
    const fr = Math.random();
    if (lazy && now > yawnNext && fr < 0.3) {
      // big yawn: rear up slow, mouth wide, then a content settle —
      // often followed by a little sit
      yawnT = now + 950;
      yawnNext = now + 26000 + Math.random() * 20000;
      munchUntil = now + 700;
      stretchUntil = Math.max(stretchUntil, now + 500);
      lookUntil = 0;
      sfx.pop();
    } else if (fr < 0.45) {
      // weight-shift shuffle: a tiny side-step, like real feet
      petX = Math.max(lo, Math.min(hi, petX + (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 7)));
      squashV += 1.2;
      lookDir = -lookDir || (Math.random() < 0.5 ? -1 : 1);
      lookUntil = now + 500;
    } else if (fr < 0.7 && ignoreT > 30) {
      // a bored little sigh — small puff and a droop
      fx.push({ x: petX + lookDir * 12, y: petY - 20, vx: lookDir * 18, vy: -10, life: 0.7, c: "#c8ccd4" });
      squashV += 0.8;
    } else {
      // peek: look left then right, curious
      lookDir = -lookDir || 1;
      lookUntil = now + 420;
      squashV += 1.4;
    }
    nextFidget = now + (3800 + Math.random() * 5200) * animProf(active).fidget * (psy.pace || 1) * (lazy ? 1.3 : 1);
  }
  // turn flourish: a pivot squash whenever the heading flips mid-walk,
  // so direction changes feel physical instead of a sprite mirror
  if (lookDir !== 0 && lookDir !== lastLookDir && onGround && (walkTarget !== null || hopTarget !== null)) {
    squashV += 1.1;
    if (Math.random() < 0.4) fx.push({ x: petX - lookDir * 12, y: petY - 4, vx: -lookDir * 24, vy: -16, life: 0.35, c: "#c8b8a0" });
  }
  lastLookDir = lookDir;
  // yawn playback: tall stretch + droop tail, one smooth arc
  if (now < yawnT) {
    const ye = 1 - (yawnT - now) / 950;
    stretchUntil = Math.max(stretchUntil, now + 60);
    if (ye > 0.7 && Math.random() < dt * 8) fx.push({ x: petX + lookDir * 14, y: petY - 26, vx: lookDir * 10, vy: -8, life: 0.5, c: "#dfe4ea" });
  }
  // nodding off: as the sleep clock nears, droop-recover cycles —
  // reads as fighting to stay awake
  const idleMs2 = Date.now() - awakeAt;
  if (state === "idle" && !held && idleMs2 > sleepMs - 45000 && idleMs2 < sleepMs) {
    nodPhase += dt;
    if (nodPhase > 2.6) { nodPhase = 0; squashV += 1.8; munchUntil = now + 200; }
  }
  // held stretch eases off between pointermove updates
  if (!held && heldStretch > 0) heldStretch = Math.max(0, heldStretch - dt * 2.2);
  // chili rush: little flames while the treat buzz lasts
  if (now < hyperUntil && Math.random() < dt * 4) {
    fx.push({ x: petX + Math.random() * 24 - 12, y: petY - 12, vx: Math.random() * 16 - 8, vy: -46, life: 0.55, c: "#ff7a3f" });
  }
  // pomodoro focus sprint: periodic cheer to keep you going
  // focus time accrues into lifetime stats while a sprint runs
  if (pomo && pomoPhase === "focus") {
    stats.focusSec = (stats.focusSec || 0) + dt;
    dirty = true;
  }
  if (pomo && pomoPhase === "focus" && now > pomoHeartNext) {
    pomoHeartNext = now + 40000 + Math.random() * 30000;
    hearts.push({ x: petX + (Math.random() * 40 - 20), y: petY - 80, life: 1 });
    if (Math.random() < 0.3) bangs.push({ x: petX + 24, y: petY - 90, life: 1.4, t: "GO!" });
  }

  let stretch = 0;
  let angle = 0;

  if (held) {
    const tx = lastMX - grabDX;
    const ty = lastMY - grabDY;
    const dx = tx - petX;
    const dy = ty - petY;
    petX += dx * Math.min(1, dt * 18);
    petY += dy * Math.min(1, dt * 18);
    const dist = Math.hypot(dx, dy);
    stretch = Math.min(0.45, dist / 120);
    angle = now < petUntil ? Math.sin(t * 4) * 0.08 : Math.sin(t * 26) * 0.28;
    if (now < petUntil) squash *= 0.9;
    else if (now - lastKick > 180) { lastKick = now; squashV += 1.6; }
  } else if (climbing) {
    // Cliff climbs the screen edge sideways, then lets go
    petX = climbEdge;
    petY -= 85 * dt;
    // clings upright to the wall, scrambling (held1/held2 face alternates);
    // slight lean into the wall instead of a full 90-degree sprite rotation
    lookDir = petX < winW / 2 ? 1 : -1;
    lookUntil = now + 250;
    angle = (petX < winW / 2 ? -1 : 1) * 0.16;
    if (Math.random() < dt * 7) {
      fx.push({ x: petX, y: petY - Math.random() * 30, vx: (petX < winW / 2 ? -1 : 1) * 25, vy: 15, life: 0.5, c: "#a89880" });
    }
    if (petY < 110 || now > climbUntil) {
      climbing = false;
      flying = true;
      petVY = 80;
      petVX = (petX < winW / 2 ? 1 : -1) * 140;
      shockUntil = now + 300;
      sfx.boing();
    }
  } else if (webbing) {
    // silk pendulum: hang from the live cursor position, swing with it
    if (now >= webUntil || curX <= -9000 || curV > 2600) {
      const snip = curV > 2600; // a fast cursor whip cuts the line early
      webbing = false;
      webHeld = false;
      webCd = now + (snip ? 8000 : 5000) + Math.random() * 4000;
      flying = true;
      petVY = 40;
      petVX = Math.max(-420, Math.min(420,
        webAngV * 5500 * Math.cos(webAng) + (snip ? curVX * 0.15 : 0)));
      webAng = 0; webAngV = 0;
      if (snip) {
        bangs.push({ x: petX, y: petY - bh - 22, life: 1.2, t: "SNIP" });
        sfx.shock();
      }
    } else {
      // reel-in: park the cursor and webby climbs its thread toward it
      if (curV < 120) webIdleT += dt; else webIdleT = 0;
      webLen += ((webIdleT > 1.2 ? 44 : 92) - webLen) * Math.min(1, dt * 2.4);
      webAngV += (-0.008 * Math.sin(webAng) - 0.015 * webAngV) * dt * 60;
      webAngV += curVX * 0.00003 * dt * 60;
      webAng += webAngV * dt * 60;
      webAng = Math.max(-1.15, Math.min(1.15, webAng));
      const tx = curX + Math.sin(webAng) * webLen;
      const ty = curY + Math.cos(webAng) * webLen;
      // zip-up: first ~300ms blends from the platform onto the rope end
      const zk = Math.min(1, (now - webT0) / 300);
      const ze = 1 - (1 - zk) * (1 - zk);
      const px2 = webFromX + (tx - webFromX) * ze;
      const py2 = webFromY + (ty - webFromY) * ze;
      petVX = (px2 - petX) / Math.max(dt, 0.001);
      petVY = (py2 - petY) / Math.max(dt, 0.001);
      petX = px2; petY = py2;
      // a poke spins it on the thread — full eased 360
      if (now < webTwirl) {
        const tk = 1 - (webTwirl - now) / 750;
        angle = tk * tk * (3 - 2 * tk) * 6.28;
      }
      lookDir = Math.sign(curVX) || lookDir;
      lookUntil = now + 220;
      if (Math.random() < dt * 2.5) {
        fx.push({ x: petX + Math.random() * 20 - 10, y: petY - 20, vx: 0, vy: -18, life: 0.7, c: "#dfe6ee" });
      }
    }
  } else if (flying) {
    // propeller flyby: no gravity while the blades pull — spool up, cruise
    // to a window top, then cut the throttle and drop in for a landing
    if (accAct && accAct.id === "flyby") {
      propSpin = 24;
      const e = now - accAct.t0;
      if (e < 650) { petVY = -270; petVX *= 0.86; }
      else {
        const dx = accAct.tx - petX, dy = accAct.ty - petY;
        petVX += Math.sign(dx) * 520 * dt;
        petVX = Math.max(-330, Math.min(330, petVX));
        petVY += Math.sign(dy) * 460 * dt;
        petVY = Math.max(-250, Math.min(200, petVY));
        if (Math.abs(dx) < 56 && dy > -16) { accAct = null; propSpin = 0; petVY = Math.max(petVY, 80); }
      }
      if (accAct && now > accAct.until) { accAct = null; propSpin = 0; }
      if (Math.random() < dt * 8) { // prop wash: little dust streaks
        fx.push({ x: petX + (Math.random() - 0.5) * 20, y: petY - blobSize().h - 8, vx: (Math.random() - 0.5) * 30, vy: 26, life: 0.4, c: "#dfe6ee" });
      }
    }
    // splatUntil only drives the dizzy face now; bounce is immediate
    if (!(accAct && accAct.id === "flyby")) petVY += 1600 * dt;
    // Stella's wings: she descends feather-light instead of plummeting
    const fl = LEG[sp.id];
    if (fl && fl.floaty && petVY > 210) petVY = 210;
    landPeak = Math.max(landPeak, Math.abs(petVY)); // worst speed → landing impact
    const prevY = petY;
    petX += petVX * dt;
    petY += petVY * dt;
    const half = bw / 2;
    if (petY < 14) {
      petY = 14;
      petVY = Math.abs(petVY) * 0.45 + 60;
      squashV += 4;
      sfx.boing();
    }
    if (petX < half + 4) {
      petX = half + 4;
      if (Math.abs(petVX) > 550) { splatUntil = now + 260; dizzyUntil = now + 900; petVY = -90; sfx.drop(); }
      else sfx.boing();
      petVX = -petVX * 0.5;
      squashV += 3;
    }
    if (petX > winW - half - 4) {
      petX = winW - half - 4;
      if (Math.abs(petVX) > 550) { splatUntil = now + 260; dizzyUntil = now + 900; petVY = -90; sfx.drop(); }
      else sfx.boing();
      petVX = -petVX * 0.5;
      squashV += 3;
    }
    if (petVY > 0) {
      let landY = null;
      for (const p of plats) {
        if (petX > p.x - 20 && petX < p.x + p.w + 20 && p.y >= prevY - 2 && p.y <= petY + 4) {
          if (landY === null || p.y < landY) landY = p.y;
        }
      }
      if (landY !== null) {
        petY = landY;
        if (Math.abs(petVY) > 800) {
          dizzyUntil = now + 1100;
          annoyedUntil = now + 2600;
          for (let i = 0; i < 3; i++) {
            bangs.push({ x: petX - 20 + i * 20, y: petY - bh - 14, life: 1, t: "✦" });
          }
          sfx.drop();
          petVY = -petVY * 0.3;
        } else if (Math.abs(petVY) > 120) {
          petVY = -petVY * 0.42;
          squashV += Math.min(6.5, Math.abs(petVY) * 0.009);
          sfx.boing();
        } else {
          flying = false;
          petVY = 0;
          petVX = 0;
          if (accAct && accAct.id === "flyby") { accAct = null; propSpin = 0; }
          // landing settles in proportion to the fall — a hop lands light,
          // a screen-high drop slams down and throws a second dust ring
          squashV += 2 + Math.min(6, landPeak * 0.008);
          if (landPeak > 520) ripples.push({ x: petX, y: landY + 2, r: 9, life: 0.8 });
          landPeak = 0;
          if (startleFall) {
            // window vanished under it — lands dazed and a little miffed
            startleFall = false;
            dizzyUntil = now + 1300;
            poutUntil = now + 1800;
            bangs.push({ x: petX, y: petY - bh - 14, life: 1.1, t: "!?" });
          }
          dirty = true;
          sfx.pop();
          // hunt resolution: landed within pounce range of the cursor =
          // caught it. otherwise it sulks for a beat and tries later
          if (huntPounce) {
            huntPounce = false;
            if (Math.hypot(curX - petX, curY - (petY - bh / 2)) < 120) {
              hearts.push({ x: petX + 14, y: petY - 64, life: 1.2 });
              bangs.push({ x: petX, y: petY - bh - 14, life: 1.1, t: "GOTCHA" });
              smugUntil = now + 1800; // caught the cursor and knows it
              contentUntil = now + 1500;
              sfx.heart();
              ignoreT = 0;
            } else poutUntil = now + 900;
          }
          // landing ripple + a puff of dust — drago lands HEAVY
          const hvy = LEG[sp.id] && LEG[sp.id].heavy;
          ripples.push({ x: petX, y: landY + 2, r: hvy ? 10 : 6, life: hvy ? 1.3 : 1 });
          for (let i = 0; i < (hvy ? 12 : 5); i++) {
            fx.push({ x: petX + (Math.random() - 0.5) * (hvy ? 60 : 30), y: landY - 2, vx: (Math.random() - 0.5) * (hvy ? 90 : 50), vy: -Math.random() * (hvy ? 44 : 26), life: 0.5, c: hvy ? "#a89880" : "#c8b8a0" });
          }
          if (hvy) squashV += 3;
        }
      }
    }
    if (petY > winH + 80) {
      petY = winH; flying = false; petVY = 0; petVX = 0;
      if (accAct && accAct.id === "flyby") { accAct = null; propSpin = 0; }
      if (startleFall) { startleFall = false; dizzyUntil = now + 1300; poutUntil = now + 1800; }
    }
  }

  // thrown cookie: arcs, then rests on whatever platform it lands on
  if (treatFly) {
    treatFly.vy += 1400 * dt;
    const prevTy = treatFly.y;
    treatFly.x += treatFly.vx * dt;
    treatFly.y += treatFly.vy * dt;
    if (treatFly.vy > 0) {
      // land on the HIGHEST platform crossed this frame (mirrors pet landing)
      let landY = null;
      for (const p of plats) {
        if (treatFly.x > p.x && treatFly.x < p.x + p.w && p.y >= prevTy - 2 && p.y <= treatFly.y + 4) {
          if (landY === null || p.y < landY) landY = p.y;
        }
      }
      if (landY !== null) {
        treat = { x: treatFly.x, y: landY, t0: now, kind: treatFly.kind };
        treatFly = null;
        touch(); // the thunk of a landing cookie wakes it up
        if (state !== "idle") state = "idle";
        sfx.pop();
      }
      if (treatFly && treatFly.y > winH + 40) treatFly = null;
    }
  }

  // the ball: gravity, platform bounces, rolling drag — and every slime
  // on the same deck nudges it. ball.y is the ball's underside, like petY
  if (ball && !ballHeld) {
    ball.vy += 1400 * dt;
    ball.vx *= Math.exp(-0.5 * dt);
    const prevBy = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rot += ball.vx * dt * 0.045;
    if (ball.x < ball.r + 2) { ball.x = ball.r + 2; ball.vx = Math.abs(ball.vx) * 0.55; }
    if (ball.x > winW - ball.r - 2) { ball.x = winW - ball.r - 2; ball.vx = -Math.abs(ball.vx) * 0.55; }
    if (ball.y - ball.r * 2 < 6) { ball.y = 6 + ball.r * 2; ball.vy = Math.abs(ball.vy) * 0.5; }
    if (ball.vy > 0) {
      let landY = null;
      for (const p of plats) {
        if (ball.x > p.x && ball.x < p.x + p.w && p.y >= prevBy - 2 && p.y <= ball.y + 4) {
          if (landY === null || p.y < landY) landY = p.y;
        }
      }
      if (landY !== null) {
        ball.y = landY;
        if (ball.vy > 170) {
          ball.sq = Math.min(1.1, ball.vy / 700); // splat in proportion to impact
          if (ball.vy > 420) for (let i = 0; i < 3; i++) fx.push({ x: ball.x + (Math.random() - 0.5) * 20, y: ball.y - 2, vx: (Math.random() - 0.5) * 60, vy: -14, life: 0.4, c: "#c8b8a0" });
          ball.vy = -ball.vy * 0.55;
          if (ball.vy < -150) sfx.pop();
        } else ball.vy = 0;
      }
    }
    if (ball.vy === 0) ball.vx *= Math.exp(-2.0 * dt); // deck friction
    if (ball.sq) ball.sq = Math.max(0, ball.sq - dt * 3.2); // squish relaxes fast
    if (ball.y > winH + 60) { ball.y = winH; ball.vy = 0; }
    // slime play: a slow ball gets dribbled, a fast one gets dodged
    if (onGround && state === "idle" && !petBusy && Math.abs(ball.y - sup.y) < 16 && Math.abs(ball.x - petX) < 30) {
      const dir = Math.sign(ball.x - petX) || 1;
      if (Math.abs(ball.vx) > 190) {
        flying = true; petVY = -190; petVX = dir * -40; squashV += 2; // hops over it
      } else {
        ball.vx += dir * (90 + petSpd * 1.1) * dt * 30;
        if (Math.random() < dt * 8) { squashV += 1.5; lookDir = dir; lookUntil = now + 300; }
      }
    }
    for (const p of pals) {
      if (p.fly || p.stackOn || p === palHeld || now < p.restUntil) continue;
      const pl = p.plat;
      if (!pl || Math.abs(ball.y - pl.y) > 16 || Math.abs(ball.x - p.x) > 26) continue;
      if (Math.abs(ball.vx) > 190) {
        p.fly = true; p.vy = -160; p.vx = Math.sign(p.x - ball.x) * 50; p.hopT = now; // dodge
      } else if (now > (p.ballCd || 0) && now > (p.restUntil || 0)) {
        p.ballCd = now + 900;
        ball.vx += Math.sign(ball.x - p.x || 1) * 110;
        if (ball.vy > -70) ball.vy = -70; // a little chip upward
        p.squashV += 3;
        p.lookDir = Math.sign(ball.x - p.x) || 1; p.lookUntil = now + 500;
        if (Math.random() < 0.4) { p.faceId = "happy"; p.faceT = now + 700; }
        if (Math.random() < 0.5) sfx.pop();
      }
    }
  }

  // cookie goes stale after 10s (or when unreachable on another platform)
  if (treat && now - treat.t0 > 10000) {
    for (let i = 0; i < 4; i++) fx.push({ x: treat.x, y: treat.y - 8, vx: Math.random() * 30 - 15, vy: -20, life: 0.5, c: "#8a6b4a" });
    treat = null;
  }

  // pulsar's gravity well tugs snacks toward it — landed ones slide,
  // airborne ones curve off their arc
  if (SPECIES[active].trait === "gravity") {
    if (treat && Math.abs(treat.x - petX) < 220 && Math.abs(treat.y - petY) < 140) {
      treat.x += (petX - treat.x) * Math.min(1, dt * 1.6);
    }
    if (treatFly && Math.hypot(treatFly.x - petX, treatFly.y - petY) < 240) {
      treatFly.vx += (petX - treatFly.x) * 3.2 * dt;
      treatFly.vy += (petY - 30 - treatFly.y) * 1.8 * dt;
    }
  }

  // a landed cookie is top priority: the slime wants it NOW
  // (only reachable ones — same platform height)
  // a snack on a LOWER platform still counts — the pet strolls off the
  // edge and drops down to it (the old same-level gate made treats it
  // couldn't reach look ignored)
  const treatBelow = treat && treat.y > sup.y + 20 && Math.abs(treat.x - petX) < 600;
  if (treat && !held && !climbing && !flying && !webbing && !petHome && state === "idle" && !petBusy && (Math.abs(treat.y - sup.y) < 20 || treatBelow)) {
    const dx = treat.x - petX;
    if (Math.abs(dx) > 16 || treatBelow) {
      const tlo = Math.max(40, sup.x + 30);
      const thi = Math.min(winW - 40, sup.x + sup.w - 30);
      // below: aim past the edge on the snack's side so it drops off
      walkTarget = treatBelow ? (treat.x < petX ? tlo - 40 : thi + 40)
                              : Math.max(tlo, Math.min(thi, treat.x));
      // bites lunges at snacks — a chomp-trait slime charges harder
      walkSpd = (LEG[sp.id] && LEG[sp.id].lunge ? 300 : 170) * (psy.spd || 1);
      if (LEG[sp.id] && LEG[sp.id].lunge && Math.random() < dt * 10) {
        fx.push({ x: petX - Math.sign(dx) * 20, y: petY - 14, vx: -Math.sign(dx) * 30, vy: -8, life: 0.35, c: "#e05a6e" });
      }
      munchUntil = now + 90;
    } else {
      const tk = TREATS[treat.kind || 0];
      treat = null;
      stats.treats++;
      const prevXp = xp;
      xp += tk.xp;
      // snacks count toward the same gem milestones as typing
      const every = SPECIES[active].r >= 3 ? JELLY_EVERY / 2 : JELLY_EVERY;
      if (Math.floor(xp / every) > Math.floor(prevXp / every)) {
        jelly += 1;
        bangs.push({ x: petX + 20, y: petY - 96, life: 1, t: "💎" });
        starUntil = now + 900;
      }
      level = Math.min(3, Math.floor(xp / KEYS_PER_LEVEL));
      munchUntil = now + 500;
      contentUntil = now + 2500;
      bondGain(SPECIES[active].id, 3);
      // treat side-effects: chili rush, coffee buzz, cake delight
      if (tk.id === "chili") { hyperUntil = now + 60000; bangs.push({ x: petX + 34, y: petY - 96, life: 1.6, t: "HOT!" }); }
      else if (tk.id === "coffee") { noSleepUntil = Date.now() + 300000; bangs.push({ x: petX + 34, y: petY - 96, life: 1.6, t: "WIRED" }); }
      else if (tk.id === "cake") squashV += 8;
      dirty = true;
      sfx.munch();
      // shared crumbs: pals crowding the treat get a nibble reaction —
      // they were hovering for a bite anyway, let them join the meal
      for (const p of pals) {
        if (p === palHeld || p.fly || Math.abs(p.y - petY) > 24 || Math.abs(p.x - petX) > 110) continue;
        p.faceId = Math.random() < 0.3 ? "love" : "happy";
        p.faceT = now + 1200;
        p.squashV += 4;
        if (Math.random() < 0.5) hearts.push({ x: p.x + 8, y: p.y - 58, life: 0.9 });
      }
      bangs.push({ x: petX, y: petY - 84, life: 1.4, t: "YUM" });
      for (let i = 0; i < 6; i++) {
        fx.push({ x: petX + Math.random() * 20 - 10, y: petY - 20, vx: Math.random() * 80 - 40, vy: -Math.random() * 80, life: 0.6, c: "#c4905a" });
      }
    }
  }

  // ---------- species signature act (epic+) ----------
  let petAlpha = 1;
  if (sigT0) {
    const e = now - sigT0;
    let alive = true;
    switch (sigId) {
      case "pounce": // kitty: crouch, then leap at the cursor
        if (e < 300) stretch = -0.18;
        else if (!sigInit) {
          sigInit = 1;
          flying = true;
          petVY = -330;
          petVX = Math.sign(curX - petX || 1) * 240;
          shockUntil = now + 250;
        } else alive = !flying;
        break;
      case "zap": // bolt: antenna crackle, then a discharge
        if (e < 700) {
          if (Math.random() < dt * 40) fx.push({ x: petX + Math.random() * 16 - 8, y: petY - bh - 6, vx: Math.random() * 30 - 15, vy: -50, life: 0.25, c: "#8fd4f0" });
        } else { bangs.push({ x: petX, y: petY - bh - 18, life: 0.8, t: "!" }); squashV += 5; sfx.shock(); alive = false; }
        break;
      case "voidpull": // void: inhales particles, then pops a star
        if (e < 900) {
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * 6.28;
            fx.push({ x: petX + Math.cos(a) * 52, y: petY - 22 + Math.sin(a) * 30, vx: -Math.cos(a) * 65, vy: -Math.sin(a) * 45, life: 0.7, c: "#6b5a9e" });
          }
        } else { bangs.push({ x: petX, y: petY - bh - 12, life: 1, t: "✦" }); sfx.reveal(); alive = false; }
        break;
      case "veil": // aurora: shimmering ribbon of light
        if (e < 1500) {
          const cols = ["#5ad4c4", "#b88ad4", "#7a9fe8"];
          fx.push({ x: petX - 44 + Math.random() * 88, y: petY - 8 - Math.random() * 34, vx: Math.sin(t * 3) * 18, vy: -13, life: 0.9, c: cols[(Math.random() * 3) | 0] });
        } else alive = false;
        break;
      case "bubbleup": // toxic: burps up green bubbles
        if (e < 1200) {
          if (Math.random() < dt * 14) fx.push({ x: petX + Math.random() * 20 - 10, y: petY - 12, vx: Math.random() * 10 - 5, vy: -55, life: 1.1, c: "#8ee03f" });
        } else { sfx.pop(); alive = false; }
        break;
      case "beep": // mecha: three rigid pulse-beeps
        if (e < 1000) {
          if (!sigInit || now > sigInit) { sigInit = now + 200; squashV += 4; sfx.pop(); }
        } else alive = false;
        break;
      case "phase": // ghost: fades translucent and back
        if (e < 1400) petAlpha = 0.35 + 0.65 * Math.abs(Math.cos((e / 1400) * Math.PI));
        else alive = false;
        break;
      case "orbit": // astro: three stars orbit it
        if (e < 1800) {
          for (let i = 0; i < 3; i++) {
            const a = t * 4 + i * 2.09;
            fx.push({ x: petX + Math.cos(a) * 36, y: petY - 22 + Math.sin(a) * 12, vx: 0, vy: 0, life: 0.09, c: "#ffd75e" });
          }
        } else alive = false;
        break;
      case "smokebomb": // ninja: smoke out, teleport, smoke back in
        if (e < 250) {
          petAlpha = 1 - e / 250;
          if (Math.random() < dt * 30) fx.push({ x: petX + Math.random() * 30 - 15, y: petY - 16, vx: Math.random() * 20 - 10, vy: -16, life: 0.6, c: "#4a545e" });
        } else if (e < 700) {
          if (!sigInit) {
            sigInit = 1;
            petX = Math.max(sup.x + 40, Math.min(sup.x + sup.w - 40, petX + (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 80)));
          }
          petAlpha = 0;
        } else {
          petAlpha = Math.min(1, (e - 700) / 200);
          if (Math.random() < dt * 30) fx.push({ x: petX + Math.random() * 30 - 15, y: petY - 16, vx: Math.random() * 20 - 10, vy: -16, life: 0.6, c: "#4a545e" });
          if (petAlpha >= 1) alive = false;
        }
        break;
      case "shower": // goldie: basks, swaying under a fountain of gold
        if (e < 1200) {
          angle = Math.sin(e / 190) * 0.12; // rocks side to side like she's bathing in it
          starUntil = now + 90; // starstruck the whole time — it's HER fountain
          if (Math.random() < dt * 30) fx.push({ x: petX + Math.random() * 10 - 5, y: petY - bh, vx: Math.random() * 140 - 70, vy: -140 - Math.random() * 80, life: 0.9, c: "#ffd75e" });
        } else { angle = 0; alive = false; }
        break;
      case "starburst": // stella: pirouettes while a ring of stars blooms
        if (e < 900) {
          angle = (e / 900) * 6.28; // full spin — the burst is a dance
          const rr = (e / 900) * 62;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 6.28 + e / 300;
            fx.push({ x: petX + Math.cos(a) * rr, y: petY - 24 + Math.sin(a) * rr * 0.5, vx: 0, vy: 0, life: 0.09, c: "#9aadff" });
          }
        } else { angle = 0; alive = false; }
        break;
      case "reentry": // comet: launches up spinning with a fire trail
        if (!sigInit) { sigInit = 1; flying = true; petVY = -640; petVX = (Math.random() - 0.5) * 300; }
        if (flying) angle = e * 0.016; // tumbles like a real meteor
        if (flying && petVY < 0 && Math.random() < dt * 30) fx.push({ x: petX, y: petY, vx: 0, vy: 60, life: 0.4, c: "#ff7a3f" });
        if (!flying) {
          for (let i = 0; i < 8; i++) fx.push({ x: petX + Math.random() * 40 - 20, y: petY - 4, vx: Math.random() * 160 - 80, vy: -Math.random() * 60, life: 0.5, c: "#e85a2a" });
          alive = false;
        }
        break;
      case "eruption": // molten: swells and pulses, lobbing lava blobs
        if (e < 1000) {
          stretch = Math.sin(e / 85) * 0.12; // boils — the body visibly swells
          if (Math.random() < dt * 12) fx.push({ x: petX + Math.random() * 16 - 8, y: petY - 20, vx: Math.random() * 120 - 60, vy: -180 - Math.random() * 120, life: 1.2, c: Math.random() < 0.5 ? "#e85a2a" : "#ff8a2a" });
        } else { stretch = 0; alive = false; }
        break;
      case "song": // siren: sways as she sings, notes and hearts float up
        angle = Math.sin(t * 5) * 0.1;
        stretch = Math.sin(e / 210) * 0.08; // diaphragm swells on each phrase
        munchUntil = now + 90;
        if (Math.random() < dt * 5) bangs.push({ x: petX + Math.random() * 30 - 15, y: petY - bh - 10, life: 1.2, t: Math.random() < 0.3 ? "♥" : "♪" });
        if (e > 1600) { stretch = 0; alive = false; }
        break;
      case "webshot": // webby: aims a silk line at the cursor, then dangles
        if (e < 420) {
          stretch = -0.15;
          if (curX > -9000 && Math.random() < dt * 34) {
            const f = Math.random();
            fx.push({ x: petX + (curX - petX) * f, y: petY - bh + (curY - (petY - bh)) * f, vx: 0, vy: 0, life: 0.16, c: "#eef2f6" });
          }
        } else {
          if (curX > -9000) {
            webbing = true;
            webUntil = now + 4500 + Math.random() * 3500;
            webAng = Math.sign(petX - curX || 1) * 0.4;
            webAngV = 0;
            webT0 = now; webFromX = petX; webFromY = petY;
            webLen = 92; webIdleT = 0;
            sfx.pop();
          }
          alive = false;
        }
        break;
      case "firebreath": // drago: rears back, then pours a flame cone
        if (e < 320) {
          stretchUntil = now + 100; // rears up to inhale — the tell
          stretch = -0.1;
          angle = (lookDir || 1) * -0.08;
        } else if (e < 1250) {
          munchUntil = now + 90;
          const dir2 = lookDir || 1;
          angle = dir2 * 0.06; // braced, leaning into the cone
          for (let i = 0; i < 3; i++) {
            fx.push({ x: petX + dir2 * 16, y: petY - 30 + Math.random() * 10 - 5,
              vx: dir2 * (160 + Math.random() * 180), vy: -30 + Math.random() * 50,
              life: 0.5 + Math.random() * 0.35, c: ["#ff8a2a", "#e85a2a", "#ffd75e", "#ff5a3a"][(Math.random() * 4) | 0] });
          }
          if (Math.random() < dt * 7) squashV += 1;
        } else { angle = 0; sfx.drop(); alive = false; }
        break;
      case "singularity": // pulsar: levitates while space folds in, bursts out
        if (e < 1300) {
          petY -= 14 * dt; // lifts off the ground as its well deepens
          angle = Math.sin(e / 70) * 0.07;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * 6.28, rr = 70;
            fx.push({ x: petX + Math.cos(a) * rr, y: petY - 24 + Math.sin(a) * rr * 0.55,
              vx: -Math.cos(a) * 95 - Math.sin(a) * 40, vy: -Math.sin(a) * 60, life: 0.65,
              c: Math.random() < 0.5 ? "#8ad4f0" : "#b88ad4" });
          }
          if (Math.random() < dt * 2) squashV += 0.8;
        } else {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.28;
            fx.push({ x: petX, y: petY - 24, vx: Math.cos(a) * 190, vy: Math.sin(a) * 120, life: 0.5, c: "#dfe6ee" });
          }
          gravRings.push({ x: petX, y: petY - 22, r: 60, life: 1.2 }); // the rebound ring
          flying = true; // drops back down — the levitate was the act
          petVY = 30;
          sfx.shock();
          alive = false;
        }
        break;
      case "decree": // rex: royal leap — pals are summoned to gather round
        if (!sigInit) {
          sigInit = 1;
          flying = true;
          petVY = -380;
          petVX = 0;
          sfx.boing();
          for (const p of pals) {
            if (now < (p.restUntil || 0)) continue; // a napping pal ignores the summons
            const pl = p.plat || { x: 0, w: winW };
            p.walkT = Math.max(pl.x + 26, Math.min(pl.x + pl.w - 26, petX + (Math.random() * 140 - 70)));
          }
          bangs.push({ x: petX, y: petY - bh - 24, life: 1.4, t: "★" });
        }
        if (flying) {
          // holds a regal pose at the apex, crown-sparkles trailing
          if (petVY > -60) stretchUntil = now + 110;
          if (Math.random() < dt * 9) fx.push({ x: petX + (Math.random() - 0.5) * 34, y: petY - 54, vx: 0, vy: -18, life: 0.6, c: "#ffd75e" });
        }
        if (!flying) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.28;
            fx.push({ x: petX + Math.cos(a) * 30, y: petY - 10 + Math.sin(a) * 10,
              vx: Math.cos(a) * 90, vy: Math.sin(a) * 40 - 30, life: 0.6, c: "#ffd75e" });
          }
          alive = false;
        }
        break;
      case "burst": // pinata: candy confetti explosion
        if (e < 200) stretch = -0.22;
        else if (!sigInit) {
          sigInit = 1;
          squashV += 8;
          sfx.pop();
          const cols = ["#ff5a6e", "#ffd75e", "#5ad4c4", "#b88ad4", "#ff8a2a"];
          for (let i = 0; i < 26; i++) {
            const a = Math.random() * 6.28, s2 = 60 + Math.random() * 170;
            fx.push({ x: petX, y: petY - 22, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2 - 90,
              life: 0.8 + Math.random() * 0.5, c: cols[i % 5] });
          }
          bangs.push({ x: petX, y: petY - bh - 16, life: 1.2, t: "POP!" });
        } else if (e > 700) alive = false;
        break;
      case "flare": // lanty: warm lantern pulse rings outward
        if (e < 1100) {
          const rr = (e / 1100) * 78;
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.28;
            fx.push({ x: petX + Math.cos(a) * rr, y: petY - 22 + Math.sin(a) * rr * 0.6,
              vx: Math.cos(a) * 20, vy: Math.sin(a) * 14, life: 0.1, c: "#ffe9a8" });
          }
          petAlpha = 0.7 + 0.3 * Math.abs(Math.cos(e / 140));
        } else { sfx.reveal(); alive = false; }
        break;
      case "rollout": // dicey: tumbles along the platform, lands on a pip count
        if (!sigInit) {
          sigInit = 1;
          sigTx = Math.sign(Math.random() - 0.5 || 1) * (130 + Math.random() * 110);
          walkTarget = null; hopTarget = null;
          sfx.boing();
        }
        if (e < 900) {
          petX = Math.max(lo, Math.min(hi, petX + (sigTx / 0.9) * dt));
          angle = (sigTx > 0 ? 1 : -1) * (e / 900) * 6.28;
          if (Math.random() < dt * 14) {
            fx.push({ x: petX, y: petY - 4, vx: -sigTx * 0.3, vy: -30, life: 0.4, c: "#e8e2d4" });
          }
        } else {
          bangs.push({ x: petX, y: petY - bh - 16, life: 1.3, t: "" + (1 + ((Math.random() * 6) | 0)) });
          squashV += 5;
          sfx.pop();
          alive = false;
        }
        break;
      case "ribbit": // hops: puffs up, then a big croak ripple
        if (e < 550) {
          stretch = -0.16 - Math.sin((e / 550) * Math.PI) * 0.14;
          munchUntil = now + 90;
        } else if (!sigInit) {
          sigInit = 1;
          sfx.pop();
          squashV += 7;
          bangs.push({ x: petX, y: petY - bh - 18, life: 1.4, t: "RIBBIT" });
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * 6.28;
            fx.push({ x: petX + Math.cos(a) * 14, y: petY - 24 + Math.sin(a) * 8,
              vx: Math.cos(a) * 150, vy: Math.sin(a) * 70, life: 0.55, c: "#7ec860" });
          }
        } else alive = false;
        break;
      case "landslide": // cliff: rears, leaps, slams — a mini rockslide
        if (e < 380) stretch = -0.2;
        else if (!sigInit) {
          sigInit = 1;
          flying = true;
          petVY = -300;
          petVX = 0;
          sfx.pop();
        } else if (!flying) {
          squashV += 12;
          sfx.drop();
          ripples.push({ x: petX, y: petY + 2, r: 14, life: 1.5 });
          ripples.push({ x: petX, y: petY + 2, r: 6, life: 1.2 });
          bangs.push({ x: petX, y: petY - bh - 18, life: 1.3, t: "SLAM" });
          // rocks cascade down around the impact
          for (let i = 0; i < 16; i++) {
            fx.push({ x: petX + Math.random() * 180 - 90, y: petY - 110 - Math.random() * 50,
              vx: Math.random() * 40 - 20, vy: 140 + Math.random() * 160, life: 1.1,
              c: ["#8a7a66", "#a89478", "#68584a", "#c9b89a"][(Math.random() * 4) | 0] });
          }
          // dust kicked sideways off the slam
          for (let i = 0; i < 10; i++) {
            fx.push({ x: petX + Math.random() * 60 - 30, y: petY - 6, vx: Math.random() * 220 - 110, vy: -Math.random() * 90, life: 0.6, c: "#d8c8ae" });
          }
          alive = false;
        }
        break;
      case "frenzy": // bites: wild zig-zag chomping dash across the platform
        if (!sigInit) {
          sigInit = 1;
          sigTx = Math.sign(Math.random() - 0.5 || 1);
          sfx.pop();
        }
        if (e < 1200) {
          const dir = Math.floor(e / 300) % 2 ? -sigTx : sigTx; // zig-zag legs
          const nx = petX + dir * 210 * dt;
          const cx = Math.max(lo, Math.min(hi, nx));
          if (cx !== nx) {
            // slammed the platform edge — ricochet instead of grinding it
            sigTx = -dir;
            petX = cx - dir * 3;
            squashV += 4;
            bangs.push({ x: petX, y: petY - bh - 12, life: 0.5, t: "!" });
            fx.push({ x: cx + dir * 8, y: petY - 10, vx: -dir * 70, vy: -50, life: 0.4, c: "#d8c8ae" });
            sfx.pop();
          } else petX = cx;
          munchUntil = now + 90; // mouth wide open the whole time
          angle = dir * 0.12;
          if (Math.random() < dt * 26) {
            fx.push({ x: petX + dir * 18, y: petY - 16, vx: dir * 90, vy: -30 - Math.random() * 50, life: 0.45,
              c: ["#e8d8bc", "#f5e6c8", "#ffb0a0"][(Math.random() * 3) | 0] });
          }
        } else {
          bangs.push({ x: petX, y: petY - bh - 16, life: 1.3, t: "BURP" });
          blepUntil = now + 1400; // tongue lolls out after the rampage
          hearts.push({ x: petX + 14, y: petY - 62, life: 1 });
          squashV += 5;
          sfx.pop();
          alive = false;
        }
        break;
      case "umbral": // shade: melts into a flat shadow that slinks along
        if (e < 350) {
          stretch = -(e / 350) * 0.5;
          petAlpha = 1 - (e / 350) * 0.5;
        } else if (e < 1400) {
          if (!sigInit) {
            sigInit = 1;
            sigTx = Math.sign(Math.random() - 0.5 || 1);
            sfx.pop();
          }
          stretch = -0.5;
          petAlpha = 0.5;
          petX = Math.max(lo, Math.min(hi, petX + sigTx * 130 * dt));
          if (Math.random() < dt * 18) {
            fx.push({ x: petX + Math.random() * 30 - 15, y: petY - 4, vx: 0, vy: -14, life: 0.5, c: "#43346b" });
          }
        } else {
          squashV += 7;
          sfx.pop();
          alive = false; // petAlpha restored by the act-end cleanup
        }
        break;
      case "spectrum": // prism: splits its glow into a rotating rainbow fan
        if (e < 1400) {
          const cols = ["#ff5a6e", "#ff8a2a", "#ffd75e", "#5ad46e", "#5aa8f0", "#b88ad4"];
          for (let i = 0; i < 2; i++) {
            const a = (e / 1400) * 6.28 + (Math.random() * 6.28);
            fx.push({ x: petX, y: petY - 20,
              vx: Math.cos(a) * (90 + Math.random() * 60), vy: Math.sin(a) * 60 - 30,
              life: 0.6, c: cols[(Math.random() * cols.length) | 0] });
          }
          if (Math.random() < dt * 8) bangs.push({ x: petX + Math.random() * 60 - 30, y: petY - Math.random() * 60 - 20, life: 0.7, t: "✦" });
          if (Math.random() < dt * 3) squashV += 1.2;
        } else {
          bangs.push({ x: petX, y: petY - bh - 16, life: 1.2, t: "SHINE" });
          sfx.reveal();
          alive = false;
        }
        break;
      case "jingle": // yule: bell-hop, snowflakes + a candy shower
        if (!sigInit) {
          sigInit = 1;
          flying = true;
          petVY = -280;
          petVX = 0;
          sfx.boing();
        }
        if (e < 1100) {
          // sway like a ringing bell + shed festive bits
          angle = Math.sin(e / 90) * 0.3;
          if (Math.random() < dt * 14) {
            const fl = Math.random() < 0.5;
            fx.push({ x: petX + Math.random() * 50 - 25, y: petY - Math.random() * 50,
              vx: Math.random() * 30 - 15, vy: 40 + Math.random() * 40, life: 0.9,
              c: ["#ffffff", "#d8ecfa", "#e0455a", "#4fbd63"][(Math.random() * 4) | 0], spr: fl ? "flake" : null });
          }
          if (Math.random() < dt * 6) squashV += 1.5;
          if (Math.random() < dt * 4) bangs.push({ x: petX + Math.random() * 40 - 20, y: petY - 60, life: 0.8, t: "♪" });
        } else if (petY >= sup.y - 26) {
          // only burst once she's actually touched down — a gold ring
          // floating in midair read as a bug
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.28;
            fx.push({ x: petX, y: petY - 24, vx: Math.cos(a) * 130, vy: Math.sin(a) * 90 - 40, life: 0.6, c: "#ffd75e" });
          }
          sfx.reveal();
          alive = false;
        }
        break;
      default: alive = false;
    }
    if (!alive) {
      // Goldie's shower sometimes leaves a real gem behind — lucky!
      if (sigId === "shower" && Math.random() < 0.25) {
        jelly += 1;
        bangs.push({ x: petX, y: petY - bh - 30, life: 1.6, t: "LUCKY!" });
        starUntil = now + 1200;
        sfx.heart();
        dirty = true;
      }
      sigT0 = 0; sigId = null; sigInit = 0; petAlpha = 1;
      // a beat of calm after the show — an overdue nextWander would
      // otherwise fire a new roll (maybe another act) the next frame
      nextWander = Math.max(nextWander, now + 900 + Math.random() * 900);
    }
  }

  const walking = walkTarget !== null;
  const mv = SPECIES[active].mv || "walk";
  if (walking && mv === "walk") angle = Math.sin(t * 9) * 0.11;
  else if (walking && mv === "scurry") { angle = Math.sin(t * 15) * 0.17; munchUntil = now + 90; }
  else if (walking && mv === "hover") angle = Math.sin(t * 3) * 0.05;
  // the twirl: eased full turn around the body's middle (not the feet —
  // a feet-pivot orbit reads as a satellite, not a spin), rising in an
  // arc, stretching tall at speed, and settling with a squash pop
  let spinA = 0, spinLift = 0, spinStr = 0;
  if (spinT0) {
    const sp2 = (now - spinT0) / 620;
    if (sp2 < 1) {
      spinA = (1 - Math.pow(1 - sp2, 3)) * Math.PI * 2;
      spinLift = Math.sin(sp2 * Math.PI);
      spinStr = sp2 < 0.18 ? -(1 - sp2 / 0.18) * 0.1 : spinLift * 0.16;
    } else { spinT0 = 0; squashV += 3; }
  }
  const dancing = danceT0 && now - danceT0 < 1700 && !climbing;
  if (dancing) angle = Math.sin(now / 85) * 0.24;
  const danceSq = dancing ? Math.sin(now / 170) * 0.07 : 0;
  const climbSq = climbing ? Math.sin(now / 60) * 0.09 : 0;
  const ap = animProf(active);
  const bob = !walking ? 0
    : mv === "scurry" ? Math.abs(Math.sin(t * 15 * ap.waddle)) * 1.6
    : mv === "walk" ? Math.abs(Math.sin(gaitPhase * ap.waddle)) * 2.6
    : mv === "blink" && Math.sin(t * 12) > 0 ? 2 : 0;
  const hoverBob = mv === "hover" ? 3 + Math.sin(t * 2.4) * 2.2 : 0;
  const shockStretch = now < shockUntil ? 0.12 : 0;
  const stretchUp = now < stretchUntil ? 0.16 : 0;
  // lean into the walk — the whole blob tilts a few degrees the way it's
  // heading (per-species lean factor from animProf), smoothed so a
  // direction flip rolls through instead of snapping the sprite
  const leanGoal = walking && !flying && !held
    ? (walkTarget !== null ? Math.sign(walkTarget - petX) : lookDir) * 0.055 * ap.lean
    : 0;
  leanSm += (leanGoal - leanSm) * Math.min(1, dt * 9);
  const leanTilt = leanSm;

  const amp = state === "sleeping" && !held ? 0.05 : 0.028;
  const freq = state === "sleeping" ? 1.2 : 2.6 * ap.breathe;
  const breathe = Math.sin(t * freq) * amp;
  // reduce-motion (accessibility): damp squash + rotation, spins become dances
  // squash saturates like real jelly — the harder the hit, the less extra
  // it compresses (small pokes still read fully)
  const msq = squash / (1 + Math.abs(squash) * 0.5) * (reduceMotion ? 0.4 : 1);
  const sx = scale * (1 + msq * 0.25 + breathe + stretch - shockStretch * 0.7 - stretchUp * 0.6 + danceSq + climbSq - spinStr * 0.6);
  const sy = scale * (1 - msq * 0.18 - breathe * 0.7 - stretch * 0.5 + shockStretch + stretchUp - danceSq - climbSq + spinStr);

  // reset the base transform every frame — stray translates must not
  // accumulate; fit() only re-applies on resize
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, winW, winH);

  const shW = SW * sx * 1.1;
  if (!petHome) ctx.drawImage(shadowImg(), petX - shW / 2, sup.y - 4, shW, shW * 0.27);
  if (!petHome && SPECIES[active].r >= 3) {
    const hw = SW * sx * 1.24 + Math.sin(t * 3) * 4;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(haloImg(), petX - hw / 2, sup.y - hw * 0.11 - 1, hw, hw * 0.33);
    ctx.globalAlpha = 1;
  }

  // Bites' snack: a fake desktop file/folder sitting on the platform
  if (snack) {
    ctx.save();
    ctx.translate(snack.x, snack.y);
    ctx.rotate(Math.sin(t * 4) * 0.05);
    drawSpr(ctx, snack.kind === "folder" ? "folder" : "file", 0, -9, 2);
    ctx.restore();
  }

  for (let i = crumbs.length - 1; i >= 0; i--) {
    const c = crumbs[i];
    c.vy += 700 * dt;
    c.y += c.vy * dt;
    c.life -= dt * 1.6;
    if (c.life <= 0 || c.y > petY - 10) { crumbs.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, c.life);
    ctx.fillStyle = "#ffd27f";
    ctx.fillRect(c.x, c.y, 4, 4);
  }
  ctx.globalAlpha = 1;

  // --- companion slimes: update physics/AI, then draw (behind the main pet) ---
  for (let i = pals.length - 1; i >= 0; i--) {
    const p = pals[i];
    const psp = SPECIES[p.sp];
    if (!psp || !owned.includes(psp.id)) { pals.splice(i, 1); continue; }
    const ppsy = PSYCH[psp.ps] || {};
    // a cushion nap is a real nap: no walks, no games, no errands.
    // declared at loop scope — every branch below (web/fly/grounded)
    // needs to see it; nested-block scope threw ReferenceErrors
    const nappingP = now < (p.restUntil || 0) || now < (p.hideUntil || 0);
    if (p === palHeld) {
      // dragged by the cursor: skip AI/physics, face the drag direction
      p.fly = false;
      p.plat = null;
      p.web = 0;
    } else if (p.web && now < p.web && curX > -9000 && curV <= 2600) {
      // silk pendulum under the live cursor — same physics as the main pet
      p.fly = false;
      p.plat = null;
      p.webAV += (-0.008 * Math.sin(p.webA) - 0.015 * p.webAV) * dt * 60;
      p.webAV += curVX * 0.00003 * dt * 60;
      p.webA += p.webAV * dt * 60;
      p.webA = Math.max(-1.15, Math.min(1.15, p.webA));
      // the silk anchors AT the cursor — a tiny per-pal stagger keeps two
      // dangling webbies from drawing on top of each other
      p.x = curX + ((i % 3) - 1) * 12 + Math.sin(p.webA) * 72;
      p.y = curY + Math.cos(p.webA) * 72;
      p.lookDir = Math.sign(curVX) || p.lookDir;
      p.lookUntil = now + 220;
      if (Math.random() < dt * 3) {
        fx.push({ x: p.x + Math.random() * 14 - 7, y: p.y - 16, vx: 0, vy: -14, life: 0.6, c: "#dfe6ee" });
      }
    } else if (p.web) {
      // line spent, cursor lost, or snipped by a fast whip — let go
      p.web = 0;
      p.fly = true;
      p.vy = 50;
      p.vx = Math.max(-300, Math.min(300, p.webAV * 4000 * Math.cos(p.webA)));
      p.webA = 0; p.webAV = 0;
    } else if (p.fly) {
      p.vy += 1600 * dt;
      const pfl = LEG[psp.id];
      if (pfl && pfl.floaty && p.vy > 210) p.vy = 210;
      p.fallPk = Math.max(p.fallPk || 0, Math.abs(p.vy)); // worst speed → impact
      const prevY = p.y;
      p.x += (p.vx || 0) * dt;
      p.y += p.vy * dt;
      if (p.x < 30) { p.x = 30; p.vx = Math.abs(p.vx || 0) * 0.5; }
      if (p.x > winW - 30) { p.x = winW - 30; p.vx = -Math.abs(p.vx || 0) * 0.5; }
      if (p.vy > 0) {
        for (const pl of plats) {
          if (pl.y < 60) continue;
          if (p.x > pl.x - 14 && p.x < pl.x + pl.w + 14 && prevY <= pl.y + 4 && p.y >= pl.y) {
            p.y = pl.y; p.fly = false; p.vy = 0; p.vx = 0; p.plat = pl;
            p.squashV += 2 + Math.min(5.5, (p.fallPk || 0) * 0.007); p.fallPk = 0;
            p.walkT = null; // the old target belongs to a different platform
            ripples.push({ x: p.x, y: pl.y + 2, r: 5, life: 0.8 });
            break;
          }
        }
      }
      // a window isn't just its top edge — the body below is solid too.
      // falling inside a platform's column means sliding down its side
      // face until the pal clears the nearer edge (tops-only collision
      // let them ghost through window bodies and hover inside)
      if (p.fly) {
        for (const pl of plats) {
          if (pl.y < 60 || pl.y >= winH) continue;
          if (p.y > pl.y + 10 && p.x > pl.x + 6 && p.x < pl.x + pl.w - 6) {
            const dir = (p.x - pl.x) < (pl.x + pl.w - p.x) ? -1 : 1;
            p.vx = dir * Math.max(150, Math.abs(p.vx || 0) * 0.6);
            if (Math.random() < dt * 6) fx.push({ x: p.x - dir * 10, y: p.y - 14, vx: -dir * 20, vy: -30, life: 0.4, c: "#cfd6de" });
            break;
          }
        }
      }
      if (p.y > winH + 60) { p.y = winH; p.fly = false; p.vy = 0; p.vx = 0; p.plat = { x: 0, y: winH, w: winW }; p.walkT = null; }
    } else {
      // --- totem riding: a stacked pal sits on its mount's head and
      // ignores platform physics until it hops off or gets bucked ---
      if (p.stackOn) {
        const q = p.stackOn;
        if (!pals.includes(q) || q.fly || q === palHeld || now > p.stackT) {
          p.stackOn = null;
          p.stackCd = now + 8000;
          if (pals.includes(q) && !q.fly && now <= p.stackT) { p.fly = true; p.vy = 60; }
          else if (pals.includes(q)) { p.fly = true; p.vy = -160; p.vx = (Math.random() < 0.5 ? -1 : 1) * 70; }
        } else {
          p.stackRise = Math.min(1, (p.stackRise || 0) + dt * 4);
          const rise = 1 - Math.pow(1 - p.stackRise, 3);
          p.x += (q.x - p.x) * Math.min(1, dt * 8);
          p.y = q.y - 48 * rise;
          p.plat = q.plat;
          p.walkT = null;
          p.lookDir = q.lookDir || p.lookDir;
          if (Math.random() < dt * 0.7) p.squashV += 1.0;
          // riders are visibly delighted to be up there — a wave/song
          if (p.stackRise >= 1 && Math.random() < dt * 0.22) {
            bangs.push({ x: p.x + 16, y: p.y - 66, life: 1, t: Math.random() < 0.5 ? "♪" : "HI!" });
            if (now > p.faceT) { p.faceId = "happy"; p.faceT = now + 700; }
          }
        }
      } else {
      // platform hysteresis: keep the current deck while it's still under
      // us — re-picking every frame lets borderline candidates flip and
      // churn p.y, which is the visible sub-pet stutter. BUT the cached
      // object is a snapshot from an old poll: when its window closes the
      // reference goes orphaned and the pal hovers on air forever. verify
      // a live platform still supports (p.x, p.y) before keeping it
      let pl = p.plat;
      const stillThere = pl && plats.some((q) => Math.abs(q.y - p.y) < 10 && p.x > q.x - 20 && p.x < q.x + q.w + 20);
      if (!pl || !stillThere || p.x < pl.x - 24 || p.x > pl.x + pl.w + 24) {
        pl = plats.find((q) => Math.abs(q.y - p.y) < 8 && p.x > q.x - 20 && p.x < q.x + q.w + 20) || platUnder(p.x, p.y);
        p.plat = pl;
        // its window just closed — a sinking deck reads as a scare, and
        // a real drop: fall through the window face (side-slide physics
        // handles the way down) instead of easing through solid window
        if (pl.y - p.y > 40) {
          p.fly = true; p.vy = 80; p.fallPk = 0;
          p.restUntil = 0; // the deck dropping out wakes a napper — no
          // sleeping-face freefall
          if (now > (p.faceT || 0)) { p.faceId = "shock"; p.faceT = now + 1000; p.squashV += 1.5; }
        }
      }
      const plo = pl.x + 26, phi = pl.x + pl.w - 26;
      // a napping pal stays put — anything in flight gets cancelled so the
      // pal actually stays put. before this, restUntil only gated the
      // wander roll and a napping pal could be launched, dragged into tag,
      // or wander off mid-doze
      if (nappingP) { p.walkT = null; p.follow = null; p.tag = null; p.accAct = null; p.propGoal = null; p.hopWind = 0; }
      if (now < (p.hideUntil || 0) && box) p.x = box.x; // hidden pals ride a dragged box too
      // soft-snap to the deck: small gaps ease in instead of teleporting
      if (!p.fly) p.y = Math.abs(pl.y - p.y) < 3 ? pl.y : p.y + (pl.y - p.y) * Math.min(1, dt * 18);
      // treat race: the first slime to actually reach the snack eats it —
      // pals used to just crowd around while the main pet got every bite
      if (treat && !p.tag && !p.stackOn && !nappingP && Math.abs(treat.y - p.y) < 30 && Math.abs(treat.x - p.x) < 16) {
        treat = null;
        p.faceId = Math.random() < 0.35 ? "love" : "happy";
        p.faceT = now + 1500;
        p.squashV += 6;
        bondGain(SPECIES[p.sp].id, 2);
        p.walkT = null;
        p.nextT = now + 2200; // savor it before wandering off
        hearts.push({ x: p.x + 8, y: p.y - 58, life: 1 });
        bangs.push({ x: p.x, y: p.y - 66, life: 1.2, t: "YUM" });
        for (let k = 0; k < 5; k++) fx.push({ x: p.x + Math.random() * 16 - 8, y: p.y - 16, vx: Math.random() * 70 - 35, vy: -Math.random() * 70, life: 0.55, c: "#c4905a" });
        sfx.munch();
      }
      // cursor play on pals too — the same boop/scritch the main pet
      // gets, so summoned companions aren't background statues
      if (!p.tag && !p.stackOn && p !== palHeld && !nappingP) {
        const pd = Math.hypot(curX - p.x, curY - (p.y - 18));
        if (pd < 52 && curV > 30 && curV < 400) {
          // slow press into the body → squirm, then a hop back + pout
          p.boopT = (p.boopT || 0) + dt;
          p.squashV += Math.sin(now / 60) * 0.05;
          // jumpy personalities squirm free fast; lazy ones tolerate a press
          if (p.boopT > 1.0 / (ppsy.startle || 1)) {
            p.boopT = 0;
            p.fly = true; p.vy = -150; p.vx = Math.sign(p.x - curX || 1) * 120;
            p.faceId = "pout"; p.faceT = now + 1100; p.walkT = null;
            sfx.pop();
          }
        } else p.boopT = Math.max(0, (p.boopT || 0) - dt * 2);
        if (pd < 60 && curV > 150 && curV < 1400 && now > (p.rubCd || 0)) {
          // back-and-forth scritch over the body → melts
          const rd = Math.sign(curVX);
          if (rd && rd !== p.rubDir) { p.rubDir = rd; p.rubCount = (p.rubCount || 0) + 1; }
          if ((p.rubCount || 0) >= 3) {
            p.rubCount = 0;
            p.rubCd = now + 3500;
            bondGain(SPECIES[p.sp].id, 2);
            p.faceId = Math.random() < 0.4 ? "love" : "happy";
            p.faceT = now + 1800;
            p.squashV += 4;
            hearts.push({ x: p.x + 8, y: p.y - 56, life: 1 });
            if (Math.random() < 0.5) sfx.heart();
          }
        } else { p.rubCount = Math.max(0, (p.rubCount || 0) - dt * 2); if (!p.rubCount) p.rubDir = 0; }
      }
      // accessory bit: the doodad does its own little thing once in a
      // while — minutes apart, a beat or two, nothing that steals a walk
      // walkT gate removed for the same starvation reason as the main
      // pet — a restless pal never gets an idle frame, so the bit now
      // interrupts its stroll instead of never starting
      if (!p.accAct && !p.fly && !p.stackOn && !p.tag &&
          !p.propGoal && !reduceMotion && now > (p.accCd || 0) && now > (p.restUntil || 0)) {
        const eq = accEquip[psp.id];
        if (eq && PAL_ACC_BITS[eq]) { p.accAct = { id: eq, t0: now, step: 0 }; p.walkT = null; }
        p.accCd = now + (100000 + Math.random() * 100000) * (ppsy.pace || 1);
      }
      if (p.accAct) {
        const steps = PAL_ACC_BITS[p.accAct.id] || [];
        const e = now - p.accAct.t0;
        while (p.accAct.step < steps.length && e >= steps[p.accAct.step][0]) {
          try { steps[p.accAct.step][1](p); }
          catch (err) { p.accAct = null; break; }
          p.accAct.step++;
        }
        if (p.accAct && (p.accAct.step >= steps.length || (p.fly && !PAL_FLY_BITS[p.accAct.id]))) p.accAct = null;
      }

      // --- social life: slimes notice, greet, follow, and bump each other ---
      if (!p.tag && !p.stackOn && !nappingP) {
        // greeting: an idle neighbor on the same deck → both stop, face
        // each other, trade a chirp. rare roll + mutual cooldown keeps
        // it a chance encounter, not a loop
        if (now > (p.socCd || 0) && !p.fly && p.walkT === null && Math.random() < dt * 0.09) {
          const q = pals.find(q2 => q2 !== p && !q2.fly && !q2.stackOn && !q2.tag &&
            now > (q2.socCd || 0) && Math.abs(q2.y - p.y) < 18 &&
            Math.abs(q2.x - p.x) < 62 && Math.abs(q2.x - p.x) > 10);
          if (q) {
            p.socCd = q.socCd = now + 14000 + Math.random() * 12000;
            p.walkT = null; q.walkT = null;
            p.lookDir = Math.sign(q.x - p.x) || 1; p.lookUntil = now + 900;
            q.lookDir = -p.lookDir; q.lookUntil = now + 900;
            p.squashV += 3; q.squashV += 3;
            p.faceId = "happy"; p.faceT = now + 900;
            q.faceId = "happy"; q.faceT = now + 900;
            bangs.push({ x: p.x + 12, y: p.y - 62, life: 0.9, t: Math.random() < 0.5 ? "♪" : "HI!" });
            const qx = q.x, qy = q.y;
            setTimeout(() => bangs.push({ x: qx - 12, y: qy - 62, life: 0.9, t: "♪" }), 430);
            sfx.pop();
          }
        }
        // sympathetic hop: the main pet springs past — a nearby pal can't
        // help a little bounce of its own
        if (!p.fly && flying && petVY < -140 && Math.abs(p.y - petY) < 18 && Math.abs(p.x - petX) < 240 &&
            now > (p.sympCd || 0)) {
          p.sympCd = now + 2600;
          p.fly = true; p.vy = -130 - Math.random() * 60; p.vx = (Math.random() - 0.5) * 60;
          p.hopT = now;
          if (Math.random() < 0.45) { p.faceId = "happy"; p.faceT = now + 700; }
        }
        // bump: the main pet walks straight through a pal — both squish
        // and the pal gets nudged into a tiny hop. soft collision, not war
        if (!p.fly && !flying && petSpd > 25 && Math.abs(p.y - petY) < 16 && Math.abs(p.x - petX) < 30 &&
            now > (p.bumpCd || 0)) {
          p.bumpCd = now + 8000;
          p.squashV += 4; squashV += 2;
          p.fly = true; p.vy = -140; p.vx = Math.sign(p.x - petX || 1) * 90;
          p.faceId = Math.random() < 0.5 ? "happy" : "shock"; p.faceT = now + 800;
          hearts.push({ x: p.x, y: p.y - 58, life: 0.9 });
          sfx.pop();
        }
        // follow-the-leader: occasionally picks a buddy to trail
        if (!p.follow && !p.fly && p.walkT === null && pals.length > 1 && Math.random() < dt * 0.05 * (ppsy.follow || 1)) {
          const cand = pals.filter(q2 => q2 !== p && !q2.fly && !q2.stackOn && !q2.tag);
          if (cand.length) {
            p.follow = cand[(Math.random() * cand.length) | 0];
            p.followT = now + 4000 + Math.random() * 5000;
          }
        }
      }
      // trailing a picked buddy — expires fast, drops if the leader flies
      if (p.follow && (now > p.followT || p.follow.fly || p.follow === p || p.follow.stackOn)) p.follow = null;
      if (p.follow && !p.fly && !nappingP) p.walkT = p.follow.x - (p.follow.lookDir || 1) * 46;
      // TAG: a bump can start a chase — "it" hunts the fleer across the
      // platform while the fleer keeps darting away. ends on a catch
      // (both burst laughing + the caught one pops a hop) or on timeout
      if (p.tag) {
        const o = p.tag.on;
        // asymmetric break: the TAGGER flying ends it (the fleer got
        // launched/escaped) but a flying tagger is just a pounce-hop —
        // the fleer keeps playing. real departures are caught by the
        // y-gap, grab, and web checks either way
        if (now > p.tag.until || !o || !pals.includes(o) || o === palHeld || now < o.web ||
            Math.abs(o.y - p.y) > 30 || (p.tag.it && o.fly)) {
          // a clean timeout ends with a shared beat — both stop, trade a
          // tired laugh, then wander off. without this the chase just
          // evaporated mid-stride which read as a glitch
          if (now > p.tag.until && o && pals.includes(o) && o.tag && !o.fly && o !== palHeld && now > o.web && Math.abs(o.y - p.y) <= 30) {
            p.lookDir = Math.sign(o.x - p.x) || 1; p.lookUntil = now + 700;
            o.lookDir = -p.lookDir; o.lookUntil = now + 700;
            p.faceId = o.faceId = "laugh"; p.faceT = o.faceT = now + 800;
            bangs.push({ x: (p.x + o.x) / 2, y: p.y - 70, life: 0.9, t: "♪" });
            o.tag = null;
          }
          p.tag = null;
        }
        else if (p.tag.it) {
          p.walkT = Math.max(plo, Math.min(phi, o.x));
          // pounce-hop when the gap's wide — both slimes walk at the same
          // speed, so a pure footrace could literally never catch up
          if (Math.abs(o.x - p.x) > 70 && Math.random() < dt * 0.45) {
            p.fly = true; p.vy = -170 * animProf(p.sp).hop;
            p.vx = Math.sign(o.x - p.x || 1) * (140 + Math.random() * 60);
            p.hopT = now;
          }
          if (Math.abs(o.x - p.x) < 28 && Math.abs(o.y - p.y) < 20) {
            hearts.push({ x: (p.x + o.x) / 2, y: p.y - 64, life: 1 });
            bangs.push({ x: p.x, y: p.y - 78, life: 0.9, t: "TAG!" });
            p.faceId = "wink"; // the winner smugly winks
            o.faceId = "laugh";
            p.faceT = o.faceT = now + 900;
            o.fly = true; o.vy = -190 * animProf(o.sp).hop; o.vx = (Math.random() - 0.5) * 120; o.hopT = now;
            o.tag = null; p.tag = null;
            p.nextT = now + 3000;
            sfx.pop();
          }
        } else {
          // flee: keep hopping targets away from the tagger — and stumble
          // now and then, which is what lets a chase actually resolve
          const away = Math.sign(p.x - o.x || (Math.random() - 0.5) || 1);
          if (p.walkT === null || Math.abs(p.walkT - p.x) < 10)
            p.walkT = Math.max(plo, Math.min(phi, p.x + away * 100));
          if (Math.random() < dt * 0.55) { p.walkT = null; p.squashV += 2; }
        }
      }
      if (p.x < plo - 6 || p.x > phi + 6) { p.fly = true; p.vy = 80; p.walkT = null; }
      else if (p.walkT !== null && !nappingP) {
        // re-clamp every frame — platform bounds shift, and play-bumps set
        // unclamped targets that used to shove pals off the edge forever
        p.walkT = Math.max(plo, Math.min(phi, p.walkT));
        const dx = p.walkT - p.x;
        if (Math.abs(dx) < 6) {
          p.walkT = null; p.walkV = 0; p.squashV += 2.5;
          // prop errand: reaching the bowl/cushion triggers the ritual —
          // the proximity re-check drops goals that went stale mid-walk
          if (p.propGoal) {
            const pg = p.propGoal;
            p.propGoal = null;
            if (pg.kind === "bowl" && bowl && Math.abs(bowl.x - p.x) < 50) {
              p.bowlCd = now + 45000 + Math.random() * 30000;
              p.lookDir = Math.sign(bowl.x - p.x) || 1;
              if ((bowl.fill ?? 2) <= 0) {
                // empty bowl — the pal just tilts its head and moves on
                p.lookUntil = now + 1200;
                bangs.push({ x: p.x, y: p.y - 64, life: 0.9, t: "?" });
              } else {
                bowl.fill = Math.max(0, (bowl.fill ?? 2) - 1);
                dirty = true;
                p.lookUntil = now + 2400;
                p.faceId = "munch"; p.faceT = now + 2200;
                for (let k = 0; k < 4; k++) fx.push({ x: bowl.x + (Math.random() - 0.5) * 14, y: bowl.y - 10, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, life: 0.5, c: "#d9a05b" });
                if (Math.random() < 0.4) hearts.push({ x: p.x, y: p.y - 60, life: 1 });
              }
            } else if (pg.kind === "cushion" && cushion && Math.abs(cushion.x - p.x) < 50) {
              if (cushionBusy(p, now)) {
                // taken — one slime per puff. stands a beat, miffed, gives up
                p.restCd = now + 18000;
                p.lookUntil = now + 900;
                p.squashV += 2;
                bangs.push({ x: p.x, y: p.y - 62, life: 0.9, t: "?" });
              } else {
              p.x += (cushion.x - p.x) * 0.6;
              p.restUntil = now + 8000 + Math.random() * 6000;
              p.restCd = p.restUntil + 25000 * (ppsy.sleep || 1); // lazy pals re-nap sooner, hyper ones hold off
              p.squashV += 3;
              for (let k = 0; k < 4; k++) fx.push({ x: cushion.x + (k - 1.5) * 8, y: cushion.y - 4, vx: (k - 1.5) * 16, vy: -12, life: 0.4, c: "#f0d0e0" });
              }
            } else if (pg.kind === "box" && box && Math.abs(box.x - p.x) < 50) {
              // a pal-sized box is irresistible — it climbs in and vanishes
              p.x = box.x;
              p.boxCd = now + 40000 + Math.random() * 25000;
              p.hideUntil = now + 3200 + Math.random() * 3200;
              p.squashV += 3;
              for (let k = 0; k < 5; k++) fx.push({ x: box.x + (k - 2) * 6, y: box.y - 12, vx: (k - 2) * 13, vy: -26 - Math.random() * 18, life: 0.5, c: "#d8c49a" });
              bangs.push({ x: box.x, y: box.y - 38, life: 0.9, t: "?" });
            } else if (pg.kind === "plant" && plant && Math.abs(plant.x - p.x) < 50) {
              // sniff sniff — a happy nuzzle or a pollen sneeze
              p.plantCd = now + 38000 + Math.random() * 20000;
              p.lookDir = Math.sign(plant.x - p.x) || 1;
              p.lookUntil = now + 1600;
              if (Math.random() < 0.25) {
                p.faceId = "shock"; p.faceT = now + 800;
                p.squashV += 5;
                for (let k = 0; k < 5; k++) fx.push({ x: plant.x + (Math.random() - 0.5) * 14, y: plant.y - 26, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40, life: 0.6, c: "#9adf8a" });
                bangs.push({ x: p.x, y: p.y - 62, life: 0.9, t: "!" });
              } else {
                p.faceId = "content"; p.faceT = now + 1800;
                hearts.push({ x: p.x, y: p.y - 58, life: 1 });
                plant.steamUntil = Date.now() + 4000;
              }
            } else if (pg.kind === "music" && music && Math.abs(music.x - p.x) < 50) {
              // the little DJ winds the box — everyone nearby gets the bounce
              p.musicCd = now + 50000 + Math.random() * 25000;
              p.lookDir = Math.sign(music.x - p.x) || 1;
              p.lookUntil = now + 1200;
              music.spinUntil = Date.now() + 2800;
              for (let k = 0; k < 4; k++) bangs.push({ x: music.x - 12 + k * 10, y: music.y - 28 - k * 7, life: 1 + k * 0.15, t: "♪" });
              for (const q of pals) {
                if (Math.abs(q.x - music.x) < 300 && Math.abs(q.y - music.y) < 40 && !q.fly && q !== palHeld && now > (q.restUntil || 0) && !(now < (q.hideUntil || 0))) {
                  q.fly = true; q.vy = -160 - Math.random() * 60; q.vx = (Math.random() - 0.5) * 70; q.hopT = now;
                  q.faceId = "happy"; q.faceT = now + 900;
                }
              }
              sfx.pop();
            } else if (pg.kind === "mirror" && mirror && Math.abs(mirror.x - p.x) < 50) {
              // a peek in the glass: bold pals preen, timid ones bolt
              p.mirrorCd = now + 42000 + Math.random() * 22000;
              p.lookDir = Math.sign(mirror.x - p.x) || 1;
              if (ppsy.flee) {
                p.faceId = "shock"; p.faceT = now + 900;
                p.fly = true; p.vy = -160; p.vx = -p.lookDir * 150; p.hopT = now;
                bangs.push({ x: p.x, y: p.y - 62, life: 1, t: "!" });
              } else {
                p.lookUntil = now + 1900;
                p.faceId = "smug"; p.faceT = now + 1700;
                for (let k = 0; k < 6; k++) fx.push({ x: mirror.x + (Math.random() - 0.5) * 16, y: mirror.y - 32 + Math.random() * 22, vx: (Math.random() - 0.5) * 26, vy: -16 - Math.random() * 20, life: 0.5, c: "#ffffff" });
                bangs.push({ x: p.x, y: p.y - 62, life: 1.1, t: "✦" });
                if (Math.random() < 0.3) hearts.push({ x: p.x, y: p.y - 58, life: 1 });
              }
            } else if (pg.kind === "mat" && mat && Math.abs(mat.x - p.x) < 50) {
              // the pad is irresistible — one happy boing, then it wanders off
              p.matCd = now + 32000 + Math.random() * 20000;
              p.x = mat.x;
              p.fly = true; p.vy = -240 * animProf(p.sp).hop; p.vx = (Math.random() - 0.5) * 80; p.hopT = now;
              p.faceId = "happy"; p.faceT = now + 1100;
              p.squashV += 4;
              matPoof = now + 700;
              bangs.push({ x: mat.x, y: mat.y - 32, life: 0.9, t: "♪" });
              sfx.boing();
            } else if (pg.kind === "jar" && jar && Math.abs(jar.x - p.x) < 50) {
              // cookie raid — a nibble if stocked, else a confused stare
              p.jarCd = now + 46000 + Math.random() * 24000;
              p.lookDir = Math.sign(jar.x - p.x) || 1;
              if ((jar.fill ?? 2) <= 0) {
                p.lookUntil = now + 1100;
                bangs.push({ x: p.x, y: p.y - 62, life: 0.9, t: "?" });
              } else {
                jar.fill--;
                jar.raidUntil = Date.now() + 1500;
                dirty = true;
                p.lookUntil = now + 1800;
                p.faceId = "munch"; p.faceT = now + 1600;
                for (let k = 0; k < 4; k++) fx.push({ x: jar.x + (Math.random() - 0.5) * 14, y: jar.y - 18, vx: (Math.random() - 0.5) * 44, vy: -22 - Math.random() * 26, life: 0.5, c: "#d9a05b" });
                if (Math.random() < 0.35) hearts.push({ x: p.x, y: p.y - 60, life: 1 });
              }
            }
          }
        }
        else {
          p.lookDir = Math.sign(dx);
          p.lookUntil = now + 250;
          const pmv = psp.mv;
          if (pmv === "hop") {           // frogs crouch, then take the trip in one leap
            if (!p.hopWind) { p.hopWind = now + 110; p.squashV += 4; }
            else if (now >= p.hopWind) {
              p.hopWind = 0;
              p.fly = true;
              p.vy = -210 * animProf(p.sp).hop;
              p.vx = Math.sign(dx) * Math.min(210, Math.abs(dx) * 2.8);
              p.walkT = null;
              p.hopT = now;
            }
          } else if (pmv === "blink" && now > (p.blinkT || 0)) {
            p.blinkT = now + 430;
            for (let k = 0; k < 4; k++) fx.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y - Math.random() * 28, vx: 0, vy: -14, life: 0.45, c: "#9aadff" });
            p.x += Math.sign(dx) * Math.min(30, Math.abs(dx));
            p.squashV += 1.2;
          } else if (pmv === "scurry") { // skitter bursts
            if ((now + i * 211) % 700 < 260) p.x += Math.sign(dx) * 150 * (ppsy.spd || 1) * dt;
          } else {
            // ramp into the stroll — instant full speed reads as a slide
            p.walkV = Math.min((p.walkV || 0) + dt * 300, 52 * (ppsy.spd || 1));
            p.x += Math.sign(dx) * p.walkV * dt;
            // distance-driven gait: each footfall dips the blob a touch
            p.gait = (p.gait || 0) + p.walkV * dt * 0.14;
            const pgs = Math.floor(p.gait / Math.PI);
            if (pgs !== (p.gaitStep || 0)) { p.gaitStep = pgs; p.squashV += 0.32; }
          }
        }
      } else if (now > p.nextT && now > (p.restUntil || 0)) {
        // treat FOMO: a snack draws a crowd — pals converge hoping to
        // snatch it first, even hopping off their platform for a lower one
        if (treat && !p.tag && !p.stackOn && !p.fly && Math.abs(treat.x - p.x) < 480 && treat.y > p.y - 40) {
          if (treat.y - p.y > 44) {
            // snack sits on a lower platform — hop off the edge toward it
            p.fly = true;
            p.vy = -50;
            p.vx = Math.max(-200, Math.min(200, (treat.x - p.x) * 1.5));
            p.walkT = null;
          } else {
            p.walkT = Math.max(plo, Math.min(phi, treat.x + (p.x < treat.x ? -12 : 12)));
          }
          p.nextT = now + 900;
        }
        // dance-along: the main pet's groove is contagious — pals on the
        // same platform bounce in time instead of their own routine
        else if (danceT0 && now - danceT0 < 1700 && Math.abs(p.y - petY) < 30 && Math.random() < 0.55) {
          p.fly = true;
          p.vy = -180 - Math.random() * 70;
          p.vx = (Math.random() - 0.5) * 80;
          p.hopT = now;
          p.faceId = "happy";
          p.faceT = now + 800;
          if (Math.random() < 0.4) bangs.push({ x: p.x, y: p.y - 66, life: 0.8, t: "♪" });
          p.nextT = now + 1100;
        }
        else {
        const r = Math.random();
        // mini signature flourish: pals show off a themed ~1s version
        // of their species' act — they used to be skill-less statues
        if (psp.sig && !isBaby(psp) && !p.tag && !p.fly && Math.random() < 0.12) {
          p.sigT = now + 900;
          p.sigId = psp.sig;
          p.sigDid = 0;
          p.walkT = null;
          p.tag = null;
        }
        else if (r < 0.5) p.walkT = Math.max(plo, Math.min(phi, p.x + (Math.random() - 0.5) * 220));
        else if (r < 0.6) { p.fly = true; p.vy = -230 * animProf(p.sp).hop; p.vx = (Math.random() - 0.5) * 140; p.hopT = now; }
        else if (r < 0.68 && bowl && p.plat && Math.abs(bowl.y - p.plat.y) < 16 &&
                 now > (p.bowlCd || 0) && Math.abs(bowl.x - p.x) > 60) {
          // snack run: same-platform bowl draws the occasional visit
          p.walkT = Math.max(plo, Math.min(phi, bowl.x + (p.x < bowl.x ? -16 : 16)));
          p.propGoal = { kind: "bowl" };
        }
        else if (r < 0.72 && cushion && p.plat && Math.abs(cushion.y - p.plat.y) < 16 &&
                 now > (p.restCd || 0) && Math.abs(cushion.x - p.x) > 46 && !cushionBusy(p, now)) {
          // nap spot: pals claim the cushion for a doze now and then
          p.walkT = Math.max(plo, Math.min(phi, cushion.x));
          p.propGoal = { kind: "cushion" };
        }
        else if (r < 0.78 && (box || plant || music || mirror || mat || jar) && p.plat) {
          // whimsy run: duck into the box, sniff the sprout, wind the tune,
          // preen at the mirror, bounce the pad, raid the cookie jar
          const w = Math.random();
          if (w < 0.2 && box && Math.abs(box.y - p.plat.y) < 16 && now > (p.boxCd || 0) && Math.abs(box.x - p.x) > 50) {
            p.walkT = Math.max(plo, Math.min(phi, box.x + (p.x < box.x ? -12 : 12)));
            p.propGoal = { kind: "box" };
          } else if (w < 0.4 && plant && Math.abs(plant.y - p.plat.y) < 16 && now > (p.plantCd || 0) && Math.abs(plant.x - p.x) > 44) {
            p.walkT = Math.max(plo, Math.min(phi, plant.x + (p.x < plant.x ? -14 : 14)));
            p.propGoal = { kind: "plant" };
          } else if (w < 0.55 && music && Math.abs(music.y - p.plat.y) < 16 && now > (p.musicCd || 0) && Math.abs(music.x - p.x) > 44) {
            p.walkT = Math.max(plo, Math.min(phi, music.x + (p.x < music.x ? -18 : 18)));
            p.propGoal = { kind: "music" };
          } else if (w < 0.68 && mirror && Math.abs(mirror.y - p.plat.y) < 16 && now > (p.mirrorCd || 0) && Math.abs(mirror.x - p.x) > 44) {
            p.walkT = Math.max(plo, Math.min(phi, mirror.x + (p.x < mirror.x ? -24 : 24)));
            p.propGoal = { kind: "mirror" };
          } else if (w < 0.82 && mat && Math.abs(mat.y - p.plat.y) < 16 && now > (p.matCd || 0) && Math.abs(mat.x - p.x) > 44) {
            p.walkT = Math.max(plo, Math.min(phi, mat.x));
            p.propGoal = { kind: "mat" };
          } else if (jar && Math.abs(jar.y - p.plat.y) < 16 && now > (p.jarCd || 0) && Math.abs(jar.x - p.x) > 44) {
            p.walkT = Math.max(plo, Math.min(phi, jar.x + (p.x < jar.x ? -16 : 16)));
            p.propGoal = { kind: "jar" };
          }
        }
        else if (r < 0.8 && psp.trait === "web" && curX > -9000 &&
                 Math.hypot(curX - p.x, curY - p.y) < 380) {
          // fires a silk line at the cursor, then dangles like a pendulum
          p.web = now + 2400;
          p.webA = Math.sign(p.x - curX || 1) * 0.35;
          p.webAV = 0;
        }
        else if (r < 0.9 && pals.length > 1) {
          // huddle: lonely pals drift toward the nearest stackmate
          let best = null, bd = 220;
          for (const q of pals) {
            if (q === p || q.fly || q === palHeld) continue;
            const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y) * 2;
            if (d < bd) { bd = d; best = q; }
          }
          if (best && bd > 70) p.walkT = Math.max(plo, Math.min(phi, best.x + (Math.random() - 0.5) * 70));
        }
        else if (Math.abs(p.y - petY) < (SPECIES[active].trait === "royal" ? 60 : 20) &&
                 Math.abs(petX - p.x) > (SPECIES[active].trait === "royal" ? 40 : 60)) {
          // drift toward the main pet — rex's court gathers wider
          p.walkT = Math.max(plo, Math.min(phi, petX + (Math.random() - 0.5) * 60));
        }
        p.nextT = now + (2400 + Math.random() * 3600) * (ppsy.pace || 1);
        }
      }
      // mini signature flourish player — themed particles for ~900ms,
      // then the species' bang glyph. cancels if the pal gets disrupted
      if (p.sigT) {
        // stacked/held/webbed pals skip the flourish; airborne is fine —
        // hop/zig flairs launch the pal themselves
        if (p.stackOn || p === palHeld || now < p.web || nappingP) p.sigT = 0;
        else {
          const fl = PAL_FLAIR[p.sigId];
          const e = now - (p.sigT - 900);
          if (!fl || e >= 900) p.sigT = 0;
          else {
            const col = fl.c[(Math.random() * fl.c.length) | 0];
            if (fl.pat === "rain" && Math.random() < dt * 26) {
              fx.push({ x: p.x + Math.random() * 44 - 22, y: p.y - 74 - Math.random() * 18, vx: 0, vy: 80 + Math.random() * 50, life: 0.7, c: col });
            } else if (fl.pat === "rise" && Math.random() < dt * 22) {
              fx.push({ x: p.x + Math.random() * 20 - 10, y: p.y - 6, vx: Math.random() * 16 - 8, vy: -60 - Math.random() * 50, life: 0.7, c: col });
            } else if (fl.pat === "drift" && Math.random() < dt * 9) {
              fx.push({ x: p.x + Math.random() * 44 - 22, y: p.y - 18 - Math.random() * 24, vx: Math.random() * 10 - 5, vy: -13, life: 1, c: col });
            } else if (fl.pat === "cone" && Math.random() < dt * 30) {
              fx.push({ x: p.x + p.lookDir * 14, y: p.y - 22, vx: p.lookDir * (70 + Math.random() * 70), vy: -24 - Math.random() * 20, life: 0.5, c: col });
            } else if (fl.pat === "crackle" && Math.random() < dt * 26) {
              fx.push({ x: p.x + Math.random() * 20 - 10, y: p.y - 30 - Math.random() * 12, vx: Math.random() * 40 - 20, vy: -50, life: 0.25, c: col });
            } else if (fl.pat === "implode" && Math.random() < dt * 20) {
              const a = Math.random() * 6.28;
              fx.push({ x: p.x + Math.cos(a) * 34, y: p.y - 24 + Math.sin(a) * 20, vx: -Math.cos(a) * 52, vy: -Math.sin(a) * 34, life: 0.55, c: col });
            } else if ((fl.pat === "hop" || fl.pat === "zig") && e < 60 && !p.fly) {
              p.fly = true;
              p.vy = -150;
              p.vx = (Math.random() < 0.5 ? -1 : 1) * (fl.pat === "zig" ? 110 : 60);
            } else if (fl.pat === "ring" && e < 70) {
              for (let k2 = 0; k2 < 8; k2++) {
                const a = (k2 / 8) * 6.28;
                fx.push({ x: p.x, y: p.y - 26, vx: Math.cos(a) * 80, vy: Math.sin(a) * 55, life: 0.6, c: fl.c[k2 % fl.c.length] });
              }
            }
            if (!p.sigDid && e > 650) {
              p.sigDid = 1;
              bangs.push({ x: p.x, y: p.y - 68, life: 0.9, t: fl.t });
              p.faceId = "happy";
              p.faceT = now + 900;
              p.squashV += 3;
              sfx.pop();
            }
          }
        }
      }
      // glance at a nearby cursor like the main pet does
      if (p.walkT === null && Math.abs(curX - p.x) < 230 && Math.abs(curY - p.y) < 170 && Math.random() < dt * 1.5) {
        p.lookDir = Math.sign(curX - p.x) || 1;
        p.lookUntil = now + 500;
      }
      // stack attempt: sidle up to a stackmate and climb on — the
      // Slime Rancher / Dragon Quest totem. riders can be mounts too,
      // so towers of 3 happen when MAX_PALS allows. rare, idle-only
      if (p.walkT === null && !nappingP && now > p.stackCd && Math.random() < dt * 0.55) {
        // chain walks are capped: a cyclic stack (A on B while B on A) would
        // otherwise spin this while-loop forever and hard-freeze the frame
        const depth = (q2) => { let d = 0; while (q2.stackOn && d <= pals.length) { q2 = q2.stackOn; d++; } return d; };
        // reject mounts that would close a loop: the target's own stack
        // chain must not already pass through p
        const chainHas = (q2, who) => { let s = 0; while (q2) { if (q2 === who) return true; if (++s > pals.length) return true; q2 = q2.stackOn; } return false; };
        const q = pals.find((q2) => q2 !== p && q2 !== palHeld && !q2.fly &&
          now > (q2.restUntil || 0) && // no climbing onto a sleeping pal
          depth(q2) < 2 &&
          !chainHas(q2, p) &&
          !pals.some((r) => r.stackOn === q2) &&
          Math.abs(q2.y - p.y) < 8 && Math.abs(q2.x - p.x) < 58);
        if (q) {
          p.stackOn = q;
          p.accAct = null; // mounting interrupts the doodad's bit
          p.stackT = now + 4000 + Math.random() * 5000;
          p.stackRise = 0;
          p.faceId = "happy"; p.faceT = now + 1300;
          q.squashV += 5;
          hearts.push({ x: (p.x + q.x) / 2, y: q.y - 92, life: 1 });
          sfx.pop();
        }
      }
      }
    }
    // body separation: grounded pals on the same deck shouldn't clip
    // through each other — a soft mutual shove keeps a slime-width gap
    // (reads as jostling, and it's what used to make crowds look fake)
    if (!p.fly && !p.stackOn && p !== palHeld && !nappingP) {
      let jamQ = null;
      for (const q of pals) {
        if (q === p || q.fly || q === palHeld || q.stackOn === p || p.stackOn === q) continue;
        if (now < (q.hideUntil || 0)) continue; // a pal in the box has no body to shove
        // exact overlap reads as ddx=0 and used to kill both the push and
        // the jam check — a deterministic nudge keeps them separable
        let ddx = p.x - q.x;
        if (Math.abs(ddx) <= 0.01) ddx = ((pals.indexOf(p) - pals.indexOf(q)) || 1) * 0.12;
        if (Math.abs(p.y - q.y) < 18 && Math.abs(ddx) < 34) {
          const push = (34 - Math.abs(ddx)) * Math.sign(ddx) * dt * 2.2;
          // a napping pal stays put — the awake one absorbs the full shove
          if (now < (q.restUntil || 0)) p.x += push * 2; else { p.x += push; q.x -= push; }
          // jammed: p's target lies past q and q isn't moving out of the
          // way — two slimes can't walk through each other
          const s = Math.sign(q.x - p.x);
          if (p.walkT !== null && Math.sign(p.walkT - p.x) === s &&
              (q.walkT === null || Math.sign(q.walkT - q.x) === -s)) jamQ = q;
        }
      }
      // a jam breaks one of two ways: leap clean over, or tread right off
      // their head — feisty slimes jump, everyone else just steps on the
      // blocker. a napping pal is always hopped: sleep stays sacred
      if (jamQ && now > (p.blockCd || 0)) {
        p.blockT = (p.blockT || 0) + dt * 1000;
        if (p.blockT > 520) {
          p.blockT = 0; p.blockCd = now + 1800;
          const dir = Math.sign(p.walkT - p.x) || 1;
          if (now > (jamQ.restUntil || 0) && (ppsy.pace || 1) >= 0.9 && Math.random() < 0.65) {
            // stepped on: squashed flat + a reaction set by the stepped
            // pal's own personality — shy slimes reel, feisty ones fume
            jamQ.squashV += 9; jamQ.stepped = now + 500;
            jamQ.walkT = null; jamQ.hopWind = 0;
            jamQ.nextT = Math.max(jamQ.nextT || 0, now + 1200); // stands there a beat
            const qpsy = PSYCH[(SPECIES[jamQ.sp] || {}).ps] || {};
            if (qpsy.flee) { jamQ.faceId = "dizzy"; bangs.push({ x: jamQ.x, y: jamQ.y - 56, life: 0.9, t: "..." }); }
            else if ((qpsy.pace || 1) <= 0.85 || (qpsy.startle || 1) > 1.2) { jamQ.faceId = "grumpy"; bangs.push({ x: jamQ.x, y: jamQ.y - 56, life: 0.9, t: "!" }); }
            else { jamQ.faceId = "pout"; bangs.push({ x: jamQ.x, y: jamQ.y - 56, life: 0.9, t: "!!" }); }
            jamQ.faceT = now + 1100;
            p.fly = true; p.vy = -150 * animProf(p.sp).hop; p.vx = dir * 165;
          } else {
            p.fly = true; p.vy = -215 * animProf(p.sp).hop; p.vx = dir * 175;
          }
          p.hopT = now; p.walkT = null; p.squashV += 4;
          for (let k = 0; k < 3; k++) fx.push({ x: p.x - dir * 8, y: p.y - 6, vx: -dir * (22 + k * 16), vy: -12, life: 0.4, c: "#cfc4ae" });
        }
      } else if (!jamQ) p.blockT = 0;
    }
    p.squashV += (-95 * p.squash - 6.5 * p.squashV) * dt;
    p.squash += p.squashV * dt;
    legTick(psp, p.x, p.y, dt, p.walkT !== null, p.fly, (v) => { p.squashV += v; });

    // legendary auras radiate to nearby pals: pulsar's gravity slowly
    // reels them across the platform, stella's starlight perks them up
    const lgMain = LEG[SPECIES[active].id];
    if (lgMain && !petHome && !p.fly && p !== palHeld && Math.abs(p.y - petY) < 40) {
      const adx = petX - p.x;
      if (lgMain.pulse && Math.abs(adx) > 60 && Math.abs(adx) < 320) {
        p.x += adx * dt * 0.05;
        if (Math.random() < dt * 1.2) fx.push({ x: p.x, y: p.y - 20, vx: -Math.sign(adx) * 20, vy: -10, life: 0.4, c: "#8ad4f0" });
      }
      if (lgMain.starburst && Math.abs(adx) < 220 && Math.random() < dt * 0.5) {
        fx.push({ x: p.x + Math.random() * 30 - 15, y: p.y - Math.random() * 50, vx: 0, vy: -24, life: 0.7, c: "#ffe9a8" });
        if (Math.random() < 0.25 && now > p.faceT) { p.faceId = "happy"; p.faceT = now + 800; }
      }
    }

    // play: proximity with the main pet — face each other, hearts, bump apart
    if (!p.fly && p !== palHeld && !held && !flying && !petHome && !nappingP && Math.abs(p.y - petY) < 20 && Math.abs(p.x - petX) < 74 &&
        now > p.playCd && now > mainPlayCd) {
      // hyper pals want to play again soon; calm/lazy take a long breather
      p.playCd = mainPlayCd = now + 6000 * (ppsy.pace || 1);
      stats.plays++;
      p.faceId = "happy";
      p.faceT = now + 900;
      contentUntil = now + 900;
      p.lookDir = Math.sign(petX - p.x) || 1;
      p.lookUntil = now + 800;
      lookDir = -p.lookDir;
      lookUntil = now + 800;
      hearts.push({ x: (p.x + petX) / 2, y: Math.min(p.y, petY) - 62, life: 1 });
      p.squashV += 5;
      squashV += 5;
      if (Math.random() < 0.5) sfx.pop(); else sfx.heart();
      // shy pals scamper far away after a bump; others just hop back
      const pd = ppsy.flee ? 160 : 70;
      p.walkT = p.x + (p.x < petX ? -pd : pd);
    }
    // pal-vs-pal play
    for (const q of pals) {
      if (q === p || q === palHeld || p === palHeld || q.fly || p.fly || nappingP || now < (q.restUntil || 0) || Math.abs(q.y - p.y) > 20) continue;
      if (Math.abs(q.x - p.x) < 60 && now > p.playCd && now > q.playCd) {
        const qpsy = PSYCH[(SPECIES[q.sp] || {}).ps] || {};
        p.playCd = q.playCd = now + 6000 * Math.max(ppsy.pace || 1, qpsy.pace || 1);
        stats.plays++;
        p.faceId = q.faceId = "happy";
        p.faceT = q.faceT = now + 900;
        // face each other for the beat — without this the bump read as
        // two sprites popping hearts while staring off into space
        p.lookDir = Math.sign(q.x - p.x) || 1;
        q.lookDir = -p.lookDir;
        p.lookUntil = q.lookUntil = now + 800;
        // same-species pairs NUZZLE — heart eyes, they lean together and
        // double-heart instead of bouncing apart
        if (SPECIES[p.sp].id === SPECIES[q.sp].id) {
          p.faceId = q.faceId = "love";
          p.faceT = q.faceT = now + 1400;
          hearts.push({ x: (p.x + q.x) / 2, y: p.y - 62, life: 1 });
          hearts.push({ x: (p.x + q.x) / 2 + 10, y: p.y - 74, life: 1.1 });
          p.squashV += 3; q.squashV += 3;
          p.walkT = (p.x + q.x) / 2 - 18;
          q.walkT = (p.x + q.x) / 2 + 18;
          sfx.heart();
          continue;
        }
        // elemental synergy: reactive trait pairs make something when they
        // meet — ember steams on droplet, wisps light up near sparks
        const syn = SYNERGY[[SPECIES[p.sp].trait, SPECIES[q.sp].trait].sort().join("+")];
        if (syn && Math.random() < 0.45) {
          const mx2 = (p.x + q.x) / 2;
          for (let k2 = 0; k2 < syn.n; k2++) {
            const a = Math.random() * 6.28;
            fx.push({ x: mx2 + Math.cos(a) * 12, y: p.y - 30 + Math.sin(a) * 10, vx: Math.cos(a) * syn.v, vy: syn.up ? -syn.v - Math.random() * 30 : Math.sin(a) * syn.v, life: 0.7, c: syn.c[(Math.random() * syn.c.length) | 0] });
          }
          bangs.push({ x: mx2, y: p.y - 74, life: 0.9, t: syn.t });
          p.faceId = q.faceId = "laugh";
          p.faceT = q.faceT = now + 900;
          sfx.pop();
          continue;
        }
        // sometimes the bump turns into a game of TAG — one chases, one flees
        if (Math.random() < 0.3 && !p.tag && !q.tag && !p.stackOn && !q.stackOn) {
          const [it, fl] = Math.random() < 0.5 ? [p, q] : [q, p];
          it.tag = { on: fl, it: true, until: now + 3200 };
          fl.tag = { on: it, it: false, until: now + 3200 };
          bangs.push({ x: it.x, y: it.y - 72, life: 0.8, t: "!" });
          continue;
        }
        // ...and sometimes it's just a friendly SHOVE
        if (Math.random() < 0.25) {
          const [sh, vi] = Math.random() < 0.5 ? [p, q] : [q, p];
          vi.fly = true;
          vi.vx = Math.sign(vi.x - sh.x || 1) * (110 + Math.random() * 60);
          vi.vy = -130 * animProf(vi.sp).hop;
          vi.faceId = "shock"; vi.faceT = now + 800;
          sh.faceId = "laugh"; sh.faceT = now + 900;
          bangs.push({ x: vi.x, y: vi.y - 70, life: 0.8, t: "!?" });
          sfx.pop();
          continue;
        }
        hearts.push({ x: (p.x + q.x) / 2, y: p.y - 62, life: 1 });
        p.squashV += 4; q.squashV += 4;
        const pdd = ppsy.flee ? 140 : 60, qdd = qpsy.flee ? 140 : 60;
        p.walkT = p.x + (p.x < q.x ? -pdd : pdd);
        q.walkT = q.x + (q.x < p.x ? -qdd : qdd);
        sfx.pop();
      }
    }

    // copycat hop: a pal that just leapt is contagious — nearby grounded
    // pals sometimes bounce along (play contagion, Slime Rancher-style)
    if (!p.fly && p !== palHeld && !p.stackOn && !nappingP) {
      for (const q of pals) {
        if (q === p || !q.hopT || now - q.hopT > 380 || q.fly || Math.abs(q.y - p.y) > 20 || Math.abs(q.x - p.x) > 130) continue;
        if (Math.random() < dt * 4) {
          p.fly = true;
          p.vy = -190 - Math.random() * 60;
          p.vx = (Math.random() - 0.5) * 90;
          p.hopT = now; // the bounce can chain
          p.squashV += 2;
        }
      }
    }

    // audience: pals pause and watch the main pet's signature act
    if (sigT0 && !p.fly && !p.stackOn && !nappingP && Math.abs(p.y - petY) < 40 && Math.abs(p.x - petX) < 300 && Math.random() < dt * 7) {
      p.lookDir = Math.sign(petX - p.x) || 1;
      p.lookUntil = now + 600;
      if (Math.random() < 0.15 && now > p.faceT) {
        p.faceId = Math.random() < 0.5 ? "shock" : "happy";
        p.faceT = now + 800;
      }
    }

    // draw — base scale NOT blobSize().scale: that one already carries the
    // active pet's baby factor and would shrink every pal. skipped while
    // the pal is hiding inside the box (the box rustles instead)
    if (!(now < (p.hideUntil || 0))) {
    const psc = (1.3 + level * 0.4) * sizeMul * (isBaby(psp) ? 0.55 : 0.92);
    const pbs = Math.sin(t * 2.6 + p.ph) * 0.028;
    const pmsq = p.squash / (1 + Math.abs(p.squash) * 0.5) * (reduceMotion ? 0.4 : 1);
    const psx = psc * (1 + pmsq * 0.25 + pbs);
    const psy2 = psc * (1 - pmsq * 0.18 - pbs * 0.7);
    const groundY = p.fly ? p.y : (p.plat ? p.plat.y : p.y);
    const pshW = SW * psx * 1.1;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(shadowImg(), p.x - pshW / 2, groundY - 3, pshW, pshW * 0.27);
    ctx.globalAlpha = 1;
    if (p.web && now < p.web && curX > -9000) {
      ctx.strokeStyle = "rgba(238,242,246,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - SH * psy2 + 2);
      ctx.lineTo(curX + ((i % 3) - 1) * 12, curY);
      ctx.stroke();
    }
    ctx.save();
    const phov = psp.mv === "hover" && !p.fly ? 10 + Math.sin(t * 2.2 + p.ph) * 6 : 0;
    // gait bob: same footfall bounce the main pet gets, driven by p.gait
    const pBob = !p.fly && !p.stackOn && p.walkT !== null ? Math.abs(Math.sin(p.gait || 0)) * 2 : 0;
    ctx.translate(p.x, p.y - phov - pBob);
    // totem riders sway on top of the stack; grounded walkers lean in —
    // smoothed so a direction flip rolls through instead of snapping
    if (p.stackOn) { ctx.rotate(Math.sin(t * 6 + p.ph) * 0.07); p.leanSm = 0; }
    else {
      const plGoal = !p.fly && p.walkT !== null ? Math.sign(p.walkT - p.x) * 0.05 * animProf(p.sp).lean : 0;
      p.leanSm = (p.leanSm || 0) + (plGoal - (p.leanSm || 0)) * Math.min(1, dt * 9);
      ctx.rotate(p.leanSm);
    }
    let pf = "idle";
    if (now < (p.restUntil || 0)) pf = "sleeping";
    else if (now < p.faceT) pf = p.faceId || "happy";
    else if (now < p.lookUntil) pf = p.lookDir < 0 ? "lookL" : "lookR";
    else {
      const pap = animProf(p.sp);
      if ((t * 1000 + p.ph * 1000) % pap.blink < pap.blinkLen) pf = "blink";
    }
    p.pf = pf; // the status card draws the pal's live face
    if (psp.trait === "wisp") ctx.globalAlpha = 0.85;
    const plg = LEG[psp.id];
    if (plg && plg.wings) drawWings(ctx, t + p.ph, psx, psy2, p.fly, plg.wings);
    ctx.drawImage(sprite(pf, p.sp, false, true), -SW * psx / 2, -SH * psy2, SW * psx, SH * psy2);
    const eq2 = accEquip[psp.id];
    if (eq2) {
      accMV = { jig: (p.leanSm || 0) * 0.55, lean: p.leanSm || 0, bob: pBob, sq: pmsq, t, ph: p.ph };
      drawAcc(ctx, eq2, 0, -SH * psy2 + 2, Math.max(1.2, psy2 * 0.9));
      accMV = null;
    }
    if (isBaby(psp)) drawPaci(ctx, 0, -SH * psy2 * 0.42, Math.max(1, psy2 * 0.85));
    ctx.restore();
    ctx.globalAlpha = 1;
    }
  }

  // webby's silk line: live tether to the cursor while dangling, or the
  // growing shot while the webshot signature is still aiming
  if ((webbing || (sigT0 && sigId === "webshot")) && curX > -9000) {
    const topX = petX, topY = petY - bob - hoverBob - SH * sy + 2;
    const f = webbing ? 1 : Math.min(1, (now - sigT0) / 380);
    const lx = topX + (curX - topX) * f, ly = topY + (curY - topY) * f;
    ctx.strokeStyle = "rgba(238,242,246,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    const sag = webbing ? Math.max(0, (92 - Math.hypot(lx - topX, ly - topY)) * 0.1) : 0;
    ctx.quadraticCurveTo((topX + lx) / 2, (topY + ly) / 2 + sag, lx, ly);
    ctx.stroke();
    if (webbing) {
      ctx.fillStyle = "#eef2f6";
      ctx.fillRect(lx - 2, ly - 2, 4, 4);
    }
  }

  if (!petHome && now >= boxHide) {
  ctx.save();
  ctx.translate(petX, petY - bob - hoverBob - spinLift * 13);
  ctx.rotate((angle + leanTilt) * (reduceMotion ? 0.35 : 1));
  // soft-body shear: the jelly's top drags behind horizontal motion —
  // feet stay planted at y=0, the crown smears sideways under accel
  if (!reduceMotion) ctx.transform(1, 0, jigX, 1, 0, 0);
  // the twirl pivots on the body's middle, not the feet — a feet-pivot
  // full turn swings the blob in an orbit and reads broken
  if (spinA && !reduceMotion) {
    ctx.translate(0, -SH * sy * 0.45);
    ctx.rotate(spinA);
    ctx.translate(0, SH * sy * 0.45);
  }
  // jelly stretch while dragged: elongates along the pull direction
  if (held && heldStretch > 0.02 && !reduceMotion) {
    ctx.rotate(heldStretchAng);
    ctx.scale(1 + heldStretch, 1 - heldStretch * 0.45);
    ctx.rotate(-heldStretchAng);
  }
  const drawW = walking ? SW * sx * (1 + Math.sin(t * 18) * 0.04) : SW * sx;
  ctx.globalAlpha = petAlpha * (SPECIES[active].trait === "wisp" ? 0.85 : 1);
  const lg = LEG[SPECIES[active].id];
  if (lg && lg.wings) drawWings(ctx, t, sx, sy, flying, lg.wings);
  if (lg && lg.legs && webbing) drawLegs(ctx, t, sx, sy);
  ctx.drawImage(currentSprite(now), -drawW / 2, -SH * sy, drawW, SH * sy);
  const eq = accEquip[SPECIES[active].id];
  if (eq) {
    accMV = { jig: jigX, lean: leanTilt + angle, bob, sq: msq, t, ph: 0 };
    drawAcc(ctx, eq, 0, -SH * sy + 2, Math.max(1.2, sy * 0.9));
    accMV = null;
  }
  if (isBaby(SPECIES[active])) drawPaci(ctx, 0, -SH * sy * 0.42, Math.max(1, sy * 0.85));
  // weather props: a little umbrella in the rain, snowflakes in snow —
  // it knows what the sky is doing outside
  if (wxRainy()) drawSpr(ctx, "umbra", 13 * sx, -SH * sy * 0.72, Math.max(2, sx * 1.6));
  if (wxSnowy() && now % 2200 < 80)
    drawSpr(ctx, "flake", Math.sin(t * 3) * 14 * sx, -SH * sy - 6 - Math.sin(t * 5) * 3, 2);
  ctx.restore();
  ctx.globalAlpha = 1;
  }

  // status-card target: gold ring under the tracked slime + a bouncing
  // chevron overhead, so the open card's subject is unambiguous
  if (cardTarget && ((cardTarget === "pet" && !petHome) || pals.includes(cardTarget))) {
    const tp = cardTarget === "pet" ? SPECIES[active] : SPECIES[cardTarget.sp];
    const csc = cardTarget === "pet" ? blobSize().scale : (1.3 + level * 0.4) * sizeMul * (isBaby(tp) ? 0.55 : 0.92);
    const tx = cardTarget === "pet" ? petX : cardTarget.x;
    const phov = cardTarget !== "pet" && tp.mv === "hover" && !cardTarget.fly ? 10 + Math.sin(t * 2.2 + cardTarget.ph) * 6 : 0;
    const feetY = cardTarget === "pet" ? petY - bob - hoverBob : cardTarget.y - phov;
    const rw = SW * csc * 0.55 * (1 + Math.sin(t * 5) * 0.07);
    ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
    ctx.drawImage(sprImg("ring", "#ffd75e"), Math.round(tx - rw), Math.round(feetY - rw * 0.22), Math.ceil(rw * 2), Math.ceil(rw * 0.44));
    ctx.globalAlpha = 1;
    drawSpr(ctx, "tri", tx, feetY - SH * csc - 12 - Math.abs(Math.sin(t * 4.5)) * 5, 2);
  }

  // pomodoro ring: a thin countdown arc floating over the slime
  if (pomo && !held && !petHome) {
    const frac = Math.max(0, Math.min(1, 1 - (pomoUntil - Date.now()) / pomoLen));
    const ry = petY - bob - hoverBob - SH * sy - 14;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(petX, ry, 7, 0, 7);
    ctx.stroke();
    ctx.strokeStyle = pomoPhase === "focus" ? "#58c940" : "#48b8d8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(petX, ry, 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    drawText(ctx, pomoPhase === "focus" ? "F" : "B", petX - 2, ry - 3, 1, "#ffffff", "#00000066", true);
  }

  // landing ripples: expanding ground rings (pixel ring sprite, squashed)
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += 70 * dt;
    r.life -= dt * 2.1;
    if (r.life <= 0) { ripples.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(0.5, r.life * 0.5);
    ctx.drawImage(sprImg("ring"), Math.round(r.x - r.r), Math.round(r.y - r.r * 0.3), Math.ceil(r.r * 2), Math.ceil(r.r * 0.6));
  }
  // pulsar's vacuum pulses: rings that collapse INWARD toward the slime
  for (let i = gravRings.length - 1; i >= 0; i--) {
    const g = gravRings[i];
    g.r -= 60 * dt;
    g.life -= dt * 1.4;
    if (g.life <= 0 || g.r < 6) { gravRings.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(0.45, g.life * 0.45);
    ctx.drawImage(sprImg("ringv"), Math.round(g.x - g.r), Math.round(g.y - g.r * 0.7), Math.ceil(g.r * 2), Math.ceil(g.r * 1.4));
  }
  ctx.globalAlpha = 1;

  // reduce-motion also caps ambient particle count
  const fxCap = reduceMotion ? 24 : 80;
  while (fx.length > fxCap) fx.shift();
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 0.9;
    if (p.life <= 0) { fx.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.spr) drawSpr(ctx, p.spr, p.x, p.y, 1.5);
    else { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }
  }
  ctx.globalAlpha = 1;

  if (state === "sleeping" && !held) {
    if (now > bubblePop) bubble += dt * 14;
    const br = Math.min(7, bubble);
    if (br > 0.5) {
      ctx.globalAlpha = 0.8;
      const bs = br / 3;
      ctx.drawImage(sprImg("bubble"), Math.round(petX + 14 * sx * 0.28 - 3.5 * bs), Math.round(petY - 13 * sy - 3.5 * bs), Math.ceil(7 * bs), Math.ceil(7 * bs));
      ctx.globalAlpha = 1;
    }
    if (br >= 7) {
      bubble = 0;
      bubblePop = now + 1600;
      squashV += 2;
    }
    if (now - lastZzz > 1300) {
      lastZzz = now;
      zzzs.push({ x: petX + 22, y: petY - 55, life: 1 });
    }
  }
  // cushion doze gets its own lazy zzz trail — shorter, drifting off the puff
  if (now < cushionNap && now - lastZzz > 1700) {
    lastZzz = now;
    zzzs.push({ x: petX + 20, y: petY - 50, life: 0.8 });
  }
  // napping pals drift their own faint zzzs too — otherwise a sleeping pal
  // reads as just... standing there with its eyes closed
  for (const p of pals) {
    if (now < (p.restUntil || 0) && now - (p.zzzT || 0) > 1900) {
      p.zzzT = now;
      zzzs.push({ x: p.x + 18, y: p.y - 44, life: 0.8 });
    }
  }

  for (let i = zzzs.length - 1; i >= 0; i--) {
    const z = zzzs[i];
    z.y -= 18 * dt;
    z.x += 6 * dt;
    z.life -= dt * 0.5;
    if (z.life <= 0) { zzzs.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, z.life);
    drawText(ctx, "Z", z.x, z.y, 2, "#7b95a8", "#00000044", true);
  }

  for (let i = bangs.length - 1; i >= 0; i--) {
    const b = bangs[i];
    b.y -= 30 * dt;
    b.life -= dt * 1.4;
    if (b.life <= 0) { bangs.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, b.life);
    const spr = BANG_SPR[b.t];
    if (spr) drawSpr(ctx, spr, b.x, b.y - 6, 2);
    else drawText(ctx, b.t, b.x, b.y - 8, 2, "#e04f5f", "#00000055", true);
  }

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y -= 26 * dt;
    h.life -= dt * 0.9;
    if (h.life <= 0) { hearts.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, h.life);
    drawSpr(ctx, "heart", h.x, h.y, 2);
  }
  ctx.globalAlpha = 1;

  // the tucked-in blanket under a sleeping cursor
  if (now < blanketUntil) {
    const bIn = Math.min(1, (blanketUntil - now) / 600);
    ctx.globalAlpha = bIn;
    drawSpr(ctx, "blanket", blanketX, blanketY, 3);
    if (now % 2400 < 100) drawSpr(ctx, "note", blanketX + 14, blanketY - 14, 1.4, "#8fd4f0");
    ctx.globalAlpha = 1;
  }

  // treats: in flight or sitting on a platform waiting to be eaten
  const drawTreat = (x, y, wob, kind) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob || 0);
    drawSpr(ctx, TREATS[kind || 0].id, 0, 0, 2);
    ctx.restore();
  };
  if (treatFly) drawTreat(treatFly.x, treatFly.y, t * 6, treatFly.kind);
  if (treat) drawTreat(treat.x, treat.y - 6 + Math.sin(t * 5) * 1.5, 0, treat.kind);
  // placed props: bowl sits flat, cushion gets a soft squish pulse
  if (bowl) {
    // lift floor-sitting props fully on-screen — center-anchored sprites
    // would otherwise spill a few px past the bottom edge
    const lift = Math.min(0, winH - (bowl.y + 9));
    ctx.save();
    ctx.translate(0, lift);
    drawSpr(ctx, "bowl", bowl.x, bowl.y - 5, 3);
    const fill = bowl.fill ?? 2; // saves from before fill-tracking: half
    if (fill <= 1) { // mask the baked-in kibble with the dark interior
      ctx.fillStyle = "#5c4632";
      ctx.fillRect(Math.round(bowl.x - 16), Math.round(bowl.y - 12), 30, 6);
    }
    if (fill === 1) { // scraps left
      ctx.fillStyle = "#eec23f";
      ctx.fillRect(Math.round(bowl.x - 4), Math.round(bowl.y - 11), 3, 3);
      ctx.fillRect(Math.round(bowl.x + 3), Math.round(bowl.y - 10), 3, 3);
      ctx.fillRect(Math.round(bowl.x - 9), Math.round(bowl.y - 10), 3, 3);
    } else if (fill === 0) { // empty — just a rim shine
      ctx.fillStyle = "#a8855c";
      ctx.fillRect(Math.round(bowl.x - 8), Math.round(bowl.y - 11), 6, 2);
      ctx.fillRect(Math.round(bowl.x + 5), Math.round(bowl.y - 9), 3, 2);
    } else if (fill === 3) { // heaped above the rim
      ctx.fillStyle = "#eec23f";
      ctx.fillRect(Math.round(bowl.x - 10), Math.round(bowl.y - 17), 4, 3);
      ctx.fillRect(Math.round(bowl.x - 4), Math.round(bowl.y - 19), 4, 4);
      ctx.fillRect(Math.round(bowl.x + 3), Math.round(bowl.y - 18), 4, 3);
      ctx.fillRect(Math.round(bowl.x + 8), Math.round(bowl.y - 16), 3, 3);
      ctx.fillStyle = "#d9a05b";
      ctx.fillRect(Math.round(bowl.x - 1), Math.round(bowl.y - 21), 3, 3);
      ctx.fillRect(Math.round(bowl.x - 7), Math.round(bowl.y - 19), 3, 3);
    }
    ctx.restore();
  }
  if (cushion) {
    // the puff squashes under whoever's napping on it — scale dips while
    // the main pet dozes or a pal is resting there
    const occupied = (now < cushionNap && Math.abs(petX - cushion.x) < 34) ||
      pals.some((p) => now < (p.restUntil || 0) && Math.abs(p.x - cushion.x) < 34);
    // a tap fluffs it — a quick over-inflate that settles back
    const poof = now < cushionPoof ? 1 + Math.sin((cushionPoof - now) / 700 * Math.PI) * 0.12 : 1;
    const csq = occupied ? 0.82 : (1 + Math.sin(t * 1.4) * 0.03) * poof;
    ctx.save();
    ctx.translate(cushion.x, cushion.y + Math.min(0, winH - (cushion.y + 6)));
    ctx.scale(1 / csq * (2 - csq) * 0.5 + 0.5, csq); // widen a touch as it flattens
    drawSpr(ctx, "cushion", 0, -8 / csq + (occupied ? 1 : Math.sin(t * 1.4) * 0.8), 3);
    ctx.restore();
  }
  if (box) {
    // the lid shivers when a slime just dove in or is rustling inside
    const rustle = now < boxHide || pals.some((p) => now < (p.hideUntil || 0) && Math.abs(p.x - box.x) < 30);
    ctx.save();
    ctx.translate(box.x + (rustle ? Math.sin(t * 23) * 1.4 : 0), box.y - 5 + Math.min(0, winH - (box.y + 9)));
    drawSpr(ctx, "box", 0, 0, 3);
    ctx.restore();
    if (rustle && Math.random() < dt * 3) fx.push({ x: box.x + (Math.random() - 0.5) * 26, y: box.y - 12, vx: (Math.random() - 0.5) * 20, vy: -12, life: 0.5, c: "#d8c49a" });
  }
  if (plant) {
    // leaves sway; a watering makes them perk and sparkle for a bit
    const perk = Date.now() < (plant.steamUntil || 0);
    ctx.save();
    ctx.translate(plant.x, plant.y - 5 + Math.min(0, winH - (plant.y + 12)));
    ctx.rotate(Math.sin(t * (perk ? 5 : 1.6)) * (perk ? 0.1 : 0.04));
    drawSpr(ctx, "plant", 0, 0, 3);
    ctx.restore();
    if (perk && Math.random() < dt * 6) fx.push({ x: plant.x + (Math.random() - 0.5) * 18, y: plant.y - 30 - Math.random() * 8, vx: 0, vy: -14, life: 0.6, c: "#8ad4f0" });
  }
  if (music) {
    // the key turns while the tune plays — a small wobble sells it
    const spinning = Date.now() < (music.spinUntil || 0);
    ctx.save();
    ctx.translate(music.x + (spinning ? Math.sin(t * 31) * 0.8 : 0), music.y - 4 + Math.min(0, winH - (music.y + 8)));
    drawSpr(ctx, "music", 0, 0, 3);
    ctx.restore();
    if (spinning && Math.random() < dt * 7) bangs.push({ x: music.x + (Math.random() - 0.5) * 30, y: music.y - 30 - Math.random() * 12, life: 0.9, t: "♪" });
  }
  if (mirror) {
    // the glass gleams once in a while — a slow shine sweep across the pane
    const gleam = (Math.sin(t * 0.9) + 1) / 2;
    ctx.save();
    ctx.translate(mirror.x, mirror.y - 5 + Math.min(0, winH - (mirror.y + 13)));
    drawSpr(ctx, "mirror", 0, 0, 3);
    if (gleam > 0.86) {
      ctx.globalAlpha = (gleam - 0.86) / 0.14 * 0.7;
      ctx.fillStyle = "#ffffff";
      const gx = Math.round((gleam - 0.86) / 0.14 * 26 - 13);
      ctx.fillRect(gx, -46, 3, 26);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  if (mat) {
    // the pad breathes a little; a tap or a landing bloats it briefly
    const poof = now < matPoof ? 1 + Math.sin((matPoof - now) / 800 * Math.PI) * 0.16 : 1;
    const msq = (1 + Math.sin(t * 1.8) * 0.025) * poof;
    ctx.save();
    ctx.translate(mat.x, mat.y + Math.min(0, winH - (mat.y + 6)));
    ctx.scale(1 + (1 - msq) * 0.6, msq);
    drawSpr(ctx, "mat", 0, -8 / msq, 3);
    ctx.restore();
  }
  if (jar) {
    // cookie jar: the glass wobbles when someone just raided it; the lid
    // lifts a crack while the spill-cooldown is fresh
    const raid = Date.now() < (jar.raidUntil || 0);
    ctx.save();
    ctx.translate(jar.x + (raid ? Math.sin(t * 27) * 1.2 : 0), jar.y - 5 + Math.min(0, winH - (jar.y + 10)));
    drawSpr(ctx, "jar", 0, 0, 3);
    if ((jar.fill ?? 2) <= 0) { // empty — dim the cookie lumps
      ctx.fillStyle = "rgba(92,70,50,0.55)";
      ctx.fillRect(Math.round(-13), Math.round(-26), 26, 16);
    }
    ctx.restore();
    if (raid && Math.random() < dt * 5) fx.push({ x: jar.x + (Math.random() - 0.5) * 16, y: jar.y - 24 - Math.random() * 8, vx: (Math.random() - 0.5) * 30, vy: -16, life: 0.5, c: "#d9a05b" });
  }
  // the daily egg: sits with a faint wobble, like something's inside —
  // hairline cracks creep in as hatch time nears
  if (egg) {
    ctx.save();
    ctx.translate(egg.x, egg.y - 7 + Math.min(0, winH - (egg.y + 8)));
    const wob = Math.min(0.22, 0.09 + (now - egg.t0) / 150000 * 0.2);
    ctx.rotate(Math.sin(t * (3 + (now - egg.t0) / 50000) + egg.wob) * wob);
    drawSpr(ctx, "egg", 0, 0, 3);
    const age = now - egg.t0;
    if (age > 130000) drawSpr(ctx, "crack2", 0, -4, 3);
    else if (age > 70000) drawSpr(ctx, "crack1", 0, -4, 3);
    ctx.restore();
  }
  // the ball: spins while rolling, squashed flat a touch on the deck
  if (ball) {
    const bimg = sprImg("ball");
    const bd = ball.r * 2;
    const bsq = ball.sq || 0;
    ctx.save();
    ctx.translate(ball.x, ball.y - ball.r * (1 - bsq * 0.35));
    ctx.rotate(ballHeld ? 0 : ball.rot);
    ctx.scale(1 + bsq * 0.45, 1 - bsq * 0.35);
    ctx.drawImage(bimg, -ball.r, -ball.r, bd, bd);
    ctx.restore();
    // static shine — the light stays put while the ball spins under it
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(Math.round(ball.x - 5), Math.round(ball.y - ball.r * 2 + 3), 4, 2);
  }
  // treat buffs float a small icon above the slime while they last
  if (now < hyperUntil) drawTreat(petX - 14, petY - SH * sy - 14 + Math.sin(t * 4) * 1.5, 0, 2);
  if (Date.now() < noSleepUntil) drawTreat(petX + 14, petY - SH * sy - 14 + Math.sin(t * 4 + 1) * 1.5, 0, 3);

  // everything below is UI — hidden while a photo snapshot is being taken
  if (!photoHide) {
  // crosshair while aiming a throw
  if (treatAim && curX > -9000) {
    ctx.globalAlpha = 0.9;
    drawSpr(ctx, "cross", curX, curY, 3);
    ctx.globalAlpha = 1;
  }

  // HOME drop slot — appears top-center while any slime is being dragged;
  // release over it to send it back to the ranch (the main pet too)
  if (palHeld || held) {
    const hx = Math.round(winW / 2 - 66);
    const over = curX > hx && curX < hx + 132 && curY >= 2 && curY <= 52;
    ctx.globalAlpha = over ? 0.98 : 0.85;
    ctx.fillStyle = over ? "#cfe8b8" : "#f3e6cd";
    ctx.fillRect(hx, 6, 132, 42);
    ctx.strokeStyle = over ? "#4c9e50" : "#8a6b4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(hx + 1, 7, 130, 40);
    // tiny house glyph
    drawSpr(ctx, "house", hx + 24, 28, 3, over ? "#4c9e50" : "#8a6b4a");
    drawText(ctx, "SEND HOME", hx + 44, 25, 1, over ? "#2f7a36" : "#5c4632", null, true);
    ctx.globalAlpha = 1;
  }

  // offline-earnings report panel (dismisses itself, click to close early)
  if (awayReport) {
    if (now > awayReport.until) awayReport = null;
    else {
      const pw = 190, ph2 = 78;
      const px2 = Math.round(winW / 2 - pw / 2), py2 = 54;
      ctx.fillStyle = "#f7ecd7";
      ctx.fillRect(px2, py2, pw, ph2);
      ctx.strokeStyle = "#8a6b4a";
      ctx.lineWidth = 2;
      ctx.strokeRect(px2 + 1, py2 + 1, pw - 2, ph2 - 2);
      const cx2 = px2 + pw / 2;
      const t1 = "AWAY REPORT";
      drawText(ctx, t1, cx2 - textW(t1, 1) / 2, py2 + 8, 1, "#5c4632");
      const t2 = `${awayReport.mins} MIN AWAY`;
      drawText(ctx, t2, cx2 - textW(t2, 1) / 2, py2 + 22, 1, "#8a6b4a");
      const t3 = `+${awayReport.gems}`;
      drawText(ctx, t3, cx2 - textW(t3, 2) / 2 - 8, py2 + 38, 2, "#2f9e63");
      bubbleIcon(ctx, cx2 + textW(t3, 2) / 2 + 2, py2 + 45);
      const t4 = "WELCOME BACK";
      drawText(ctx, t4, cx2 - textW(t4, 1) / 2, py2 + 64, 1, "#b09468");
    }
  }

  // radial menu: one circle in the corner, press to unfold the actions —
  // five loose buttons used to camp the whole top-right edge
  const [fbx, fby] = fabPos();
  const hovF = curX > -9000 && Math.hypot(curX - fbx, curY - fby) < 20;
  ctx.globalAlpha = hovF || fabOpen || fabDrag ? 0.95 : 0.6;
  ctx.fillStyle = "#f3e6cd";
  ctx.beginPath(); ctx.arc(fbx, fby, 17, 0, 6.29); ctx.fill();
  ctx.strokeStyle = "#8a6b4a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fbx, fby, 16, 0, 6.29); ctx.stroke();
  ctx.drawImage(sprite("idle", active, false), fbx - 11, fby - 8, 22, 16);
  ctx.globalAlpha = 1;
  drawText(ctx, fabOpen ? "-" : "+", fbx + 9, fby - 20, 1, "#8a6b4a", null, true);
  // pet parked at the ranch: badge the menu and hint how to wake it
  if (petHome) {
    ctx.globalAlpha = 0.9;
    drawText(ctx, "Z", fbx + 8, fby - 24 + Math.sin(t * 3) * 2, 1, "#5c86c9");
    drawText(ctx, "Z", fbx + 14, fby - 28 + Math.sin(t * 3 + 1) * 2, 1, "#8aa8d9");
    ctx.globalAlpha = 1;
    if (!fabOpen) {
      const ht = "PET IS HOME - CLICK TO WAKE";
      const hx = Math.max(4, Math.min(winW - textW(ht, 1) - 4, fbx - textW(ht, 1) / 2));
      drawText(ctx, ht, hx + 1, fby + 31, 1, "#5c4632");
      drawText(ctx, ht, hx, fby + 30, 1, "#fff6e8");
    }
  }

  // accordion: the action items fold out of the circle (down, or up when
  // the menu is parked near the screen bottom)
  if (fabOpen) {
    const onMap = { recall: petHome, snack: treatAim, toys: toyboxOpen || ball || bowl || cushion, barn: ranchOpen, gear: settingsOpen };
    for (let k = 0; k < FAB_ITEMS.length; k++) {
      const [ix, iy, iw, ih] = fabItemRect(k);
      const id = FAB_ITEMS[k];
      const hov = curX > -9000 && curX >= ix && curX <= ix + iw && curY >= iy && curY <= iy + ih;
      ctx.globalAlpha = hov || onMap[id] ? 0.95 : 0.62;
      ctx.fillStyle = onMap[id] ? "#ffe9b0" : "#f3e6cd";
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = "#8a6b4a";
      ctx.lineWidth = 2;
      ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2);
      const icx = ix + iw / 2, icy = iy + ih / 2;
      if (id === "recall") ctx.drawImage(sprite("idle", active, false), icx - 11, icy - 8, 22, 16);
      else if (id === "snack") drawTreat(icx, icy, 0, treatKind);
      else if (id === "toys") drawSpr(ctx, "toys", icx, icy + 2, 2);
      else if (id === "barn") drawSpr(ctx, "barn", icx, icy + 2, 2);
      else if (id === "gear") drawSpr(ctx, "gear", icx, icy, 2);
      ctx.globalAlpha = 1;
    }
    // toybox prop strip: nine slots hanging left of the toys item
    if (toyboxOpen) {
      const [sx, sy] = toyboxStripRect();
      const on = [ball, bowl, cushion, box, plant, music, mirror, mat, jar];
      for (let k = 0; k < 9; k++) {
        const kx = sx + k * 36;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = on[k] ? "#ffe9b0" : "#f3e6cd";
        ctx.fillRect(kx + 2, sy + 1, 32, 32);
        ctx.strokeStyle = "#8a6b4a";
        ctx.strokeRect(kx + 3, sy + 2, 30, 30);
        drawSpr(ctx, ["ball", "bowl", "cushion", "box", "plant", "music", "mirror", "mat", "jar"][k], kx + 18, sy + 19, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // first-run tutorial hint floating above the slime
  if (!seen && Date.now() - bootT < 60000) {
    const l1 = "TYPE TO FEED";
    const l2 = "RIGHT CLICK = STATUS";
    const ty = Math.max(8, petY - SH * sy - 46 + Math.sin(t * 2.4) * 2);
    const x1 = Math.max(4, Math.min(winW - textW(l1, 1) - 4, petX - textW(l1, 1) / 2));
    const x2 = Math.max(4, Math.min(winW - textW(l2, 1) - 4, petX - textW(l2, 1) / 2));
    drawText(ctx, l1, x1 + 1, ty + 1, 1, "#5c4632");
    drawText(ctx, l2, x2 + 1, ty + 13, 1, "#5c4632");
    drawText(ctx, l1, x1, ty, 1, "#fff6e8");
    drawText(ctx, l2, x2, ty + 12, 1, "#fff6e8");
  }

  // discovery hint: same floating spot as the tutorial — gold text so it
  // reads as a tip, not chatter; fades out over its last 600ms
  if (now < hintUntil && hintText) {
    const hy = Math.max(8, petY - SH * sy - 46 + Math.sin(t * 2.4) * 2);
    const hx = Math.max(4, Math.min(winW - textW(hintText, 1) - 4, petX - textW(hintText, 1) / 2));
    ctx.globalAlpha = Math.min(1, (hintUntil - now) / 600);
    drawText(ctx, hintText, hx + 1, hy + 1, 1, "#5c4632");
    drawText(ctx, hintText, hx, hy, 1, "#ffd75e");
    ctx.globalAlpha = 1;
  }

  // settings panel: sound toggle, size cycle, quit
  if (settingsOpen) {
    const [px, py, pw, ph] = settingsRect();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "#f7ecd7";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#8a6b4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.globalAlpha = 1;
    drawText(ctx, "SETTINGS", px + pw / 2 - textW("SETTINGS", 1) / 2, py + 11, 1, "#5c4632");
    const rows = settingsRows();
    const pomoLbl = pomo
      ? `${pomoPhase === "focus" ? "FOCUS" : "BREAK"} ${Math.max(0, Math.ceil((pomoUntil - Date.now()) / 60000))}M`
      : "POMO OFF";
    const lbls = [
      vol <= 0.001 ? "SOUND OFF" : `SOUND ${Math.round(vol * 100)}%`,
      `SIZE ${sizeMul.toFixed(1)}X`,
      reduceMotion ? "MOTION LOW" : "MOTION FULL",
      "PHOTO",
      "ALBUM",
      pomoLbl,
      `FOCUS ${pomoFocusMin}M`,
      `BREAK ${pomoBreakMin}M`,
      "SHARE",
      weatherOn ? "WEATHER ON" : "WEATHER OFF",
      bootOn ? "BOOT ON" : "BOOT OFF",
      "GEMS",
      "REDEEM",
      "QUIT",
    ];
    // rows paint inside a clipped viewport — the title and the footer
    // stats stay put while the list slides underneath
    const vy0 = py + SET_VIEW_TOP, vy1 = py + ph - SET_VIEW_BOT;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 2, vy0, pw - 4, vy1 - vy0);
    ctx.clip();
    for (let i = 0; i < rows.length; i++) {
      const R = rows[i];
      if (R[1] + R[3] < vy0 || R[1] > vy1) continue; // fully scrolled out
      const hov2 = curX >= R[0] && curX <= R[0] + R[2] && curY >= R[1] && curY <= R[1] + R[3] && curY >= vy0 && curY <= vy1;
      ctx.fillStyle = i === rows.length - 1 ? "#e05a6e" : hov2 ? "#efe0c2" : "#e3d0aa";
      ctx.fillRect(R[0], R[1], R[2], R[3]);
      ctx.strokeStyle = "#8a6b4a";
      ctx.lineWidth = 1;
      ctx.strokeRect(R[0] + 0.5, R[1] + 0.5, R[2] - 1, R[3] - 1);
      drawText(ctx, lbls[i], px + pw / 2 - textW(lbls[i], 1) / 2, R[1] + 6, 1, i === rows.length - 1 ? "#fff6e8" : "#5c4632");
      if (i === 0) {
        // volume slider: the row's bottom strip is a progress bar —
        // click/drag anywhere on the row sets the level
        const tx = R[0] + 8, tw = R[2] - 16, ty = R[1] + R[3] - 5;
        ctx.fillStyle = "#8a6b4a";
        ctx.fillRect(tx, ty, tw, 3);
        if (vol > 0.001) {
          ctx.fillStyle = "#e08a5a";
          ctx.fillRect(tx, ty, Math.round(tw * vol), 3);
          // knob nub at the fill edge — reads as a draggable handle
          ctx.fillRect(tx + Math.round(tw * vol) - 2, ty - 2, 4, 7);
        }
      }
    }
    ctx.restore();
    // scrollbar: only exists when the content actually overflows
    const msc = setMaxScroll();
    if (msc > 0) {
      const th = Math.max(18, (vy1 - vy0) * (vy1 - vy0) / (vy1 - vy0 + msc));
      const ty = vy0 + (vy1 - vy0 - th) * (setScroll / msc);
      ctx.fillStyle = "#d8c49a";
      ctx.fillRect(px + pw - 7, vy0, 3, vy1 - vy0);
      ctx.fillStyle = "#8a6b4a";
      ctx.fillRect(px + pw - 8, ty, 5, th);
      // scroll chevrons as pixel triangles — "^" isn't in the font table
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(px + pw - 6 - k, vy0 + 3 + k, 1 + k * 2, 1);
        ctx.fillRect(px + pw - 8 + k, vy1 - 6 + k, 5 - k * 2, 1);
      }
    }
    // lifetime counters — groundwork for future achievements
    drawText(ctx, `PULLS ${stats.pulls}  BREEDS ${stats.breeds}  SHINY ${stats.shiny}`, px + 16, py + ph - 26, 1, "#8a6b4a");
    drawText(ctx, `TREATS ${stats.treats}  PLAYS ${stats.plays}  FOCUS ${Math.floor((stats.focusSec || 0) / 60)}M`, px + 16, py + ph - 14, 1, "#8a6b4a");
    if (newVer) drawText(ctx, `NEW V${newVer}!`, px + 120, py + ph - 14, 1, "#d4a017", null, true);
    else drawText(ctx, DEMO ? "DEMO" : `V${APP_VER}`, px + 152, py + ph - 14, 1, DEMO ? "#e05a6e" : "#b09a78");
  }
  // gem shop: pack prices, store link, and the redeem door. buying
  // happens on the itch.io page — the code comes back here
  if (gemShop) {
    const [gx, gy, gw, gh] = gemShopRect();
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = "#f7ecd7";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#8a6b4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(gx + 1, gy + 1, gw - 2, gh - 2);
    ctx.globalAlpha = 1;
    drawText(ctx, "GEM PACKS", gx + gw / 2 - textW("GEM PACKS", 1) / 2, gy + 12, 1, "#5c4632");
    const bal = `YOU HAVE ${jelly} GEMS`;
    drawText(ctx, bal, gx + gw / 2 - textW(bal, 1) / 2, gy + 34, 1, "#8a6b4a");
    const packIds = Object.keys(GEM_PACKS);
    for (let i = 0; i < packIds.length; i++) {
      const R = [gx + 16, gy + 62 + i * 26, 248, 20];
      ctx.fillStyle = "#efe0c2";
      ctx.fillRect(R[0], R[1], R[2], R[3]);
      ctx.strokeStyle = "#c9a06c";
      ctx.lineWidth = 1;
      ctx.strokeRect(R[0] + 0.5, R[1] + 0.5, R[2] - 1, R[3] - 1);
      drawSpr(ctx, "gem", R[0] + 14, R[1] + 10, 2);
      drawText(ctx, `${GEM_PACKS[packIds[i]]} GEMS`, R[0] + 26, R[1] + 7, 1, "#5c4632");
      const price = GEM_PACK_PRICE[packIds[i]];
      const BR = packBuyRect(i);
      drawText(ctx, price, BR[0] - 8 - textW(price, 1), R[1] + 7, 1, "#5c4632", null, true);
      const live = !!packUrl(packIds[i]);
      const hovB = curX >= BR[0] && curX <= BR[0] + BR[2] && curY >= BR[1] && curY <= BR[1] + BR[3];
      ctx.fillStyle = hovB && live ? "#b8e8c8" : live ? "#d8ecc9" : "#ddd0b8";
      ctx.fillRect(BR[0], BR[1], BR[2], BR[3]);
      ctx.strokeStyle = live ? "#2f9e63" : "#a8907a";
      ctx.lineWidth = 1;
      ctx.strokeRect(BR[0] + 0.5, BR[1] + 0.5, BR[2] - 1, BR[3] - 1);
      drawText(ctx, "BUY", BR[0] + BR[2] / 2 - textW("BUY", 1) / 2, BR[1] + 7, 1, live ? "#2f7e4e" : "#a8907a", null, true);
    }
    drawText(ctx, "BUY A PACK, GET A ONE-TIME CODE", gx + gw / 2 - textW("BUY A PACK, GET A ONE-TIME CODE", 1) / 2, gy + 168, 1, "#8a6b4a");
    drawText(ctx, "SAVE IT - ONE USE ONLY", gx + gw / 2 - textW("SAVE IT - ONE USE ONLY", 1) / 2, gy + 182, 1, "#a8845c");
    const rows = gemShopRows();
    const lbls = [GEM_SHOP_URL ? "STORE PAGE" : "STORE LINK TBD", "REDEEM CODE"];
    for (let i = 0; i < rows.length; i++) {
      const R = rows[i];
      const hov = curX >= R[0] && curX <= R[0] + R[2] && curY >= R[1] && curY <= R[1] + R[3];
      const live = i === 1 || !!GEM_SHOP_URL;
      ctx.fillStyle = hov && live ? "#efe0c2" : "#e3d0aa";
      ctx.fillRect(R[0], R[1], R[2], R[3]);
      ctx.strokeStyle = "#8a6b4a";
      ctx.lineWidth = 1;
      ctx.strokeRect(R[0] + 0.5, R[1] + 0.5, R[2] - 1, R[3] - 1);
      drawText(ctx, lbls[i], R[0] + R[2] / 2 - textW(lbls[i], 1) / 2, R[1] + 7, 1, live ? "#5c4632" : "#a8907a", null, true);
    }
  }
  } // !photoHide

  if (ranchOpen) drawRanch(now);
  if (nurseryOpen) drawNursery(now);
  if (cardTarget) drawCard(now);
  // top modal layer (#info overlay): bestiary card, photo album, or the
  // redeem box — above the ranch window, alive after it closes
  infoEl.classList.toggle("open", infoPick !== null || albumOpen || redeemMode);
  if (infoPick !== null || albumOpen || redeemMode) {
    if (ic.width !== winW || ic.height !== winH) {
      ic.width = winW;
      ic.height = winH;
      ictx.imageSmoothingEnabled = false;
    }
    if (redeemMode) drawRedeem(ictx, winW, winH, t);
    else if (infoPick !== null && SPECIES[infoPick]) drawInfo(ictx, winW, winH, t);
    else if (albumOpen) drawAlbum(ictx, winW, winH);
  }
}

// redeem-code entry box — centered modal, drawn on the top #info layer so
// ranch/nursery windows can never occlude it
function drawRedeem(c, W, H, t) {
  c.fillStyle = "rgba(24,18,14,0.55)";
  c.fillRect(0, 0, W, H);
  const bx = W / 2 - 140, by = H / 2 - 40;
  c.fillStyle = "#f7ecd7";
  c.fillRect(bx, by, 280, 80);
  c.strokeStyle = "#8a6b4a";
  c.lineWidth = 2;
  c.strokeRect(bx + 1, by + 1, 278, 78);
  drawText(c, "ENTER GEM CODE", bx + 140 - textW("ENTER GEM CODE", 1) / 2, by + 10, 1, "#5c4632", null, true);
  c.fillStyle = "#efe0c2";
  c.fillRect(bx + 16, by + 28, 248, 22);
  c.strokeStyle = "#c9a06c";
  c.strokeRect(bx + 16.5, by + 28.5, 247, 21);
  const shown = redeemBuf + (Math.floor(t * 3) % 2 ? "_" : "");
  drawText(c, shown.slice(-30), bx + 22, by + 35, 1, "#5c4632", null, true);
  drawText(c, "ENTER = REDEEM   ESC = CANCEL", bx + 140 - textW("ENTER = REDEEM   ESC = CANCEL", 1) / 2, by + 60, 1, "#8a6b4a");
}
requestAnimationFrame(frame);
// rAF watchdog: a transparent always-on-top window can get mis-classed as
// occluded by the compositor, which silently stops rAF — the screen looks
// frozen while nothing is actually wrong. if no frame ran for >400ms,
// drive one from a timer; harmless when rAF is healthy
setInterval(() => {
  const t = performance.now();
  if (t - prev > 400) frame(t);
}, 250);
