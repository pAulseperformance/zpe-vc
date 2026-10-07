# Deploy record — zpe.vc

The Cloudflare Worker `zpe-vc` serves `zpe.vc` (custom domain) from `./dist`.

| | version id | deployed | notes |
|---|---|---|---|
| **live now** | `d8407bdd-0e25-4156-9b4c-b40741c22645` | 2026-10-07 | built from commit `05230fc` |
| **roll back to** | `0ce5a593-cfa1-4812-be85-81800517d627` | 2026-03-17 | the previous live build |

Rollback (one command):

```sh
cf_run.sh <wrangler> versions deploy 0ce5a593-cfa1-4812-be85-81800517d627 \
  --config wrangler.jsonc
```

Build and ship:

```sh
npm install            # resolves with no flags
npm run build          # tsc -b && vite build
npx wrangler deploy    # via cf_run.sh so the credential never touches argv
```

## History

- **2026-10-07** — the deployed build was six months older than the repo. `main` was
  fast-forwarded to the deployed branch (`perf/expert-speed-pass`) and the page rebuilt and
  redeployed, so the repo and production are the same revision again.
  Build fixes needed to get there:
  - `src/worker.ts` — `FORGE_LOG.put` was typed with two arguments while three call sites pass
    an `expirationTtl`, so `tsc -b` refused to build.
  - `src/features/quantum-canvas/lib/use-auto-sim.ts` — unused `useLayoutEffect` import.
  - `package.json` — `@vitejs/plugin-react ^6` peers vite `^8`, but this branch pins vite
    `^7.0.0`; pinned the plugin to `^5.2.0`, which peers vite `^7`.

## Known, not fixed

- The KV namespace `FORGE_LOG` still holds 17 keys named `forge:<ts>`, written by the
  2026-03-17 build. This code reads prefix `forge-log:`, so those historical entries no longer
  list. The values are still in KV; nothing was deleted.
- `npm run lint` reports 2 `react-hooks/refs` errors (`use-auto-sim.ts`). They predate this
  change and are not on the build path.
