import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { validateContacts, type ContactTable } from '../../src/lib/contacts.ts'
import { personalizeDraft } from '../../src/lib/personalize.ts'
import { authenticate, bodyJson, errorResponse, json, siteUrl } from '../lib/server.mts'
import { htmlToText, sanitizeMessage } from '../lib/sanitize.mts'

const requestSchema = z.object({
  table: z.object({ headers: z.array(z.string().min(1).max(100)).min(1).max(40), rows: z.array(z.object({ values: z.array(z.string().max(20_000)), rowNumber: z.number().int().positive() })).min(1).max(200) }),
  emailHeader: z.string().nullable(), subject: z.string().min(1).max(200), bodyHtml: z.string().min(1).max(100_000),
  attachmentIds: z.array(z.string().uuid()).max(10).default([]), idempotencyKey: z.string().uuid(),
})

async function dispatch(baseUrl: string, batchId: string) {
  const secret = process.env.WORKER_SECRET
  if (!secret) throw new Error('Missing server configuration: WORKER_SECRET.')
  const response = await fetch(`${baseUrl}/.netlify/functions/batch-worker`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-secret': secret }, body: JSON.stringify({ batchId }),
  })
  if (!response.ok && response.status !== 202) throw new Error(`The dispatch endpoint returned ${response.status}.`)
}

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
    const { admin, user } = await authenticate(request)
    const parsed = requestSchema.safeParse(await bodyJson(request))
    if (!parsed.success) return json({ error: 'Check the subject, message, and contact file, then try again.' }, 400)
    const { table, emailHeader, subject, bodyHtml, attachmentIds, idempotencyKey } = parsed.data
    if (/\r|\n/.test(subject)) return json({ error: 'Subject cannot contain line breaks.' }, 400)
    const [{ data: profile, error: profileError }, { data: connection, error: connectionError }] = await Promise.all([
      admin.from('profiles').select('display_name,phone').eq('user_id', user.id).maybeSingle(),
      admin.from('gmail_connections').select('email,reauth_required').eq('user_id', user.id).maybeSingle(),
    ])
    if (profileError) throw profileError
    if (connectionError) throw connectionError
    if (!profile?.display_name || !user.email) return json({ error: 'Save your sender name and email profile first.' }, 400)
    if (!connection) return json({ error: 'Connect Gmail before starting a batch.' }, 400)
    if (connection.reauth_required) return json({ error: 'Reconnect Gmail before starting a batch.' }, 400)
    const contacts = validateContacts(table as ContactTable, emailHeader)
    if (!contacts.some((contact) => contact.status === 'ready')) return json({ error: 'No valid recipient emails were found in this file.' }, 400)
    const safeHtml = sanitizeMessage(bodyHtml)
    const attachmentRows = attachmentIds.length ? await admin.from('attachments').select('id,name,mime_type,size,storage_path,uploaded_at').eq('user_id', user.id).not('uploaded_at', 'is', null).in('id', attachmentIds) : { data: [], error: null }
    if (attachmentRows.error) throw attachmentRows.error
    if ((attachmentRows.data || []).length !== attachmentIds.length) return json({ error: 'One or more attachments are no longer available.' }, 400)
    const attachmentTotal = (attachmentRows.data || []).reduce((total, file) => total + Number(file.size), 0)
    if (attachmentTotal > 10 * 1024 * 1024) return json({ error: 'Attachments must total 10 MB or less.' }, 400)
    if ((attachmentRows.data || []).some((file) => !file.storage_path.startsWith(`${user.id}/`))) return json({ error: 'An attachment is outside your private account storage.' }, 403)
    for (const file of attachmentRows.data || []) {
      const { data: stored, error: storageError } = await admin.storage.from('attachments').download(file.storage_path)
      if (storageError || !stored || stored.size !== Number(file.size)) return json({ error: `Attachment “${file.name}” could not be verified. Upload it again.` }, 400)
    }

    const sender = { name: profile.display_name, email: connection.email, phone: profile.phone || '' }
    const recipients = contacts.map((contact) => {
      if (contact.status === 'skipped') return { ...contact, subject: '', bodyHtml: '', bodyText: '' }
      const personalized = personalizeDraft(subject, safeHtml, contact, sender)
      if (personalized.missing.length) return { ...contact, status: 'skipped', reason: `Missing value for ${personalized.missing.map((name) => `[${name}]`).join(', ')}.`, subject: personalized.subject, bodyHtml: personalized.bodyHtml, bodyText: htmlToText(personalized.bodyHtml) }
      return { ...contact, subject: personalized.subject, bodyHtml: personalized.bodyHtml, bodyText: htmlToText(personalized.bodyHtml) }
    })
    const valid = recipients.filter((recipient) => recipient.status === 'ready')
    if (!valid.length) return json({ error: 'Every row is missing an email or a value used by the message.' }, 400)
    const { data, error } = await admin.rpc('create_email_batch', {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_subject_template: subject,
      p_body_template_html: safeHtml,
      p_sender_name: sender.name,
      p_sender_email: sender.email,
      p_sender_phone: sender.phone,
      p_attachment_ids: attachmentIds,
      p_recipients: recipients,
    })
    if (error) throw new Error(error.message)
    const result = Array.isArray(data) ? data[0] : data as { batch_id: string; existing: boolean; valid_count: number; skipped_count: number }
    if (!result?.batch_id) throw new Error('Could not create the email batch.')
    let dispatched = false
    try { await dispatch(siteUrl(request), result.batch_id); dispatched = true } catch { /* recovery job will pick up the durable queued batch */ }
    return json({ batchId: result.batch_id, existing: Boolean(result.existing), dispatched, validCount: result.valid_count, skippedCount: result.skipped_count })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'POST' }
