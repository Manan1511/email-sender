import type { Config } from '@netlify/functions'
import { adminClient } from '../lib/server.mts'

export default async () => {
  const admin = adminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const { error: batchError } = await admin.from('batches').delete().lt('created_at', cutoff)
  if (batchError) throw new Error('Could not delete expired batch history.')
  const { data: recentBatches, error: batchReadError } = await admin.from('batches').select('attachment_ids').gte('created_at', cutoff)
  if (batchReadError) throw new Error('Could not check attachment retention.')
  const inUse = new Set((recentBatches || []).flatMap((item) => item.attachment_ids || []))
  const [oldUploaded, staleReservations] = await Promise.all([
    admin.from('attachments').select('id,storage_path,uploaded_at').not('uploaded_at', 'is', null).lt('created_at', cutoff).limit(1000),
    admin.from('attachments').select('id,storage_path,uploaded_at').is('uploaded_at', null).lt('created_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString()).limit(1000),
  ])
  const attachmentReadError = oldUploaded.error || staleReservations.error
  const oldAttachments = [...(oldUploaded.data || []), ...(staleReservations.data || [])].filter((item) => !inUse.has(item.id))
  if (attachmentReadError) throw new Error('Could not locate expired attachments.')
  const paths = oldAttachments.filter((file) => file.uploaded_at).map((file) => file.storage_path)
  if (paths.length) {
    const { error: storageError } = await admin.storage.from('attachments').remove(paths)
    if (storageError) throw new Error('Could not delete expired attachment files.')
  }
  if (oldAttachments.length) {
    const { error: metadataError } = await admin.from('attachments').delete().in('id', oldAttachments.map((file) => file.id))
    if (metadataError) throw new Error('Could not delete expired attachment records.')
  }
  const startOfCurrentMonth = new Date()
  startOfCurrentMonth.setUTCDate(1); startOfCurrentMonth.setUTCHours(0, 0, 0, 0)
  const { error: attemptsError } = await admin.from('send_attempts').delete().lt('created_at', cutoff).lt('created_at', startOfCurrentMonth.toISOString())
  if (attemptsError) throw new Error('Could not delete expired test-send records.')
}

export const config: Config = { schedule: '0 3 * * *' }
