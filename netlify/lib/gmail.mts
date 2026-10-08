import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken } from './crypto.mts'

export async function accessToken(admin: SupabaseClient, userId: string, forceRefresh = false) {
  const { data: connection, error } = await admin.from('gmail_connections').select('token_ciphertext,token_iv,token_tag').eq('user_id', userId).maybeSingle()
  if (error || !connection) throw new Error('Connect Gmail to send messages.')
  const refreshToken = decryptToken({ ciphertext: connection.token_ciphertext, iv: connection.token_iv, tag: connection.token_tag })
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing server configuration: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    ...(forceRefresh ? { cache: 'no-store' as RequestCache } : {}),
  })
  const result = await response.json() as { access_token?: string; error?: string; error_description?: string }
  if (!response.ok || !result.access_token) {
    if (result.error === 'invalid_grant' || result.error === 'unauthorized_client') await admin.from('gmail_connections').update({ reauth_required: true, updated_at: new Date().toISOString() }).eq('user_id', userId)
    throw new Error(result.error_description || result.error || 'Gmail authorization expired. Reconnect the account.')
  }
  return result.access_token
}

export async function sendGmail(access: string, raw: string, timeoutMs = 20_000) {
  return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }), signal: AbortSignal.timeout(timeoutMs),
  })
}

export async function errorPayload(response: Response) {
  try {
    const result = await response.json() as { error?: { message?: string; errors?: Array<{ reason?: string }> } }
    return { message: result.error?.message || `Gmail rejected this request (${response.status}).`, reason: result.error?.errors?.[0]?.reason || '' }
  } catch { return { message: `Gmail rejected this request (${response.status}).`, reason: '' } }
}

export function sleep(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
