import type { Config } from '@netlify/functions'
import { authenticate, errorResponse, json } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Choose a batch.' }, 400)
    const [{ data: batch, error }, { data: recipients, error: recipientsError }] = await Promise.all([
      admin.from('batches').select('id,status,created_at,completed_at,total_count,success_count,failed_count,needs_review_count,skipped_count,subject_template,error_message').eq('user_id', user.id).eq('id', id).maybeSingle(),
      admin.from('batch_recipients').select('id,company_name,poc_name,email,source_row,status,reason,attempt_count,gmail_message_id,updated_at').eq('user_id', user.id).eq('batch_id', id).order('source_row'),
    ])
    if (error) throw error
    if (recipientsError) throw recipientsError
    if (!batch) return json({ error: 'Batch not found.' }, 404)
    return json({ batch, recipients: recipients || [] })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'GET' }
