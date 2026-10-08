import type { Config } from '@netlify/functions'
import { authenticate, errorResponse, json } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    if (request.method === 'GET') {
      const { data, error } = await admin.from('batches').select('id,status,created_at,completed_at,total_count,success_count,failed_count,needs_review_count,skipped_count,subject_template').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return json({ batches: data || [] })
    }
    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id) return json({ error: 'Choose a batch to delete.' }, 400)
      const { data: batch, error: batchError } = await admin.from('batches').select('id,status').eq('user_id', user.id).eq('id', id).maybeSingle()
      if (batchError) throw batchError
      if (!batch) return json({ deleted: true })
      if (batch.status === 'sending' || batch.status === 'queued') return json({ error: 'Wait for the active batch to stop before deleting it.' }, 409)
      const { error } = await admin.from('batches').delete().eq('user_id', user.id).eq('id', id)
      if (error) throw error
      return json({ deleted: true })
    }
    return json({ error: 'Use GET or DELETE.' }, 405)
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: ['GET', 'DELETE'] }
