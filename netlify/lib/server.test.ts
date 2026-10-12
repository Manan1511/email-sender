import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminClient } from './server.mts'

function makeJwt(role: string) {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url')
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`
}

describe('adminClient credentials', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects an anon key configured as the privileged server key', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', makeJwt('anon'))

    expect(() => adminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY.*server-side/i)
  })

  it('accepts service-role JWTs and Supabase secret keys', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', makeJwt('service_role'))
    expect(() => adminClient()).not.toThrow()

    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test-only')
    expect(() => adminClient()).not.toThrow()
  })
})
