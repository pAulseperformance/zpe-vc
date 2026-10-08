# Deploy record: zpe.vc

The Cloudflare Worker `zpe-vc` serves `zpe.vc` (custom domain) from `./dist`.

| | version id | deployed | notes |
|---|---|---|---|
| **live now** | `c4a30516-d589-401d-acf8-19253393654c` | 2026-10-08 | built from commit `3e210b8` |
| **roll back to** | `d8407bdd-0e25-4156-9b4c-b40741c22645` | 2026-10-07 | the previous live build |

Rollback (one command):

```sh
cf_run.sh <wrangler> versions deploy d8407bdd-0e25-4156-9b4c-b40741c22645 \
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

- **2026-10-08 (later)**: suppressed the 2 lint errors instead of rewriting the author's
  deliberate pattern, after asking. Every gate is green: `bootstrap`, `build`, `typecheck`,
  `test`, `lint`. The emitted assets are byte-identical to the previous build, so live is
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

- **The 2 `react-hooks/refs` errors are suppressed, not fixed.** `use-auto-sim.ts:32,37` each
  carry an `eslint-disable-next-line react-hooks/refs` whose comment says why the render-time
  sync is deliberate (it closes a post-paint stale window) and what the real fix is (a
  `useLayoutEffect`, which still runs before the first animation frame). Lint is clean, so
  `.github/workflows/ci.yml:26` is green again and the next real failure is visible again.
- **The KV namespace is split across two prefixes.** `FORGE_LOG`
  (`cd612b74d74c4e2dbc6ca71d91862629`) holds 17 keys, every one named `forge:<ts>`, written by the
  2026-03-17 build, which read and wrote that prefix. This code reads and writes `forge-log:`.
  So those 17 entries are unreachable from a live route and nothing deleted them. Verified
  2026-10-08 by listing the namespace: 17 keys, all under `forge:`.
- **The static fallback masks unknown API paths.** `wrangler.jsonc`
  `not_found_handling: single-page-application` answers unknown `/api/*` paths and wrong HTTP
  methods with 200 text/html instead of 404/405.
- **A build after a fresh `npm install` is a few bytes off the deployed bundle.** Every pinned
  version is unchanged (vite 7.3.7, plugin-react 5.2.0, tailwind/vite 4.2.1, react 19.2.4, three
  0.183.2), yet such a build emits `index-B54NiWMA.js` and `index-C15oMgoC.css` where live serves
  `index-DVsbgxMD.js` and `index-Dsu7pIzr.css`. Close, not identical. Not chased, and no redeploy
  for it: the deployed assets are a real build of this source.
