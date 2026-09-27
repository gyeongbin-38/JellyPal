# Jellypal shop backend

Cloudflare Worker + KV. Stores only `sha256(uid)` — no personal data.

## Deploy (one time, ~10 min)

```sh
cd server
npm i -g wrangler
wrangler login
wrangler kv namespace create DB      # paste the printed id into wrangler.toml
wrangler secret put SERVER_SK        # pkcs8 DER hex = 302e020100300506032b657004220420 + <64-char seed from _svkeygen>
wrangler secret put ADMIN_KEY        # any long random string — used by grant.cjs
wrangler deploy                      # prints https://jellypal-api.<you>.workers.dev
```

Then put that URL into `SERVER_URL` in `src-tauri/src/lib.rs` and rebuild.

## Using it

**Code sales (itch.io):** mint codes with `node codes.cjs <pack> <count>` (seller key stays on your disk). Buyer redeems in-app; the server binds the code to their uid hash so it can't be shared.

**Direct grants / support:**
```sh
JP_API=https://<worker> JP_ADMIN=<key> node grant.cjs JP<uid> B
```
The app polls `/claim` on launch + every 10 min.

**Gumroad license keys (live store):** create one product per pack and turn
on license-key generation in each product's settings. Put each product's
permalink slug (`gumroad.com/l/<slug>`) into `GR_A..D` in wrangler.toml and
`wrangler deploy`. Buyers paste their key into the app's REDEEM CODE box;
`/redeem` probes each permalink via `api.gumroad.com/v2/licenses/verify`,
consumes one license use on first redeem, binds the key hash to the buyer's
uid hash, and returns a signed grant. Refunded/chargebacked purchases are
refused even though Gumroad answers `success`.

**Stripe auto-delivery (dormant — no Korea settlement):** the `/stripe`
webhook + `PRICE_<cents>` vars remain wired if the region ever opens up.

## Endpoints

| path | body | does |
|---|---|---|
| `GET /health` | – | liveness |
| `POST /redeem` | `{uid, code}` | verify seller sig **or** Gumroad license key, bind to uid hash, return signed grant |
| `POST /claim` | `{uid}` | return pending signed grants |
| `POST /ack` | `{uid, nonces}` | delete claimed grants |
| `POST /admin/grant` | `x-admin-key` + `{uid, pack}` | manual grant |
| `POST /stripe` | Stripe webhook | paid checkout -> pending grant |

## Rotate the server key

If `SERVER_SK` may have leaked: generate a fresh pair (`node _svkeygen.cjs`),
update `SERVER_PUBKEY` in lib.rs, `wrangler secret put SERVER_SK`, ship a new
build. Old pending grants re-sign at `/claim` time so nothing is lost.
