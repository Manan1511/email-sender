import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { authenticate, bodyJson, errorResponse, json, siteUrl } from '../lib/server.mts'

const retrySchema = z.object({ batchId: z.string().uuid(), recipientIds: z.array(z.string().uuid()).min(1).max(100), acknowledgeDuplicateRisk: z.boolean().default(false) })

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
    const { admin, user } = await authenticate(request)
    const parsed = retrySchema.safeParse(await bodyJson(request))
    if (!parsed.success) return json({ error: 'Choose confirmed failures to retry.' }, 400)
    const { data, error } = await admin.rpc('retry_email_recipients', {
      p_user_id: user.id, p_batch_id: parsed.data.batchId, p_recipient_ids: parsed.data.recipientIds,
      p_acknowledge_duplicate_risk: parsed.data.acknowledgeDuplicateRisk,
    })
    if (error) throw new Error(error.message)
    const result = Array.isArray(data) ? data[0] : data as { queued_count?: number; error_message?: string }
    if (!result?.queued_count) return json({ error: result?.error_message || 'There are no confirmed failed recipients to retry.' }, 400)
    const secret = process.env.WORKER_SECRET
    if (!secret) throw new Error('Missing server configuration: WORKER_SECRET.')
    await fetch(`${siteUrl(request)}/.netlify/functions/batch-worker`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-secret': secret }, body: JSON.stringify({ batchId: parsed.data.batchId }) })
    return json({ queuedCount: result.queued_count })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'POST' }
