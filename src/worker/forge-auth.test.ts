import { describe, it, expect } from 'vitest'
import { MAX_USES, TOKEN_TTL_MS, signToken, verifyToken } from './forge-auth'

describe('forge auth token', () => {
  it('signs and verifies a valid token', async () => {
    const payload = { iat: Date.now(), uses: 0, nonce: 'nonce-1' }
    const token = await signToken(payload, 'secret')

    const result = await verifyToken(token, 'secret')
    expect(result.valid).toBe(true)
    expect(result.payload).toMatchObject(payload)
  })

  it('rejects tampered token', async () => {
    const payload = { iat: Date.now(), uses: 0, nonce: 'nonce-2' }
    const token = await signToken(payload, 'secret')
    const [body] = token.split('.')
    const tamperedBody = btoa(JSON.stringify({ ...payload, nonce: 'evil' }))

    const result = await verifyToken(`${tamperedBody}.${token.split('.')[1]}`, 'secret')
    expect(body).not.toBe(tamperedBody)
    expect(result.valid).toBe(false)
  })

  it('rejects expired token', async () => {
    const now = Date.now()
    const payload = { iat: now - TOKEN_TTL_MS - 1, uses: 0, nonce: 'nonce-3' }
    const token = await signToken(payload, 'secret')

    const result = await verifyToken(token, 'secret', now)
    expect(result.valid).toBe(false)
  })

  it('rejects token with exhausted embedded uses', async () => {
    const payload = { iat: Date.now(), uses: MAX_USES, nonce: 'nonce-4' }
    const token = await signToken(payload, 'secret')

    const result = await verifyToken(token, 'secret')
    expect(result.valid).toBe(false)
  })
})
