import type { ExecutionContext } from '@cloudflare/workers-types'
import { describe, expect, it } from 'vitest'
import worker, { MAX_MINTS_PER_DAY } from './worker'
import type { Env } from './worker'

const DAY_KEY = () => `forge-mints:${new Date().toISOString().slice(0, 10)}`

// Minimal in-memory stand-in for the FORGE_LOG binding. Records writes so a test can see the
// key, the value and the expiry the worker asked for.
function makeEnv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed))
  const writes: Array<{ key: string; value: string; ttl?: number }> = []
  const env = {
    ASSETS: { fetch: async () => new Response('assets') },
    AI: { run: async () => ({ response: 'stub' }) },
    FORGE_SECRET: 'test-secret',
    FORGE_LOG: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, value)
        writes.push({ key, value, ttl: options?.expirationTtl })
      },
      list: async () => ({ keys: [] }),
    },
  } as unknown as Env
  return { env, store, writes }
}

function mint(env: Env, ip = '203.0.113.9') {
  return worker.fetch(
    new Request('https://zpe.vc/api/forge/token', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': ip },
    }),
    env,
    {} as ExecutionContext,
  )
}

describe('token minting', () => {
  it('mints a token and charges the day, not just the address', async () => {
    const { env, store, writes } = makeEnv()
    const res = await mint(env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { token?: string }
    expect(typeof body.token).toBe('string')
    expect(store.get(DAY_KEY())).toBe('1')

    const dayWrite = writes.find((w) => w.key === DAY_KEY())
    expect(dayWrite).toBeDefined()
    // The counter expires by itself: within a day and a half of now, so it cannot pile up.
    expect(dayWrite!.ttl).toBeGreaterThan(0)
    expect(dayWrite!.ttl).toBeLessThanOrEqual(86_400 + 3600)
  })

  it('refuses once the day is spent, and spends nothing else', async () => {
    const { env, store, writes } = makeEnv({ [DAY_KEY()]: String(MAX_MINTS_PER_DAY) })
    const res = await mint(env)
    expect(res.status).toBe(429)
    const body = (await res.json()) as { token?: string; error?: string }
    expect(body.token).toBeUndefined()
    expect(body.error).toBeTruthy()

    // Retry-After points at the next UTC midnight, so it is a real wait, not zero.
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(86_400)

    // The ceiling is checked first: a refused mint must not charge the per-IP allowance either.
    expect(writes).toHaveLength(0)
    expect(store.get(DAY_KEY())).toBe(String(MAX_MINTS_PER_DAY))
  })
})
