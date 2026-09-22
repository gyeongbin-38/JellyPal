const s = require(process.env.APPDATA + "/com.jellypal.app/state.json");
const now = Date.now();
console.log(JSON.stringify({
  breedReadyAt: s.breedReadyAt,
  now,
  remainingMin: Math.round(((s.breedReadyAt || 0) - now) / 60000),
  breeds: s.stats && s.stats.breeds,
  jelly: s.jelly,
  owned: (s.owned || []).length,
  petHome: s.petHome,
  active: s.active,
  pals: (s.pals || []).map((p) => p.sp),
  props: ["bowl", "cushion", "box", "plant", "music", "mirror", "mat", "jar"]
    .filter((k) => s[k])
    .map((k) => `${k}@${Math.round(s[k].x)},${Math.round(s[k].y)}`),
  petX: Math.round(s.petX || 0), petY: Math.round(s.petY || 0),
}, null, 1));
