import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { authenticate, bodyJson, errorResponse, json } from '../lib/server.mts'

const profileSchema = z.object({ name: z.string().trim().min(1).max(100).regex(/^[^\0-\x1f\x7f]+$/), phone: z.string().trim().max(40).regex(/^[^\0-\x1f\x7f]*$/) })

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    if (request.method === 'GET') {
      const [{ data: profile, error }, { data: connection, error: connectionError }] = await Promise.all([
        admin.from('profiles').select('display_name,phone').eq('user_id', user.id).maybeSingle(),
        admin.from('gmail_connections').select('email,reauth_required').eq('user_id', user.id).maybeSingle(),
      ])
      if (error) throw error
      if (connectionError) throw connectionError
      return json({ profile: { name: profile?.display_name || '', phone: profile?.phone || '', email: user.email || '' }, gmail: connection ? { email: connection.email, reconnectRequired: connection.reauth_required } : null })
    }
    if (request.method === 'PUT') {
      const parsed = profileSchema.safeParse(await bodyJson(request))
      if (!parsed.success) return json({ error: 'Enter a name and a phone number up to 40 characters.' }, 400)
      const { error } = await admin.from('profiles').upsert({ user_id: user.id, display_name: parsed.data.name, phone: parsed.data.phone, email: user.email || '' }, { onConflict: 'user_id' })
      if (error) throw error
      return json({ profile: { ...parsed.data, email: user.email || '' } })
    }
    return json({ error: 'Use GET or PUT.' }, 405)
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: ['GET', 'PUT'] }
