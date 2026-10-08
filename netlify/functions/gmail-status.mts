import type { Config } from '@netlify/functions'
import { authenticate, errorResponse, json, requireMethod } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    requireMethod(request, 'GET')
    const { admin, user } = await authenticate(request)
    const { data, error } = await admin.from('gmail_connections').select('email,reauth_required,connected_at').eq('user_id', user.id).maybeSingle()
    if (error) throw error
    return json({ connection: data ? { email: data.email, reconnectRequired: data.reauth_required, connectedAt: data.connected_at } : null })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'GET' }
