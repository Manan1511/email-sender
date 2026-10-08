import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { buildGmailRawMessage, type Attachment } from '../../src/lib/gmail-message.ts'
import { authenticate, bodyJson, errorResponse, json } from '../lib/server.mts'
import { sanitizeMessage, htmlToText } from '../lib/sanitize.mts'
import { accessToken, sendGmail, errorPayload } from '../lib/gmail.mts'

const testSchema = z.object({ subject: z.string().min(1).max(200), bodyHtml: z.string().min(1).max(100_000), attachmentIds: z.array(z.string().uuid()).max(10).default([]) })

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
    const { admin, user } = await authenticate(request)
    const parsed = testSchema.safeParse(await bodyJson(request))
    if (!parsed.success) return json({ error: 'Add a subject and message before sending a test.' }, 400)
    if (/\r|\n/.test(parsed.data.subject)) return json({ error: 'Subject cannot contain line breaks.' }, 400)
    const [{ data: profile, error: profileError }, { data: connection, error: connectionError }] = await Promise.all([
      admin.from('profiles').select('display_name,phone').eq('user_id', user.id).maybeSingle(),
      admin.from('gmail_connections').select('email,reauth_required').eq('user_id', user.id).maybeSingle(),
    ])
    if (profileError) throw profileError
    if (connectionError) throw connectionError
    if (!profile?.display_name || !connection) return json({ error: 'Save your sender profile and connect Gmail first.' }, 400)
    if (connection.reauth_required) return json({ error: 'Reconnect Gmail before sending a test.' }, 400)
    const { data: rows, error: fileError } = parsed.data.attachmentIds.length ? await admin.from('attachments').select('id,name,mime_type,size,storage_path,uploaded_at').eq('user_id', user.id).not('uploaded_at', 'is', null).in('id', parsed.data.attachmentIds) : { data: [], error: null }
    if (fileError) throw fileError
    if ((rows || []).length !== parsed.data.attachmentIds.length) return json({ error: 'One or more attachments are no longer available.' }, 400)
    if ((rows || []).reduce((total, file) => total + Number(file.size), 0) > 10 * 1024 * 1024) return json({ error: 'Attachments must total 10 MB or less.' }, 400)
    const attachments: Attachment[] = []
    for (const file of rows || []) {
      const { data, error } = await admin.storage.from('attachments').download(file.storage_path)
      if (error || !data || data.size !== Number(file.size)) throw new Error('A test email attachment could not be downloaded or verified.')
      attachments.push({ filename: file.name, mimeType: file.mime_type, content: Buffer.from(await data.arrayBuffer()) })
    }
    const html = sanitizeMessage(parsed.data.bodyHtml)
    const raw = buildGmailRawMessage({ fromName: profile.display_name, fromEmail: connection.email, to: connection.email, subject: parsed.data.subject, html, text: htmlToText(html), attachments })
    const access = await accessToken(admin, user.id)
    const { data: reserved, error: reserveError } = await admin.rpc('reserve_send_attempt', { p_user_id: user.id, p_batch_id: null, p_recipient_id: null, p_kind: 'test' })
    if (reserveError) throw reserveError
    const reserve = Array.isArray(reserved) ? reserved[0] : reserved as { allowed: boolean; attempt_id?: string; reason?: string }
    if (!reserve?.allowed || !reserve.attempt_id) return json({ error: reserve?.reason || 'Send limit reached.' }, 429)
    let response: Response
    try {
      response = await sendGmail(access, raw)
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'The test send result is uncertain.'
      await admin.from('send_attempts').update({ state: 'needs_review', error_message: message.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', reserve.attempt_id)
      return json({ error: 'The send result is uncertain. Check your Sent folder before trying again.' }, 409)
    }
    if (response.ok) {
      const message = await response.json().catch(() => ({})) as { id?: string }
      await admin.from('send_attempts').update({ state: 'accepted', gmail_message_id: message.id || null, http_status: response.status, finished_at: new Date().toISOString() }).eq('id', reserve.attempt_id)
      return json({ sent: true, messageId: message.id })
    }
    const failure = await errorPayload(response)
    await admin.from('send_attempts').update({ state: 'rejected', error_message: failure.message, http_status: response.status, finished_at: new Date().toISOString() }).eq('id', reserve.attempt_id)
    if (response.status === 401) await admin.from('gmail_connections').update({ reauth_required: true, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    return json({ error: failure.message, reconnectRequired: response.status === 401 }, response.status === 429 ? 429 : 400)
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'POST' }
