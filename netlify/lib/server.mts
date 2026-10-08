import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type AuthenticatedRequest = { admin: SupabaseClient; user: User; token: string }
export class HttpError extends Error { constructor(message: string, readonly status: number) { super(message) } }

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } })
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  const status = error instanceof HttpError ? error.status : message.startsWith('Missing server configuration:') ? 503 : error instanceof Error ? 400 : 500
  return json({ error: message }, status)
}

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing server configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function authenticate(request: Request): Promise<AuthenticatedRequest> {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!match || !url || !anon) throw new HttpError('Unauthorized.', 401)
  const identity = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await identity.auth.getUser(match[1])
  if (error || !data.user) throw new HttpError('Unauthorized.', 401)
  const admin = adminClient()
  const { data: allowed, error: rateError } = await admin.rpc('consume_user_rate_limit', { p_user_id: data.user.id, p_bucket: 'general', p_limit: 120, p_window_seconds: 60 })
  if (rateError) throw new HttpError('Could not verify the request limit. Try again shortly.', 503)
  if (!allowed) throw new HttpError('Request limit reached. Wait a minute and try again.', 429)
  return { admin, user: data.user, token: match[1] }
}

export async function bodyJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try { return await request.json() as T } catch { throw new Error('Request body must be valid JSON.') }
}

export function requireMethod(request: Request, method: string) {
  if (request.method !== method) throw new Error(`Use ${method} for this request.`)
}

export function siteUrl(request?: Request) {
  const configured = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL
  if (configured) return configured.replace(/\/$/, '')
  const origin = request?.headers.get('origin') || request?.headers.get('referer')
  if (origin) {
    const parsed = new URL(origin)
    if (parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return parsed.origin
  }
  throw new Error('Missing server configuration: set URL to the deployed site URL.')
}

export function safeErrorMessage(error: { message?: string; details?: string; code?: string }) {
  const combined = [error.message, error.details].filter(Boolean).join(' ')
  return combined.slice(0, 600) || 'The request could not be completed.'
}
