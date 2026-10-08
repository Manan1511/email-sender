import { afterEach, describe, expect, it } from 'vitest'
import { decryptToken, encryptToken, signState, verifyState } from './crypto.mts'
import { sanitizeMessage } from './sanitize.mts'
import { safeWorkerSecret } from './worker-auth.mts'

const previous = {
  encryption: process.env.GMAIL_TOKEN_ENCRYPTION_KEY,
  state: process.env.GMAIL_STATE_SECRET,
  worker: process.env.WORKER_SECRET,
}

afterEach(() => {
  if (previous.encryption === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY; else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = previous.encryption
  if (previous.state === undefined) delete process.env.GMAIL_STATE_SECRET; else process.env.GMAIL_STATE_SECRET = previous.state
  if (previous.worker === undefined) delete process.env.WORKER_SECRET; else process.env.WORKER_SECRET = previous.worker
})

describe('server-side security helpers', () => {
  it('encrypts OAuth refresh tokens with authenticated encryption', () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = 'test-only-independent-key-1234567890'
    const saved = encryptToken('refresh-token-test-value')
    expect(saved.ciphertext).not.toContain('refresh-token-test-value')
    expect(decryptToken(saved)).toBe('refresh-token-test-value')
    expect(() => decryptToken({ ...saved, tag: Buffer.alloc(16).toString('base64') })).toThrow()
  })

  it('accepts only unexpired state with a valid signature', () => {
    process.env.GMAIL_STATE_SECRET = 'test-only-state-secret-1234567890'
    const signed = signState({ userId: 'u-1', expiresAt: Date.now() + 30_000 })
    expect(verifyState<{ userId: string }>(signed).userId).toBe('u-1')
    expect(() => verifyState(`${signed}x`)).toThrow(/invalid/i)
    expect(() => verifyState(signState({ expiresAt: Date.now() - 1 }))).toThrow(/expired/i)
  })

  it('sanitizes rich text and strips executable links and event attributes', () => {
    const clean = sanitizeMessage('<p onclick="alert(1)">Hello <strong>world</strong><img src=x onerror="alert(1)"></p><a href="javascript:alert(1)">bad</a>')
    expect(clean).toContain('<strong>world</strong>')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('javascript:')
  })

  it('rejects missing and mismatched worker secrets', () => {
    process.env.WORKER_SECRET = 'worker-secret-that-is-not-for-the-browser'
    expect(safeWorkerSecret(new Request('https://app.test', { headers: { 'x-worker-secret': 'wrong' } }))).toBe(false)
    expect(safeWorkerSecret(new Request('https://app.test', { headers: { 'x-worker-secret': process.env.WORKER_SECRET } }))).toBe(true)
  })
})
