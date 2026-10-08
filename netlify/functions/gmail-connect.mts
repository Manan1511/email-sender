import type { Config } from '@netlify/functions'
import { signState } from '../lib/crypto.mts'
import { authenticate, errorResponse, json, requireMethod, siteUrl } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    requireMethod(request, 'POST')
    const { user } = await authenticate(request)
    if (!user.email) throw new Error('Your Google sign-in has no verified email address.')
    const clientId = process.env.GMAIL_CLIENT_ID
    if (!clientId) throw new Error('Missing server configuration: GMAIL_CLIENT_ID.')
    const redirectUri = `${siteUrl(request)}/.netlify/functions/gmail-callback`
    const state = signState({ userId: user.id, appEmail: user.email, redirectUri, expiresAt: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/gmail.send')
    url.searchParams.set('state', state)
    return json({ url: url.toString() })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'POST' }
