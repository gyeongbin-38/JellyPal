// pals.js — faithful port of the Jellypal in-game slime renderer.
// Data + sprite pipeline lifted verbatim from src/main.js so the site
// shows the REAL pals: same silhouettes, palettes, faces, and jelly
// translucency you get on your desktop.

const SW = 36, SH = 26, CX = 18;

const HW_ROUND = [0, 4, 6, 8, 9, 10, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 12];
const HW_TALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 10];
const HW_FLAT = [0, 0, 0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 13];
const HW_SQUARE = [0, 5, 9, 11, 12, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13];
const HW_PUDDLE = [0, 0, 0, 0, 1, 3, 5, 8, 11, 13, 14, 15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 15];
const SHAPES = { round: HW_ROUND, tall: HW_TALL, flat: HW_FLAT, square: HW_SQUARE, puddle: HW_PUDDLE };

// rarity: 0 common, 1 rare, 2 epic, 3 legendary
const SPECIES = [
  { id: "sprout", name: "Sprout", r: 0, shape: "round",
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
  { id: "mochi", name: "Mochi", r: 1, shape: "round",
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
  { id: "bites", name: "Bites", r: 3, shape: "round", trait: "chomp", mv: "scurry", sig: "frenzy",
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
  { id: "peach", name: "Peach", r: 0, shape: "round",
    pal: { o:"#8a5a45",b:"#ffb894",l:"#ffd9c2",s:"#e0926b",e:"#332016",w:"#ffffff",m:"#332016",k:"#ff7f96" },
    top: [[18,0,"v"],[17,1,"s"],[19,1,"s"]] },
  { id: "coal", name: "Coal", r: 0, shape: "flat",
    pal: { o:"#1a1c20",b:"#3d4248",l:"#5d646c",s:"#2a2e34",e:"#101216",w:"#ffffff",m:"#101216",k:"#c96b5a" },
    top: [[12,3,"l"],[24,4,"l"],[18,2,"s"]] },
  { id: "cloud", name: "Cloud", r: 0, shape: "puddle",
    pal: { o:"#7a8fa0",b:"#dfeaf2",l:"#ffffff",s:"#b8cdd8",e:"#2c3842",w:"#ffffff",m:"#2c3842",k:"#ffb0c8" },
    top: [[10,4,"w"],[14,3,"w"],[26,4,"w"],[22,3,"w"]] },
  { id: "bean", name: "Bean", r: 0, shape: "tall",
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
  { id: "mecha", name: "Mecha", r: 2, shape: "square", trait: "spark", sig: "beep",
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
  { id: "pumkin", name: "Pumkin", r: 1, shape: "round", trait: "glint", season: "halloween",
    pal: { o:"#8a4a1f",b:"#f08a2a",l:"#ffbf6e",s:"#d16a1f",e:"#33200f",w:"#ffffff",m:"#33200f",k:"#7de83f" },
    top: [[18,0,"k"],[17,1,"k"],[19,1,"k"],[18,2,"k"]] },
  { id: "yule", name: "Yule", r: 2, shape: "round", trait: "glint", season: "winter", sig: "jingle",
    pal: { o:"#7a1f2a",b:"#e0455a",l:"#ff9aa8",s:"#b03045",e:"#2b0f15",w:"#ffffff",m:"#2b0f15",k:"#4fbd63" },
    top: [[14,0,"w"],[22,0,"w"],[15,1,"w"],[21,1,"w"],[16,2,"w"],[17,2,"w"],[18,2,"w"],[19,2,"w"],[20,2,"w"]] },
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
const RARITY_COLOR = ["#a8845c", "#4a90c4", "#a86bd9", "#eec23f"];
const RARITY_NAME = ["COMMON", "RARE", "EPIC", "LEGEND"];
const RARITY_W = [60, 28, 9.5, 2.5];
const SILH = { o:"#2a2f35",b:"#3a4048",l:"#454c55",s:"#31373f",e:"#22262b",w:"#22262b",m:"#22262b",k:"#22262b" };

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
  happy: {
    e: [[10,12],[11,11],[12,11],[13,12],[22,12],[23,11],[24,11],[25,12]],
    m: [[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],[15,16],[16,16],[17,16],[18,16],[19,16],[20,16],
        [16,17],[17,17],[18,17],[19,17]],
    k: [[6,14],[7,14],[8,14],[9,14],[27,14],[28,14],[29,14],[30,14]],
  },
  love: {
    v: [[10,10],[12,10],[10,11],[11,11],[12,11],[11,12],
        [23,10],[25,10],[23,11],[24,11],[25,11],[24,12]],
    m: [[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],[15,16],[16,16],[17,16],[18,16],[19,16],[20,16],
        [16,17],[17,17],[18,17],[19,17]],
    k: [[6,14],[7,14],[8,14],[28,14],[29,14],[30,14]],
  },
  star: {
    c: [[11,10],[10,11],[12,11],[11,12],[10,13],[12,13],
        [24,10],[23,11],[25,11],[24,12],[23,13],[25,13]],
    m: [[15,14],[16,14],[17,14],[18,14],[19,14],[20,14],[15,15],[16,15],[17,15],[18,15],[19,15],[20,15],
        [16,16],[17,16],[18,16],[19,16],[17,17],[18,17]],
    k: [[6,14],[7,14],[8,14],[6,15],[7,15],[28,14],[29,14],[30,14],[29,15],[30,15]],
  },
  wink: {
    e: [[10,11],[11,12],[12,12],[13,11],
        [23,10],[24,10],[25,10],[23,11],[24,11],[25,11],[23,12],[24,12],[25,12],
        [23,13],[24,13],[25,13],[24,14]],
    w: [[23,10],[23,11]],
    m: [[15,15],[16,16],[17,16],[18,16],[19,15],[20,14]],
    k: [[7,14],[8,14],[7,15],[8,15],[28,14],[29,14],[28,15],[29,15]],
  },
  sleeping: {
    e: [[10,13],[11,14],[12,14],[13,13],[22,13],[23,14],[24,14],[25,13]],
    m: [[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  shock: {
    e: [[10,10],[11,10],[12,10],[10,11],[11,11],[12,11],[10,12],[11,12],[12,12],
        [23,10],[24,10],[25,10],[23,11],[24,11],[25,11],[23,12],[24,12],[25,12]],
    w: [[10,10],[23,10]],
    m: [[16,14],[17,14],[18,14],[16,15],[17,15],[18,15],[16,16],[17,16],[18,16]],
    k: [[7,14],[8,14],[28,14],[29,14]],
  },
  content: {
    e: [[10,12],[11,13],[12,13],[13,12],[22,12],[23,13],[24,13],[25,12]],
    m: [[15,16],[17,15],[19,15],[21,16],[16,17],[20,17]],
    k: [[6,14],[7,14],[8,14],[7,15],[8,15],[27,14],[28,14],[29,14],[28,15],[29,15]],
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
};

// legendary quirks + wing/leg doodads — ported 1:1 from src/main.js
const LEG = {
  stella: { floaty: true, wings: "#f2f6ff", starburst: true },
  drago:  { wings: "#7a3a4a", heavy: true, embers: true },
  gold:   { halo: "#ffd75e", luck: true, goldtrail: true },
  rex:    { halo: "#ffd75e", strut: true },
  comet:  { trail: "#ff8a3f" },
  molten: { glow: "#e85a2a", heart: true },
  siren:  { notes: true, captivate: true },
  cliff:  { chips: true, tremor: true, summit: true },
  bites:  { drool: true, lunge: true, snap: true },
  pulsar: { orbit: true, pulse: true },
  spidr:  { legs: true },
};
const WING_F = [
  ["......m......", "....mmm.....", "...mmmmm....", "..mmmmmmm...", ".mmmmmmmmm..", "mmmmmmmmmmm.", "mmmddmmmddmm", "mmmdmmmmdmmm"],
  ["............", "..m.........", ".mmm........", "mmmmmm......", "mmmmmmmm....", "mmmmmmmmmm..", "mmmddmmmddm.", "mmdmmmmmdmm."],
  ["............", "............", "............", "m...........", "mm..........", "mmm.........", "mmmmm.......", "mmmmmmmm...."],
];
const LEG_SPR = ["#......", "##.....", ".##....", "..##...", "...##..", "...###.", ".....##"];
const _wingCache = {};
function wingImg(frame, base) {
  const key = frame + ":" + base;
  if (_wingCache[key]) return _wingCache[key];
  const rows = WING_F[frame];
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const oc = document.createElement("canvas");
  oc.width = w; oc.height = h;
  const g = oc.getContext("2d");
  const bR = hexRgb(base), dR = mixRgb(bR, hexRgb("#241b2e"), 0.4), lR = mixRgb(bR, hexRgb("#ffffff"), 0.45);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const rgb = rows[y][x] === "m" ? bR : rows[y][x] === "d" ? dR : rows[y][x] === "l" ? lR : null;
      if (!rgb) continue;
      g.fillStyle = `rgb(${rgb.join(",")})`;
      g.fillRect(x, y, 1, 1);
    }
  _wingCache[key] = oc;
  return oc;
}

const EYE_TPL = [
  [".ee.", "wwee", "weee", "eeew", ".uu."],
  ["wee.", "wwee", "weee", "eewe", ".uu."],
  ["....", ".we.", ".ee.", ".ee.", "...."],
  [".ee.", "wwee", "weee", "eece", ".uu."],
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

const shapeVarCache = {};
function shapeVar(i) {
  if (shapeVarCache[i]) return shapeVarCache[i];
  const hw0 = SHAPES[SPECIES[i].shape];
  let s = (i * 2654435761 + 0x9e3779b9) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hs = 0.88 + rnd() * 0.24;
  const bulge = 0.9 + rnd() * 0.2;
  const lean = Math.round((rnd() - 0.5) * 4);
  const hw = new Array(SH);
  for (let y = 0; y < SH; y++) {
    const sy = SH - 1 - Math.round((SH - 1 - y) / hs);
    let w = sy < 0 ? 0 : hw0[Math.min(SH - 1, sy)];
    w = Math.round(w * bulge * (0.88 + 0.24 * Math.sin(Math.PI * y / SH)));
    hw[y] = Math.max(0, Math.min(CX - 1, w));
  }
  const tfm = (x, y) => {
    const ny = Math.max(0, Math.min(SH - 1, SH - 1 - Math.round((SH - 1 - y) * hs)));
    const srcW = hw0[y] || 1, dstW = hw[ny] || 1;
    const r = Math.min(2, Math.max(0.4, dstW / srcW));
    let nx = CX + Math.round((x - CX) * r) + Math.round(lean * (1 - ny / SH));
    const lim = dstW + 4;
    nx = Math.max(CX - lim, Math.min(CX + lim, nx));
    return [Math.max(0, Math.min(SW - 1, nx)), ny];
  };
  return (shapeVarCache[i] = { hw, tfm });
}

const animCache = {};
function animProf(i) {
  if (animCache[i]) return animCache[i];
  let s = (i * 2654435761 + 0x85ebca6b) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  return (animCache[i] = {
    blink: 2400 + rnd() * 2800,
    blinkLen: 100 + rnd() * 80,
    fidget: 0.65 + rnd() * 1.0,
    breathe: 0.88 + rnd() * 0.3,
    hop: 0.82 + rnd() * 0.45,
    lean: 0.7 + rnd() * 0.9,
    waddle: 0.8 + rnd() * 0.5,
    arc: 0.85 + rnd() * 0.5,
    glee: rnd(),
  });
}

function buildSprite(faceName, pal, top, hw, sil, spIdx) {
  const grid = Array.from({ length: SH }, () => new Array(SW).fill("."));
  const v = spIdx != null ? shapeVar(spIdx) : null;
  const hhw = v ? v.hw : hw;
  for (let y = 0; y < SH; y++) {
    for (let x = CX - hhw[y]; x < CX + hhw[y]; x++) {
      let c = "b";
      const dx = x - 12, dy = y - 6;
      if (dx * dx + dy * dy < 20) c = "l";
      if (y >= 21 || (x - CX >= 8 && y >= 17)) c = "s";
      if (c === "b") {
        const gx = (x - CX) / Math.max(5, hw[y] * 0.7), gy = (y - 12) / 7.5;
        const d2 = gx * gx + gy * gy;
        if (d2 < 1 && (d2 < 0.75 || ((x + y) & 1) === 0)) c = "i";
      }
      grid[y][x] = c;
    }
  }
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
  const SS = 2;
  off.width = SW * SS;
  off.height = SH * SS;
  const octx = off.getContext("2d");
  const img = octx.createImageData(SW * SS, SH * SS);
  const WHT = [255, 255, 255];
  const bR = sil ? null : hexRgb(pal.b), lR = sil ? null : hexRgb(pal.l || pal.b);
  const sR = sil ? null : hexRgb(pal.s || pal.b), oR = sil ? null : hexRgb(pal.o || pal.b);
  const bl = bR ? bR[0] * 0.299 + bR[1] * 0.587 + bR[2] * 0.114 : 128;
  const lift = bR && bl < 76 ? Math.min(0.3, (76 - bl) / 76 * 0.34) : 0;
  const bIn = sil ? null : mixRgb(mixRgb(bR, lR, 0.24), WHT, 0.14 + lift);
  const iIn = sil ? null : mixRgb(mixRgb(bR, lR, 0.74), WHT, 0.20 + lift);
  const sIn = sil ? null : mixRgb(mixRgb(sR, lR, 0.32), WHT, 0.16 + lift * 0.6);
  const oIn = sil ? null : mixRgb(oR, mixRgb(bR, lR, 0.35), 0.45 + lift);
  const lIn = sil ? null : mixRgb(lR, WHT, 0.16);
  const uIn = sil ? null : mixRgb(hexRgb(pal.e || "#26262e"), lR, 0.45);
  const ALPHA = { i: 215, b: 242, s: 232, l: 250 };
  const cellAt = (x, y) => (x < 0 || y < 0 || x >= SW || y >= SH) ? "." : grid[y][x];
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const c = grid[y][x];
      if (c === ".") continue;
      const rgb = sil ? hexRgb(pal[c] || pal.b)
        : c === "i" ? iIn
        : c === "b" ? bIn
        : c === "s" ? sIn
        : c === "o" ? oIn
        : c === "l" ? lIn
        : c === "u" ? uIn
        : (FIXED[c] || hexRgb(pal[c] || pal.b));
      const baseA = sil ? 255 : (ALPHA[c] !== undefined ? ALPHA[c] : 255);
      for (let qy = 0; qy < SS; qy++) {
        for (let qx = 0; qx < SS; qx++) {
          const nx = cellAt(x + (qx ? 1 : -1), y), ny = cellAt(x, y + (qy ? 1 : -1));
          const nc = cellAt(x + (qx ? 1 : -1), y + (qy ? 1 : -1));
          let r = rgb[0], g = rgb[1], b = rgb[2], a = baseA;
          if (nx === "." || ny === "." || nc === ".") {
            a = baseA * 0.45;
            r = mixRgb(rgb, oIn || rgb, 0.4)[0]; g = mixRgb(rgb, oIn || rgb, 0.4)[1]; b = mixRgb(rgb, oIn || rgb, 0.4)[2];
          } else if (nx === "o" || ny === "o") {
            r *= 0.86; g *= 0.86; b *= 0.86;
          } else if ((nx === "l" || ny === "l" || nc === "i") && (c === "b" || c === "i")) {
            r = Math.min(255, r * 1.06); g = Math.min(255, g * 1.06); b = Math.min(255, b * 1.06);
          }
          const n2 = (((x * 2 + qx) * 73856093) ^ ((y * 2 + qy) * 19349663)) >>> 0;
          const dt2 = ((n2 % 11) - 5) * 1.6;
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
function sprite(face, spIdx, sil) {
  const key = `${face}|${spIdx}|${sil ? 1 : 0}`;
  if (!spriteCache[key]) {
    const sp = SPECIES[spIdx];
    spriteCache[key] = buildSprite(face, sil ? SILH : sp.pal, sp.top, SHAPES[sp.shape], sil, spIdx);
  }
  return spriteCache[key];
}
const spIndex = (id) => SPECIES.findIndex((s) => s.id === id);

// ---------- props (SPR doodads — ported 1:1 from src/main.js) ----------
const SPR = {
  bowl: {
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
    pal: { o: "#8a6b4a", k: "#d9a05e", W: "#5c4632", f: "#eec23f", K: "#b97f45", h: "#f0d0d8" },
  },
  cushion: {
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
    pal: { o: "#a8506e", P: "#f0a0c0", p: "#ffcee0", b: "#d06088", t: "#ffd75e" },
  },
  plant: {
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
    pal: { g: "#4f9e4f", s: "#3a7a3f", p: "#b06a4a" },
  },
  music: {
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
    pal: { w: "#c9a06c", k: "#5c4632", s: "#ffd75e", o: "#8a6b4a" },
  },
  mirror: {
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
    pal: { o: "#8a6b4a", M: "#5c4632", w: "#bfe8f4", s: "#ffffff" },
  },
  mat: {
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
    pal: { o: "#4a7a5a", P: "#7ac89a", p: "#a8e8c0", b: "#3a6a4a" },
  },
  jar: {
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
    pal: { c: "#b0895a", k: "#d8ecf4", G: "#aee0f0", b: "#d9a05b" },
  },
  gem: {
    rows: ["..###..", ".#####.", "#o###o#", "#######", ".#####.", "..###.."],
    pal: { "#": "#8fe8c0", "o": "#2e5a44" },
  },
};
const _sprCache = {};
function sprImg(id) {
  if (_sprCache[id]) return _sprCache[id];
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
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  _sprCache[id] = oc;
  return oc;
}

/* jelly drop = the gem doodad at 2x — the site's currency icon */
let _jelly = null;
function jellyImg() {
  if (_jelly) return _jelly;
  const g0 = sprImg("gem");
  const oc = document.createElement("canvas");
  oc.width = g0.width * 2; oc.height = g0.height * 2;
  const g = oc.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(g0, 0, 0, oc.width, oc.height);
  return (_jelly = oc);
}

/* small rng helper — returns [0,n) float; matches site usage rng(n) */
function rng(n = 1) { return Math.random() * n; }

// ---------- accessories (drawAccRaw port — real store items) ----------
const ACCS = [
  { id: "cap", name: "CAP", dy: 0 }, { id: "bow", name: "BOW", dy: 0 },
  { id: "crown", name: "CROWN", dy: -1 }, { id: "tophat", name: "TOPHAT", dy: -1 },
  { id: "specs", name: "SPECS", dy: 3 }, { id: "party", name: "PARTY", dy: 0 },
  { id: "flower", name: "FLOWER", dy: 0 }, { id: "phones", name: "PHONES", dy: 1 },
];
function drawAccRaw(c, id, x, y, u) {
  const acc = ACCS.find((a) => a.id === id);
  if (!acc) return;
  const ay = y + acc.dy * u;
  if (id === "cap") {
    c.fillStyle = "#e05a6e"; c.fillRect(x - 5 * u, ay, 10 * u, 3 * u);
    c.fillStyle = "#b8405a"; c.fillRect(x - 5 * u, ay + 2 * u, 10 * u, u);
    c.fillStyle = "#e05a6e"; c.fillRect(x - 9 * u, ay + 2 * u, 5 * u, u);
    c.fillStyle = "#ffffff"; c.fillRect(x - u, ay - u, 2 * u, u);
    c.fillStyle = "#f08a9a"; c.fillRect(x - u * 0.5, ay, u * 0.5, 2 * u);
    c.fillStyle = "#ffd0d8"; c.fillRect(x - u * 0.5, ay - 2 * u, u, u);
  } else if (id === "specs") {
    c.strokeStyle = "#2f2f3a"; c.lineWidth = u;
    c.strokeRect(x - 8 * u, ay, 6 * u, 5 * u); c.strokeRect(x + 2 * u, ay, 6 * u, 5 * u);
    c.fillStyle = "#2f2f3a"; c.fillRect(x - 2 * u, ay + 2 * u, 4 * u, u);
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fillRect(x - 7 * u, ay + u, 2 * u, u); c.fillRect(x + 3 * u, ay + u, 2 * u, u);
  } else if (id === "bow") {
    c.fillStyle = "#ff5f8a";
    c.fillRect(x - 8 * u, ay, 5 * u, 4 * u); c.fillRect(x + 3 * u, ay, 5 * u, 4 * u);
    c.fillStyle = "#d1386b"; c.fillRect(x - 2 * u, ay + u, 4 * u, 3 * u);
    c.fillStyle = "#ff5f8a";
    c.fillRect(x - 4 * u, ay + 4 * u, 2 * u, 3 * u); c.fillRect(x + 2 * u, ay + 4 * u, 2 * u, 3 * u);
    c.fillStyle = "#d1386b";
    c.fillRect(x - 4 * u, ay + 6 * u, 2 * u, u); c.fillRect(x + 2 * u, ay + 6 * u, 2 * u, u);
    c.fillStyle = "#ffb0cc"; c.fillRect(x - u, ay + u, u, u);
  } else if (id === "crown") {
    c.fillStyle = "#b8860b"; c.fillRect(x - 7 * u, ay + 4 * u, 14 * u, u);
    c.fillStyle = "#eec23f"; c.fillRect(x - 7 * u, ay + 2 * u, 14 * u, 3 * u);
    c.fillRect(x - 6 * u, ay, 3 * u, 2 * u); c.fillRect(x - 1.5 * u, ay - u, 3 * u, 3 * u);
    c.fillRect(x + 3 * u, ay, 3 * u, 2 * u);
    c.fillStyle = "#e05a6e"; c.fillRect(x - u, ay + 2 * u, 2 * u, u);
    c.fillStyle = "#4a90e8"; c.fillRect(x - 5 * u, ay + 3 * u, u, u); c.fillRect(x + 4 * u, ay + 3 * u, u, u);
    c.fillStyle = "#fff2b0"; c.fillRect(x - u, ay - u, u, u);
  } else if (id === "tophat") {
    c.fillStyle = "#2f2f3a"; c.fillRect(x - 8 * u, ay + 4 * u, 16 * u, 2 * u);
    c.fillRect(x - 5 * u, ay - 3 * u, 10 * u, 7 * u);
    c.fillStyle = "#e05a6e"; c.fillRect(x - 5 * u, ay + 2 * u, 10 * u, 2 * u);
    c.fillStyle = "#4a4a5a"; c.fillRect(x - 4 * u, ay - 2 * u, 2 * u, 3 * u);
    c.fillStyle = "#eec23f"; c.fillRect(x - u, ay + 2 * u, 2 * u, 2 * u);
  } else if (id === "party") {
    c.fillStyle = "#5ac8f0"; c.fillRect(x - 5 * u, ay, 10 * u, 2 * u);
    c.fillRect(x - 3 * u, ay - 2 * u, 6 * u, 2 * u); c.fillRect(x - 2 * u, ay - 4 * u, 4 * u, 2 * u);
    c.fillStyle = "#ffd75e"; c.fillRect(x - 3 * u, ay - 2 * u, 2 * u, 2 * u);
    c.fillStyle = "#ffffff"; c.fillRect(x - u, ay - 6 * u, 2 * u, 2 * u);
  } else if (id === "flower") {
    c.fillStyle = "#4a9e4f"; c.fillRect(x + 4 * u, ay, u, 3 * u); c.fillRect(x + 2 * u, ay + u, 2 * u, u);
    c.fillStyle = "#ff9ad4";
    c.fillRect(x + 2 * u, ay - 3 * u, 2 * u, 2 * u); c.fillRect(x + 6 * u, ay - 3 * u, 2 * u, 2 * u);
    c.fillRect(x + 4 * u, ay - 5 * u, 2 * u, 2 * u); c.fillRect(x + 4 * u, ay - u, 2 * u, 2 * u);
    c.fillRect(x + 3 * u, ay - 4 * u, u, u); c.fillRect(x + 6 * u, ay - 4 * u, u, u);
    c.fillStyle = "#ffd75e"; c.fillRect(x + 4 * u, ay - 3 * u, 2 * u, 2 * u);
  } else if (id === "phones") {
    c.fillStyle = "#3a4048"; c.fillRect(x - 9 * u, ay - 2 * u, 18 * u, 2 * u);
    c.fillRect(x - 10 * u, ay, 4 * u, 6 * u); c.fillRect(x + 6 * u, ay, 4 * u, 6 * u);
    c.fillStyle = "#e05a6e"; c.fillRect(x - 9 * u, ay + u, 2 * u, 4 * u); c.fillRect(x + 7 * u, ay + u, 2 * u, 4 * u);
    c.fillStyle = "#5a6470"; c.fillRect(x - 7 * u, ay - 2 * u, 14 * u, u);
    c.fillStyle = "#2a3038"; c.fillRect(x + 9 * u, ay + 6 * u, u, 3 * u);
  }
}

// ---------- breeding (makeHybrid port — palette/name/trait mixing) ----------
let hybSeq = 1;
function mixHex(h1, h2) {
  const a = hexRgb(h1), b = hexRgb(h2);
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
    pal,
    top: Math.random() < 0.5 ? A.top : B.top,
  };
}
