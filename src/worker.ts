import type { ExecutionContext } from '@cloudflare/workers-types'

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

const TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_USES = 5

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
      return handleForgeLog(env)
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

async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = JSON.stringify(payload)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Token = base64(payload).base64(signature)
  return btoa(data) + '.' + btoa(sigHex)
}

async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; payload?: { iat: number; uses: number; nonce: string } }> {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return { valid: false }

    const data = atob(payloadB64)
    const sigHex = atob(sigB64)
    const payload = JSON.parse(data) as { iat: number; uses: number; nonce: string }

    // Check expiry
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return { valid: false }

    // Check uses
    if (payload.uses >= MAX_USES) return { valid: false }

    // Verify HMAC
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))

    return valid ? { valid: true, payload } : { valid: false }
  } catch {
    return { valid: false }
  }
}

// ── Forge Handler ──

async function handleForge(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Validate forge token
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new Response(JSON.stringify({ error: 'Forge access requires a rip token' }), {
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

  try {
    const body = await request.json() as { idea?: string }
    const idea = body.idea?.trim()

    if (!idea) {
      return new Response(JSON.stringify({ error: 'No idea provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        { role: 'system', content: FORGE_SYSTEM_PROMPT },
        { role: 'user', content: idea },
      ],
      stream: true,
      max_tokens: 256,
      temperature: 0.8,
    })

    const [clientStream, logStream] = (stream as ReadableStream).tee()
    ctx.waitUntil(saveForgeLog(env, idea, logStream))

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

  const key = `forge:${Date.now()}`
  await env.FORGE_LOG.put(key, JSON.stringify({
    idea,
    response: fullResponse,
    timestamp: new Date().toISOString(),
  }))
}

async function handleForgeLog(env: Env): Promise<Response> {
  const { keys } = await env.FORGE_LOG.list({ prefix: 'forge:', limit: 50 })
  const entries = await Promise.all(
    keys.map(async (k) => {
      const val = await env.FORGE_LOG.get(k.name)
      return val ? JSON.parse(val) : null
    })
  )
  return new Response(JSON.stringify(entries.filter(Boolean)), {
    headers: { 'Content-Type': 'application/json' },
  })
}
