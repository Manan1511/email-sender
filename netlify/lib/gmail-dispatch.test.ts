import { describe, expect, it, vi } from 'vitest'
import { dispatchWithRefresh } from './gmail-dispatch.mts'

describe('Gmail dispatch with access-token refresh', () => {
  it('keeps a failed refresh distinct from an ambiguous send', async () => {
    const failure = new Error('Refresh token was revoked.')

    const result = await dispatchWithRefresh(
      'expired-token',
      async () => new Response(null, { status: 401 }),
      async () => { throw failure },
    )

    expect(result).toEqual({ kind: 'refresh_failed', error: failure })
  })

  it('retries a definite 401 with a refreshed access token', async () => {
    const send = vi.fn(async (token: string) => new Response(null, { status: token === 'fresh-token' ? 202 : 401 }))
    const refresh = vi.fn(async () => 'fresh-token')

    const result = await dispatchWithRefresh('expired-token', send, refresh)

    expect(send).toHaveBeenNthCalledWith(1, 'expired-token')
    expect(send).toHaveBeenNthCalledWith(2, 'fresh-token')
    expect(refresh).toHaveBeenCalledOnce()
    expect(result).toEqual({ kind: 'response', response: expect.any(Response), accessToken: 'fresh-token' })
    if (result.kind === 'response') expect(result.response.status).toBe(202)
  })

  it('marks a network failure as ambiguous and does not refresh', async () => {
    const failure = new Error('Request timed out.')
    const refresh = vi.fn(async () => 'fresh-token')

    const result = await dispatchWithRefresh('valid-token', async () => { throw failure }, refresh)

    expect(result).toEqual({ kind: 'ambiguous', error: failure })
    expect(refresh).not.toHaveBeenCalled()
  })
})
