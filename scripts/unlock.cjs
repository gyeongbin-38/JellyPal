// Dev helper: unlock every species/accessory in a disposable test profile.
// Production saves are DPAPI/checkpoint protected; this tool intentionally
// refuses them instead of bypassing that protection.
//
//   $env:JELLYPAL_TEST_DATA_DIR = 'C:\absolute\marked\profile'
//   node unlock.cjs
//
// The directory must already contain `.jellypal-test-profile`, the same
// marker required by the backend's test-profile override.
const fs = require("fs");
const os = require("os");
const path = require("path");

process.chdir(require("path").join(__dirname, ".."));
const MARKER = ".jellypal-test-profile";

function catalog() {
  const src = fs.readFileSync("src/main.js", "utf8");
  const species = [...new Set([...src.matchAll(/\{ id: "([a-z]+)", name: "[A-Z][a-z]+"/g)].map((m) => m[1]))];
  const accs = [...new Set([...src.matchAll(/\{ id: "([a-z]+)", name: "[A-Z]+"/g)]
    .map((m) => m[1]).filter((id) => !species.includes(id)))];
  if (species.length < 50 || !species.includes("spidr") || accs.length < 10) {
    throw new Error(`catalog parse failed (species=${species.length}, accessories=${accs.length})`);
  }
  return { species, accs };
}

function protectedDirs() {
  if (!process.env.APPDATA) return [];
  return ["com.jellypal.desktop", "com.jellypal.app", "com.typet.app"]
    .map((name) => path.resolve(process.env.APPDATA, name).toLowerCase());
}

function unlockProfile(dir) {
  if (!dir || !path.isAbsolute(dir)) throw new Error("JELLYPAL_TEST_DATA_DIR must be an absolute path");
  const resolved = path.resolve(dir);
  if (protectedDirs().includes(resolved.toLowerCase())) throw new Error("refusing production or legacy profile path");
  if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) throw new Error("test profile directory does not exist");
  if (!fs.statSync(path.join(resolved, MARKER), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`test profile marker missing: ${MARKER}`);
  }

  const file = path.join(resolved, "state.json");
  let state = {};
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.startsWith("JPENC1:")) throw new Error("refusing sealed save in test profile");
    state = JSON.parse(raw) || {};
    if (typeof state !== "object" || Array.isArray(state)) throw new Error("test save must be a JSON object");
  }

  const { species, accs } = catalog();
  const hybrids = Array.isArray(state.owned) ? state.owned.filter((id) => /^hyb\d+$/.test(id)) : [];
  state.owned = [...species, ...hybrids];
  state.accOwned = accs;
  state.jelly = 99999;
  state.seen = true;
  state.active = "spidr";

  // An external edit cannot match an old checkpoint. Test profiles have no
  // registry watermark, so clear only their local stale generations and let
  // the backend create a fresh checkpoint on the next save.
  for (const name of ["state.json.bak", "state.chk", "state.chk.tmp"]) {
    fs.rmSync(path.join(resolved, name), { force: true });
  }
  const tmp = path.join(resolved, "state.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
  return { state, species: species.length, accs: accs.length };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jellypal-unlock-"));
  let pass = 0;
  const check = (name, ok) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    if (!ok) throw new Error(name);
    pass++;
  };
  try {
    const unmarked = path.join(root, "unmarked");
    fs.mkdirSync(unmarked);
    let refused = false;
    try { unlockProfile(unmarked); } catch { refused = true; }
    check("unmarked directory refused", refused && !fs.existsSync(path.join(unmarked, "state.json")));

    if (protectedDirs().length) {
      refused = false;
      try { unlockProfile(protectedDirs()[0]); } catch { refused = true; }
      check("production profile path refused", refused);
    }

    const profile = path.join(root, "profile");
    fs.mkdirSync(profile);
    fs.writeFileSync(path.join(profile, MARKER), "unlock-self-test\n");
    fs.writeFileSync(path.join(profile, "state.json"), "JPENC1:not-a-test-save");
    refused = false;
    try { unlockProfile(profile); } catch { refused = true; }
    check("sealed save refused even when marked", refused && fs.readFileSync(path.join(profile, "state.json"), "utf8").startsWith("JPENC1:"));
    fs.writeFileSync(path.join(profile, "state.json"), JSON.stringify({ owned: ["sprout", "hyb7"], jelly: 3 }));
    fs.writeFileSync(path.join(profile, "state.chk"), "stale");
    fs.writeFileSync(path.join(profile, "state.json.bak"), "stale");
    const result = unlockProfile(profile);
    const saved = JSON.parse(fs.readFileSync(path.join(profile, "state.json"), "utf8"));
    check("all species unlocked", saved.owned.length === result.species + 1 && saved.owned.includes("spidr"));
    check("hybrid preserved", saved.owned.includes("hyb7"));
    check("all accessories unlocked", saved.accOwned.length === result.accs);
    check("dev wallet and active species set", saved.jelly === 99999 && saved.seen === true && saved.active === "spidr");
    check("stale checkpoint generations cleared", !fs.existsSync(path.join(profile, "state.chk")) && !fs.existsSync(path.join(profile, "state.json.bak")));
    check("atomic temp cleaned", !fs.existsSync(path.join(profile, "state.json.tmp")));
    console.log(`UNLOCK SELF-TEST GREEN (${pass}/${pass})`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  try {
    const result = unlockProfile(process.env.JELLYPAL_TEST_DATA_DIR);
    console.log(`unlocked ${result.species} species + ${result.accs} accessories; jelly=99999; active=spidr`);
  } catch (e) {
    console.error(`unlock refused: ${e.message}`);
    console.error(`set JELLYPAL_TEST_DATA_DIR to an absolute directory containing ${MARKER}`);
    process.exit(2);
  }
}
