import type { Config } from '@netlify/functions'
import { Buffer } from 'node:buffer'
import { buildGmailRawMessage, type Attachment } from '../../src/lib/gmail-message.ts'
import { adminClient, bodyJson } from '../lib/server.mts'
import { accessToken, errorPayload, sendGmail, sleep } from '../lib/gmail.mts'
import { dispatchWithRefresh } from '../lib/gmail-dispatch.mts'
import { safeWorkerSecret } from '../lib/worker-auth.mts'

type JobBody = { batchId?: string }
type Recipient = {
  id: string; batch_id: string; user_id: string; email: string; subject: string; body_html: string; body_text: string; status: string; attempt_count: number
  sender_name: string; sender_email: string; attachment_ids: string[]
}

async function writeAttempt(admin: ReturnType<typeof adminClient>, attemptId: string, state: string, values: Record<string, unknown> = {}) {
  const { error } = await admin.from('send_attempts').update({ state, ...values, finished_at: new Date().toISOString() }).eq('id', attemptId)
  if (error) throw error
}

async function recipientState(admin: ReturnType<typeof adminClient>, item: Recipient, status: string, reason: string | null, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from('batch_recipients').update({ status, reason, updated_at: new Date().toISOString(), ...extra }).eq('id', item.id).eq('user_id', item.user_id)
  if (error) throw error
}

async function reserveAttempt(admin: ReturnType<typeof adminClient>, item: Recipient, kind: 'batch' | 'retry') {
  const { data, error } = await admin.rpc('reserve_send_attempt', { p_user_id: item.user_id, p_batch_id: item.batch_id, p_recipient_id: item.id, p_kind: kind })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data as { allowed: boolean; attempt_id?: string; reason?: string }
  return result
}

async function attachmentsFor(admin: ReturnType<typeof adminClient>, item: Recipient, cache: Map<string, Attachment[]>) {
  if (cache.has(item.batch_id)) return cache.get(item.batch_id)!
  if (!item.attachment_ids?.length) { cache.set(item.batch_id, []); return [] }
  const { data: files, error } = await admin.from('attachments').select('id,name,mime_type,storage_path').eq('user_id', item.user_id).in('id', item.attachment_ids)
  if (error || (files || []).length !== item.attachment_ids.length) throw new Error('A batch attachment could not be loaded.')
  const attachments: Attachment[] = []
  for (const file of files || []) {
    const { data, error: downloadError } = await admin.storage.from('attachments').download(file.storage_path)
    if (downloadError || !data) throw new Error('A batch attachment could not be downloaded.')
    attachments.push({ filename: file.name, mimeType: file.mime_type, content: Buffer.from(await data.arrayBuffer()) })
  }
  cache.set(item.batch_id, attachments)
  return attachments
}

