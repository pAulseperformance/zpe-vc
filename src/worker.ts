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

async function handleForge(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    // Tee the stream — one for the client, one to collect the full response for KV
    const [clientStream, logStream] = (stream as ReadableStream).tee()

    // Save to KV in the background (don't block the response)
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

async function saveForgeLog(env: Env, idea: string, stream: ReadableStream): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let fullResponse = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      // SSE format: extract data lines
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
