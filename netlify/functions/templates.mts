import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { authenticate, bodyJson, errorResponse, json } from '../lib/server.mts'
import { sanitizeMessage } from '../lib/sanitize.mts'

const templateSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), subject: z.string().trim().min(1).max(200), bodyHtml: z.string().min(1).max(100_000) })

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    if (request.method === 'GET') {
      const { data, error } = await admin.from('templates').select('id,name,subject,body_html,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false })
      if (error) throw error
      return json({ templates: (data || []).map((item) => ({ id: item.id, name: item.name, subject: item.subject, bodyHtml: item.body_html, updatedAt: item.updated_at })) })
    }
    if (request.method === 'POST') {
      const parsed = templateSchema.safeParse(await bodyJson(request))
      if (!parsed.success) return json({ error: 'Add a template name, subject, and message.' }, 400)
      const { data, error } = await admin.from('templates').upsert({ id: parsed.data.id, user_id: user.id, name: parsed.data.name, subject: parsed.data.subject, body_html: sanitizeMessage(parsed.data.bodyHtml), updated_at: new Date().toISOString() }, { onConflict: 'user_id,name' }).select('id,name,subject,body_html,updated_at').single()
      if (error) throw error
      return json({ template: { id: data.id, name: data.name, subject: data.subject, bodyHtml: data.body_html, updatedAt: data.updated_at } })
    }
    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id) return json({ error: 'Choose a template to delete.' }, 400)
      const { error } = await admin.from('templates').delete().eq('user_id', user.id).eq('id', id)
      if (error) throw error
      return json({ deleted: true })
    }
    return json({ error: 'Use GET, POST, or DELETE.' }, 405)
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: ['GET', 'POST', 'DELETE'] }
