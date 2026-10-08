# Deploy record: zpe.vc

The Cloudflare Worker `zpe-vc` serves `zpe.vc` (custom domain) from `./dist`.

| | version id | deployed | notes |
|---|---|---|---|
| **live now** | `dd1b3c58-ac71-4eca-b917-f3a153379e57` | 2026-10-08 | added the daily ceiling on token mints |
| **roll back to** | `c4a30516-d589-401d-acf8-19253393654c` | 2026-10-08 | the previous live build (forge-log route removed) |

Rollback (one command):

```sh
cf_run.sh <wrangler> versions deploy c4a30516-d589-401d-acf8-19253393654c \
  --config wrangler.jsonc
```

Build and ship:

```sh
npm install            # resolves with no flags
npm run build          # tsc -b && vite build
npx wrangler deploy    # via cf_run.sh so the credential never touches argv
```

Wrangler is not vendored in this repo, so the deploy resolves it through npx
(`npx --yes wrangler@4`). `--no-install` fails.

## History

- **2026-10-08 (latest)**: added a daily ceiling on token mints. The per-IP limit on its own let
  one address ask the model roughly 7,200 times a day (10 mints per 10 minutes, 5 uses per
  token). `MAX_MINTS_PER_DAY = 500` caps the whole day at 500 x 5 = 2,500 model calls. It is
  read before the per-IP check, so a refused mint spends nothing else. The counter lives at
  `forge-mints:<utc date>` with a TTL just past midnight, so it cleans itself up. Two tests in
  `src/worker.test.ts` cover the mint and the refusal (suite went 8 -> 10). Deployed
  `dd1b3c58`; live probes afterwards: `GET /` 200, `POST /api/forge/token` 200 with a token,
  `POST /api/forge` without one 401, and `forge-mints:2026-10-08` is present in the namespace.
- **2026-10-08 (later)**: suppressed the 2 lint errors instead of rewriting the author's
  deliberate pattern, after asking. Every gate is green: `bootstrap`, `build`, `typecheck`,
  `test`, `lint`. The emitted assets are byte-identical to the previous build, so live was
  still `c4a30516` and this needed no redeploy.
- **2026-10-08**: removed `GET /api/forge/log`. It listed the last 50 `forge-log:` entries
  (each entry: the idea plus the model's reply) to any caller holding a token, and the token
  mint takes no auth or origin check. Nothing consumed the route; the frontend never calls it.
  39 lines deleted, no test covered it. Live probes after the deploy: that path now falls
  through to the static fallback (200 text/html, zero entries), `GET /` still 200, and
  `POST /api/forge` with no token still 401.
  Note on what was actually exposed: the namespace held **0** keys under the prefix the route
  read (`forge-log:`), so the route returned an empty list. The hole was real in the code and
  empty in the data. The 17 stored entries live under the older `forge:` prefix.
- **2026-10-07**: the deployed build was six months older than the repo. `main` was
  fast-forwarded to the deployed branch (`perf/expert-speed-pass`) and the page rebuilt and
  redeployed, so the repo and production are the same revision again.
  Build fixes needed to get there:
  - `src/worker.ts`: `FORGE_LOG.put` was typed with two arguments while three call sites pass
    an `expirationTtl`, so `tsc -b` refused to build.
  - `src/features/quantum-canvas/lib/use-auto-sim.ts`: unused `useLayoutEffect` import.
  - `package.json`: `@vitejs/plugin-react ^6` peers vite `^8`, but this branch pins vite
    `^7.0.0`; pinned the plugin to `^5.2.0`, which peers vite `^7`.

## Known, not fixed

- **The mint is still unauthenticated.** `POST /api/forge/token` takes no auth and no origin
  check, so a script can still mint. The daily ceiling bounds what that costs, it does not stop
  it. A shared secret would break the public demo, so the real fix is Turnstile on the mint
  (site key, secret binding, a widget on the page). Deferred until the forge is something
  people use.
- **The 2 `react-hooks/refs` errors are suppressed, not fixed.** `use-auto-sim.ts:32,37` each
  carry an `eslint-disable-next-line react-hooks/refs` whose comment says why the render-time
  sync is deliberate (it closes a post-paint stale window) and what the real fix is (a
  `useLayoutEffect`, which still runs before the first animation frame). Lint is clean, so
  `.github/workflows/ci.yml:26` is green again and the next real failure is visible again.
- **The KV namespace is split across prefixes.** `FORGE_LOG`
  (`cd612b74d74c4e2dbc6ca71d91862629`) holds 17 keys under `forge:<ts>`, written by the
  2026-03-17 build, which read and wrote that prefix. This code reads and writes `forge-log:`.
  So those 17 entries are unreachable from a live route and nothing deleted them, while the
  rate-limit and mint counters are short-lived by design (listed 2026-10-08: 17 `forge:`, 1
  `forge-mints:`, 1 `forge-ratelimit:`).
- **The static fallback masks unknown API paths.** `wrangler.jsonc`
  `not_found_handling: single-page-application` answers unknown `/api/*` paths and wrong HTTP
  methods with 200 text/html instead of 404/405.
- **A build after a fresh `npm install` is a few bytes off the deployed bundle.** Every pinned
  version is unchanged (vite 7.3.7, plugin-react 5.2.0, tailwind/vite 4.2.1, react 19.2.4, three
  0.183.2), yet such a build emits `index-B54NiWMA.js` and `index-C15oMgoC.css` where live served
  `index-DVsbgxMD.js` and `index-Dsu7pIzr.css`. Close, not identical. Not chased: the deployed
  assets are a real build of this source. The asset names served now are whatever `dd1b3c58`
  shipped.
