// seller-side tool: drop a gem pack into a user's pending grants.
//   JP_ADMIN=<admin key> node grant.cjs JP<uid> <A|B|C|D>
// the buyer's uid is the MY ID shown in the app's settings — they paste it
// at checkout or in a support message. the app picks the grant up on its
// next /claim poll (max ~10 min) and pays out with a "+N JELLY!" pop.
const API = process.env.JP_API || "https://jellypal-api.workers.dev";
const KEY = process.env.JP_ADMIN || "";
const [, , uid, pack] = process.argv;

if (!KEY || !/^JP[A-Z2-7]{24}$/.test(uid || "") || !"ABCD".includes(pack || "")) {
  console.error('usage: JP_ADMIN=<key> node grant.cjs JP<24-char-uid> <A|B|C|D>');
  process.exit(1);
}
const r = await fetch(`${API}/admin/grant`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-key": KEY },
  body: JSON.stringify({ uid, pack }),
});
console.log(r.status, await r.text());
