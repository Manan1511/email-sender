import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { authenticate, bodyJson, errorResponse, json, siteUrl } from '../lib/server.mts'

const resumeSchema = z.object({ batchId: z.string().uuid() })

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
    const { admin, user } = await authenticate(request)
    const parsed = resumeSchema.safeParse(await bodyJson(request))
    if (!parsed.success) return json({ error: 'Choose a batch to resume.' }, 400)
    const [{ data: connection }, { data: batch, error: batchError }] = await Promise.all([
      admin.from('gmail_connections').select('reauth_required').eq('user_id', user.id).maybeSingle(),
      admin.from('batches').select('id,status').eq('id', parsed.data.batchId).eq('user_id', user.id).maybeSingle(),
    ])
    if (batchError) throw batchError
    if (!batch) return json({ error: 'Batch not found.' }, 404)
    if (!connection || connection.reauth_required) return json({ error: 'Reconnect Gmail before resuming this batch.' }, 400)
    if (batch.status !== 'paused') return json({ error: 'Only paused batches can be resumed.' }, 409)
    const { error } = await admin.from('batches').update({ status: 'queued', error_message: null, updated_at: new Date().toISOString() }).eq('id', batch.id).eq('user_id', user.id).eq('status', 'paused')
    if (error) throw error
    const secret = process.env.WORKER_SECRET
    if (!secret) throw new Error('Missing server configuration: WORKER_SECRET.')
    await fetch(`${siteUrl(request)}/.netlify/functions/batch-worker`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-secret': secret }, body: JSON.stringify({ batchId: batch.id }) })
    return json({ resumed: true })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'POST' }