export default async (request: Request) => {
  if (!safeWorkerSecret(request)) return
  let batchId = ''
  try { batchId = (await bodyJson<JobBody>(request)).batchId || '' } catch { return }
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return
  const admin = adminClient()
  const workerId = crypto.randomUUID()
  const { data: claimData, error: claimError } = await admin.rpc('claim_email_batch', { p_batch_id: batchId, p_worker_id: workerId })
  if (claimError) throw claimError
  const claim = Array.isArray(claimData) ? claimData[0] : claimData as { claimed?: boolean; user_id?: string }
  if (!claim?.claimed || !claim.user_id) return
  let token: string
  try { token = await accessToken(admin, claim.user_id) } catch (error) {
    await admin.from('batches').update({ status: 'paused', error_message: error instanceof Error ? error.message : 'Reconnect Gmail to continue.', worker_lease_id: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId)
    return
  }
  const attachmentCache = new Map<string, Attachment[]>()
  let lastDispatch = 0
  for (;;) {
    const { data, error } = await admin.rpc('claim_next_batch_recipient', { p_batch_id: batchId, p_worker_id: workerId })
    if (error) throw error
    const item = (Array.isArray(data) ? data[0] : data) as Recipient | null
    if (!item) break
    let attachments: Attachment[]
    try { attachments = await attachmentsFor(admin, item, attachmentCache) } catch (error) {
      await recipientState(admin, item, 'failed', error instanceof Error ? error.message : 'Could not load attachment.')
      continue
    }
    const raw = buildGmailRawMessage({ fromName: item.sender_name, fromEmail: item.sender_email, to: item.email, subject: item.subject, html: item.body_html, text: item.body_text, attachments })
    let delivered = false
    for (let attemptNumber = 0; attemptNumber < 3 && !delivered; attemptNumber++) {
      const reserve = await reserveAttempt(admin, item, item.attempt_count ? 'retry' : 'batch')
      if (!reserve?.allowed || !reserve.attempt_id) {
        await recipientState(admin, item, 'queued', reserve?.reason || 'Send limit reached.')
        await admin.from('batches').update({ status: 'paused', error_message: reserve?.reason || 'Send limit reached.', worker_lease_id: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId)
        return
      }
      const wait = 2_000 - (Date.now() - lastDispatch)
      if (wait > 0) await sleep(wait)
      const dispatch = await dispatchWithRefresh(token, (access) => sendGmail(access, raw), () => accessToken(admin, item.user_id, true))
      lastDispatch = Date.now()
      if (dispatch.kind === 'refresh_failed') {
        const detail = dispatch.error instanceof Error ? dispatch.error.message : 'Gmail authorization could not be refreshed.'
        await writeAttempt(admin, reserve.attempt_id, 'rejected', { error_message: detail, http_status: 401 })
        await recipientState(admin, item, 'queued', 'Reconnect Gmail to continue.')
        await admin.from('batches').update({ status: 'paused', error_message: 'Gmail rejected the expired access token. Reconnect Gmail to continue.', worker_lease_id: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId)
        return
      }
      if (dispatch.kind === 'ambiguous') {
        const message = dispatch.error instanceof Error ? dispatch.error.message : 'The send result is uncertain.'
        await writeAttempt(admin, reserve.attempt_id, 'needs_review', { error_message: message })
        await recipientState(admin, item, 'needs_review', 'Gmail may have accepted this message. Check Sent before resending.')
        delivered = true
        continue
      }

      token = dispatch.accessToken
      const response = dispatch.response
      if (response.ok) {
        const result = await response.json() as { id?: string }
        await writeAttempt(admin, reserve.attempt_id, 'accepted', { gmail_message_id: result.id || null, http_status: response.status })
        await recipientState(admin, item, 'sent', null, { gmail_message_id: result.id || null })
        delivered = true
        continue
      }
      const failure = await errorPayload(response)
      await writeAttempt(admin, reserve.attempt_id, 'rejected', { error_message: failure.message, http_status: response.status })
      if (response.status === 401) {
        await admin.from('gmail_connections').update({ reauth_required: true, updated_at: new Date().toISOString() }).eq('user_id', item.user_id)
        await recipientState(admin, item, 'queued', 'Reconnect Gmail to continue.')
        await admin.from('batches').update({ status: 'paused', error_message: 'Gmail authorization expired. Reconnect Gmail to continue.', worker_lease_id: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId)
        return
      }
      if (['dailyLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(failure.reason)) {
        await recipientState(admin, item, 'queued', 'Gmail quota paused this batch.')
        await admin.from('batches').update({ status: 'paused', error_message: 'Gmail quota paused this batch. Resume after the limit resets.', worker_lease_id: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId)
        return
      }
      if ((response.status === 429 || response.status >= 500) && attemptNumber < 2) {
        await sleep(2_000 * (2 ** attemptNumber))
        continue
      }
      await recipientState(admin, item, 'failed', failure.message)
      delivered = true
    }
  }
  await admin.rpc('finish_email_batch', { p_batch_id: batchId, p_worker_id: workerId })
}

export const config: Config = { background: true, method: 'POST' }
