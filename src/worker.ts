import type { ExecutionContext } from '@cloudflare/workers-types'
import { MAX_USES, getBearerToken, signToken, verifyToken } from './worker/forge-auth'
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
    put: (key: string, value: string) => Promise<void>
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
      return mintForgeToken(env)
    }

    if (url.pathname === '/api/forge' && request.method === 'POST') {
      return handleForge(request, env, ctx)
    }

    if (url.pathname === '/api/forge/log' && request.method === 'GET') {
      return handleForgeLog(request, env)
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

async function mintForgeToken(env: Env): Promise<Response> {
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
  await env.FORGE_LOG.put(`forge-token:${nonce}`, String(nextUses))
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

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
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
  } catch { /* stream error — save what we have */ }

  const key = `forge-log:${Date.now()}`
  await env.FORGE_LOG.put(key, JSON.stringify({
    idea,
    response: fullResponse,
    timestamp: new Date().toISOString(),
  }))
}

async function handleForgeLog(request: Request, env: Env): Promise<Response> {
  const token = getBearerToken(request)
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing forge token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { valid } = await verifyToken(token, env.FORGE_SECRET)
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Forge token expired or invalid' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { keys } = await env.FORGE_LOG.list({ prefix: 'forge-log:', limit: 50 })
  const entries = await Promise.all(
    keys.map(async (k) => {
      const val = await env.FORGE_LOG.get(k.name)
      if (!val) {
        return null
      }
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    })
  )
  return new Response(JSON.stringify(entries.filter(Boolean)), {
    headers: { 'Content-Type': 'application/json' },
  })
}
