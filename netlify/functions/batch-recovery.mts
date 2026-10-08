import type { Config } from '@netlify/functions'
import { adminClient } from '../lib/server.mts'

export default async () => {
  const secret = process.env.WORKER_SECRET
  const url = process.env.URL || process.env.DEPLOY_PRIME_URL
  if (!secret || !url) return
  const admin = adminClient()
  const now = new Date().toISOString()
  const [queued, expired] = await Promise.all([
    admin.from('batches').select('id').eq('status', 'queued').limit(20),
    admin.from('batches').select('id').eq('status', 'sending').lte('lease_expires_at', now).limit(20),
  ])
  if (queued.error || expired.error) throw new Error('Could not read the recovery queue.')
  const ids = [...new Set([...(queued.data || []), ...(expired.data || [])].map((batch) => batch.id))]
  await Promise.all(ids.map((batchId) => fetch(`${url}/.netlify/functions/batch-worker`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-secret': secret }, body: JSON.stringify({ batchId }),
  })))
}

export const config: Config = { schedule: '*/5 * * * *' }
