import type { Config } from '@netlify/functions'
import { authenticate, errorResponse, json, requireMethod } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    requireMethod(request, 'DELETE')
    const { admin, user } = await authenticate(request)
    const { error } = await admin.from('gmail_connections').delete().eq('user_id', user.id)
    if (error) throw error
    return json({ disconnected: true })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'DELETE' }
