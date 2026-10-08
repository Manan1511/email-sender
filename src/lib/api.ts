import { getSupabase } from './supabase'

export type ApiOptions = { method?: string; body?: unknown; signal?: AbortSignal }

export async function api<T = Record<string, unknown>>(name: string, options: ApiOptions = {}): Promise<T> {
  const { data } = await getSupabase().auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('Sign in again to continue.')
  const response = await fetch(`/.netlify/functions/${name}`, {
    method: options.method || 'GET', signal: options.signal,
    headers: { authorization: `Bearer ${accessToken}`, ...(options.body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

export async function downloadBatchCsv(batchId: string) {
  const { data } = await getSupabase().auth.getSession()
  if (!data.session) throw new Error('Sign in again to download results.')
  const response = await fetch(`/.netlify/functions/batch-export?id=${encodeURIComponent(batchId)}`, { headers: { authorization: `Bearer ${data.session.access_token}` } })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not download results.')
  return response.blob()
}
