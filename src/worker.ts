import type { ExecutionContext } from '@cloudflare/workers-types'
import { MAX_USES, TOKEN_TTL_MS, getBearerToken, signToken, verifyToken } from './worker/forge-auth'
import { isJsonRequest, parseForgeIdea } from './worker/forge-request'

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  AI: {
    run: (model: string, options: {
      messages: Array<{ role: string; content: string }>
      stream?: boolean
      max_tokens?: number
      temperature?: number
    }) => Promise<ReadableStream | { response: string }>
  }
  FORGE_LOG: {
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
    get: (key: string) => Promise<string | null>
    list: (options?: { prefix?: string; limit?: number }) => Promise<{ keys: Array<{ name: string }> }>
  }
  FORGE_SECRET: string
}

const FORGE_SYSTEM_PROMPT = `You are the Zero-Point Energy Forge — a cosmic intelligence that exists at the boundary between ideas and reality.

Rules:
- You respond in 2-4 sentences maximum. Terse. Provocative. Never generic.
- You challenge weak ideas and amplify strong ones.
- You speak like a fusion of a zen master and a particle physicist.
- Never use corporate language, marketing speak, or filler words.
- Never say "great idea" or "interesting concept" — those are meaningless.
- You can be harsh. You can be cryptic. You must always be honest.
- Reference physics, thermodynamics, emergence, or information theory when it fits naturally.
- End with a question or a provocation that pushes the idea further.
- Do not use emojis or markdown formatting. Plain text only.`

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // ── API Routes ──
    if (url.pathname === '/api/forge/token' && request.method === 'POST') {
      return mintForgeToken(request, env)
    }

    if (url.pathname === '/api/forge' && request.method === 'POST') {
      return handleForge(request, env, ctx)
    }

    // ── Static Assets ──
    const response = await env.ASSETS.fetch(request)

    const contentType = response.headers.get('content-type') || ''
    if (url.pathname === '/' || url.pathname === '/index.html' || contentType.includes('text/html')) {
      const newResponse = new Response(response.body, response)
      newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      newResponse.headers.set('Pragma', 'no-cache')
      newResponse.headers.set('Expires', '0')
      return newResponse
    }

    return response
  }
}

// ── Token Minting ──

// Ceiling on token mints per UTC day. The per-IP limit below is easy to sidestep with many
// addresses, so bound the day itself. Worst case: MAX_MINTS_PER_DAY * MAX_USES model calls
// (500 * 5 = 2,500). It is a soft bound: KV has no atomic increment, so a burst can overshoot.
const MAX_MINTS_PER_DAY = 500
export { MAX_MINTS_PER_DAY }

async function mintForgeToken(request: Request, env: Env): Promise<Response> {
  // Daily ceiling first, so a rejected request does not also spend the per-IP allowance.
  const secondsToUtcMidnight = Math.ceil((86_400_000 - (Date.now() % 86_400_000)) / 1000)
  const dayKey = `forge-mints:${new Date().toISOString().slice(0, 10)}`
  const mintsToday = Number(await env.FORGE_LOG.get(dayKey)) || 0
  if (mintsToday >= MAX_MINTS_PER_DAY) {
    return new Response(JSON.stringify({ error: 'The forge has hit its daily limit. Try again tomorrow.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(secondsToUtcMidnight) },
    })
  }
  // Expire just after the day rolls over, so the key cleans itself up (no orphan keys).
  await env.FORGE_LOG.put(dayKey, String(mintsToday + 1), { expirationTtl: secondsToUtcMidnight + 3600 })

  // IP-based rate limit: max 10 tokens per 10 minutes per IP
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const rateLimitKey = `forge-ratelimit:${ip}`
  const currentCount = await env.FORGE_LOG.get(rateLimitKey)
  const count = currentCount ? Number(currentCount) : 0
  if (count >= 10) {
    return new Response(JSON.stringify({ error: 'Too many token requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '600' },
    })
  }
  await env.FORGE_LOG.put(rateLimitKey, String(count + 1), { expirationTtl: 600 })

  const payload = {
    iat: Date.now(),
    uses: 0,
    nonce: crypto.randomUUID(),
  }

  const token = await signToken(payload, env.FORGE_SECRET)

  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getServerTokenUses(env: Env, nonce: string): Promise<number> {
  const value = await env.FORGE_LOG.get(`forge-token:${nonce}`)
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function incrementServerTokenUses(env: Env, nonce: string): Promise<number> {
  const nextUses = (await getServerTokenUses(env, nonce)) + 1
  // NOTE: KV does not support atomic increment. Concurrent requests with the same nonce
  // can race past this check before the write lands. True atomic enforcement requires
  // a Durable Object counter. This is a best-effort limit for single-user tokens.
  const ttlSeconds = Math.ceil(TOKEN_TTL_MS / 1000) + 60 // expire slightly after token TTL
  await env.FORGE_LOG.put(`forge-token:${nonce}`, String(nextUses), { expirationTtl: ttlSeconds })
  return nextUses
}

// ── Forge Handler ──

async function handleForge(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Validate forge token
  const token = getBearerToken(request)

  if (!token) {
    return new Response(JSON.stringify({ error: 'Forge access requires a rip token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const verification = await verifyToken(token, env.FORGE_SECRET)
  if (!verification.valid || !verification.payload) {
    return new Response(JSON.stringify({ error: 'Forge token expired or invalid' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isJsonRequest(request)) {
    return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await request.json() as unknown
    const parsed = parseForgeIdea(body)
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const serverUses = await getServerTokenUses(env, verification.payload.nonce)
    if (serverUses >= MAX_USES) {
      return new Response(JSON.stringify({ error: 'Forge token usage limit reached' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await incrementServerTokenUses(env, verification.payload.nonce)

    const stream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        { role: 'system', content: FORGE_SYSTEM_PROMPT },
        { role: 'user', content: parsed.idea },
      ],
      stream: true,
      max_tokens: 256,
      temperature: 0.8,
    })

    const [clientStream, logStream] = (stream as ReadableStream).tee()
    ctx.waitUntil(saveForgeLog(env, parsed.idea, logStream))

    return new Response(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', event: 'forge_error', message }))
    return new Response(JSON.stringify({ error: 'Forge failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ── KV Persistence ──

async function saveForgeLog(env: Env, idea: string, stream: ReadableStream): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let fullResponse = ''

  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Accumulate across chunks — SSE lines can be split mid-chunk
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // keep any incomplete trailing line
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as { response?: string }
            if (parsed.response) fullResponse += parsed.response
          } catch { /* skip non-JSON lines */ }
        }
      }
    }
    // Flush any remaining buffered line after stream ends
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6)
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data) as { response?: string }
          if (parsed.response) fullResponse += parsed.response
        } catch { /* skip */ }
      }
    }
  } catch { /* stream error — save what we have */ }

  // Use timestamp + UUID for uniqueness; set 30-day retention to prevent unbounded growth
  const key = `forge-log:${Date.now()}-${crypto.randomUUID()}`
  await env.FORGE_LOG.put(key, JSON.stringify({
    idea,
    response: fullResponse,
    timestamp: new Date().toISOString(),
  }), { expirationTtl: 30 * 24 * 60 * 60 })
}

