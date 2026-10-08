import type { Config } from '@netlify/functions'
import { decryptToken, encryptToken, verifyState } from '../lib/crypto.mts'
import { adminClient, siteUrl } from '../lib/server.mts'

type OAuthState = { userId: string; appEmail: string; redirectUri: string; expiresAt: number }

function redirect(url: string) { return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } }) }

export default async (request: Request) => {
  let destination = siteUrl(request)
  try {
    const params = new URL(request.url).searchParams
    const state = verifyState<OAuthState>(params.get('state') || '')
    destination = state.redirectUri.replace('/.netlify/functions/gmail-callback', '')
    if (params.has('error')) throw new Error('Google did not grant Gmail access.')
    const code = params.get('code')
    if (!code) throw new Error('Google did not return an authorization code.')
    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Missing server configuration: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: state.redirectUri, grant_type: 'authorization_code' }),
    })
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; error_description?: string }
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google could not exchange the authorization code.')
    const identityResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } })
    const identity = await identityResponse.json() as { email?: string; verified_email?: boolean }
    if (!identityResponse.ok || !identity.email || !identity.verified_email) throw new Error('Google did not confirm the Gmail account address.')
    if (identity.email.toLocaleLowerCase() !== state.appEmail.toLocaleLowerCase()) throw new Error('Connect the same Google account you used to sign in.')
    const admin = adminClient()
    let refresh = tokens.refresh_token
    if (!refresh) {
      const { data: existing } = await admin.from('gmail_connections').select('token_ciphertext,token_iv,token_tag').eq('user_id', state.userId).maybeSingle()
      if (existing) refresh = decryptToken({ ciphertext: existing.token_ciphertext, iv: existing.token_iv, tag: existing.token_tag })
    }
    if (!refresh) throw new Error('Google did not return a refresh token. Disconnect Gmail in your Google account settings, then connect again.')
    const encrypted = encryptToken(refresh)
    const { error } = await admin.from('gmail_connections').upsert({
      user_id: state.userId, email: identity.email, token_ciphertext: encrypted.ciphertext, token_iv: encrypted.iv, token_tag: encrypted.tag,
      reauth_required: false, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw new Error('Could not save the Gmail connection.')
    return redirect(`${destination}/?gmail=connected`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Gmail.'
    return redirect(`${destination}/?gmail=error&message=${encodeURIComponent(message.slice(0, 200))}`)
  }
}

export const config: Config = { method: 'GET' }
