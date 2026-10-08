# Deploy record: zpe.vc

The Cloudflare Worker `zpe-vc` serves `zpe.vc` (custom domain) from `./dist`.

| | version id | deployed | notes |
|---|---|---|---|
| **live now** | `41a00d92-99c1-4bb1-bd1e-fe36ef01450f` | 2026-10-08 | the calm default: `waveFreq` 30, saved-tuning key v5 |
| **roll back to** | `dd1b3c58-ac71-4eca-b917-f3a153379e57` | 2026-10-08 | the previous live build (daily mint ceiling) |

Rollback (one command):

```sh
cf_run.sh <wrangler> versions deploy dd1b3c58-ac71-4eca-b917-f3a153379e57 \
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

- **2026-10-08 (latest)**: shipped the calm default for the wave field. The engine change one
  commit earlier (`753c766`) made one knob set both the crest speed and the shimmer rate
  (`waveFreq * waveSpeed`). At the old default of 150 that pushed the shimmer from 30 to 150
  rad/s, five times the rate the page ever moved, which is what the owner saw and pushed back on.
  He picked the wider-ripple variant out of a four-panel preview, so `DEFAULT_TUNING.waveFreq`
  went 150 -> 30 and `freq * speed` stays at the 30 rad/s the original shader hardcoded. The
  active tuning persists in localStorage and saved values beat defaults, so a returning visitor
  would have kept the old frequency; `ACTIVE_KEY` moved `zpe-shader-active-v4` -> `v5` and
  everyone gets the new default once. Two tests in `field.test.ts` lock both numbers (suite
  21 -> 23). Commit `8f45a48`. Deployed `41a00d92`; probes after: `GET /` 200 serving
  `assets/index-7KPcXS-s.js`, the bundle carries `zpe-shader-active-v5`, and the default object
  holds `waveFreq:30` with no `v4` key left in the file.
  **Open, needs the owner's yes**: the 13 built-in presets carry their own frequencies, so their
  shimmer moved with the same fix. Three of them now run at rates that read as noise
  (Supermassive `7500 x 100`, Hypernova `375000 x 0.1`, Wobverse `110710 x 16.9`). Holding each
  preset's authored 30 rad/s means re-deriving its frequency as `30 / speed`, which rewrites his
  curated content, so it waits.
- **2026-10-08**: added a daily ceiling on token mints. The per-IP limit on its own let
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
