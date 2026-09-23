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

**Stripe auto-delivery:** create a Payment Link per pack, give buyers the URL
as `https://buy.stripe.com/<link>?client_reference_id=` + their MY ID, add a
webhook to `<worker>/stripe` for `checkout.session.completed`, and set
`wrangler secret put STRIPE_WHSEC`. Pack is resolved from session metadata
or by price: add `[vars]` lines like `PRICE_499 = "B"` (USD cents) in
wrangler.toml.

## Endpoints

| path | body | does |
|---|---|---|
| `GET /health` | – | liveness |
| `POST /redeem` | `{uid, code}` | verify seller sig, bind code to uid hash, return signed grant |
| `POST /claim` | `{uid}` | return pending signed grants |
| `POST /ack` | `{uid, nonces}` | delete claimed grants |
| `POST /admin/grant` | `x-admin-key` + `{uid, pack}` | manual grant |
| `POST /stripe` | Stripe webhook | paid checkout -> pending grant |

## Rotate the server key

If `SERVER_SK` may have leaked: generate a fresh pair (`node _svkeygen.cjs`),
update `SERVER_PUBKEY` in lib.rs, `wrangler secret put SERVER_SK`, ship a new
build. Old pending grants re-sign at `/claim` time so nothing is lost.
