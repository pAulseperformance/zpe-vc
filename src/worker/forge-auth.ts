export interface ForgeTokenPayload {
  iat: number
  uses: number
  nonce: string
}

export const TOKEN_TTL_MS = 10 * 60 * 1000
export const MAX_USES = 5

export async function signToken(payload: ForgeTokenPayload, secret: string): Promise<string> {
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
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return btoa(data) + '.' + btoa(sigHex)
}

export async function verifyToken(
  token: string,
  secret: string,
  now = Date.now()
): Promise<{ valid: boolean; payload?: ForgeTokenPayload }> {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) {
      return { valid: false }
    }

    const data = atob(payloadB64)
    const sigHex = atob(sigB64)
    const payload = JSON.parse(data) as ForgeTokenPayload

    if (!isValidPayload(payload)) {
      return { valid: false }
    }
    if (now - payload.iat > TOKEN_TTL_MS) {
      return { valid: false }
    }
    if (payload.uses >= MAX_USES) {
      return { valid: false }
    }

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigParts = sigHex.match(/.{2}/g)
    if (!sigParts) {
      return { valid: false }
    }
    const sigBytes = new Uint8Array(sigParts.map((b) => parseInt(b, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))

    return valid ? { valid: true, payload } : { valid: false }
  } catch {
    return { valid: false }
  }
}

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

function isValidPayload(value: unknown): value is ForgeTokenPayload {
  if (!value || typeof value !== 'object') {
    return false
  }
  const payload = value as Record<string, unknown>
  return (
    typeof payload.iat === 'number' &&
    Number.isFinite(payload.iat) &&
    typeof payload.uses === 'number' &&
    Number.isFinite(payload.uses) &&
    payload.uses >= 0 &&
    typeof payload.nonce === 'string' &&
    payload.nonce.length > 0
  )
}
