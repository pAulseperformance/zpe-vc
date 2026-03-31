export const MAX_IDEA_CHARS = 1200

export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type')
  return contentType?.toLowerCase().includes('application/json') ?? false
}

export function parseForgeIdea(body: unknown): { ok: true; idea: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }

  const rawIdea = (body as { idea?: unknown }).idea
  if (typeof rawIdea !== 'string') {
    return { ok: false, error: 'No idea provided' }
  }

  const idea = rawIdea.trim()
  if (!idea) {
    return { ok: false, error: 'No idea provided' }
  }

  if (idea.length > MAX_IDEA_CHARS) {
    return { ok: false, error: `Idea too long (max ${MAX_IDEA_CHARS} chars)` }
  }

  return { ok: true, idea }
}
