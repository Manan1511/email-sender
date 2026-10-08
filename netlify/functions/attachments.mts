import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { authenticate, bodyJson, errorResponse, json } from '../lib/server.mts'

const attachmentRequest = z.object({ name: z.string().min(1).max(180), mimeType: z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i).max(120), size: z.number().int().positive().max(10 * 1024 * 1024) })

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    if (request.method === 'GET') {
      const { data, error } = await admin.from('attachments').select('id,name,mime_type,size,created_at').eq('user_id', user.id).not('uploaded_at', 'is', null).order('created_at', { ascending: false })
      if (error) throw error
      return json({ attachments: (data || []).map((item) => ({ id: item.id, name: item.name, mimeType: item.mime_type, size: item.size, createdAt: item.created_at })) })
    }
    if (request.method === 'POST') {
      const parsed = attachmentRequest.safeParse(await bodyJson(request))
      if (!parsed.success) return json({ error: 'File must have a name and be under 10 MB.' }, 400)
      const name = parsed.data.name.replace(/[\\/\r\n\0]/g, '_').slice(0, 160)
      const path = `${user.id}/${crypto.randomUUID()}-${name}`
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_attachment', { p_user_id: user.id, p_name: name, p_mime_type: parsed.data.mimeType, p_size: parsed.data.size, p_storage_path: path })
      if (reserveError) throw reserveError
      const reservation = Array.isArray(reserved) ? reserved[0] : reserved as { allowed: boolean; id?: string; reason?: string }
      if (!reservation?.allowed || !reservation.id) return json({ error: reservation?.reason || 'Attachment storage is full.' }, 429)
      const { data: upload, error: uploadError } = await admin.storage.from('attachments').createSignedUploadUrl(path, { upsert: false })
      if (uploadError || !upload) {
        await admin.from('attachments').delete().eq('id', reservation.id).eq('user_id', user.id)
        throw new Error('Could not prepare a private upload for this file.')
      }
      return json({ attachment: { id: reservation.id, name, mimeType: parsed.data.mimeType, size: parsed.data.size, path, token: upload.token, signedUrl: upload.signedUrl } })
    }
    if (request.method === 'PUT') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id) return json({ error: 'Choose a file to finish uploading.' }, 400)
      const { data: item, error: readError } = await admin.from('attachments').select('id,storage_path,uploaded_at').eq('user_id', user.id).eq('id', id).maybeSingle()
      if (readError) throw readError
      if (!item) return json({ error: 'Attachment upload expired. Upload it again.' }, 404)
      if (item.uploaded_at) return json({ uploaded: true })
      const { data: blob, error: downloadError } = await admin.storage.from('attachments').download(item.storage_path)
      if (downloadError || !blob) return json({ error: 'The private upload is incomplete. Try uploading this file again.' }, 400)
      const { data: completed, error: completeError } = await admin.rpc('complete_attachment_upload', { p_user_id: user.id, p_attachment_id: item.id, p_actual_size: blob.size })
      if (completeError) throw completeError
      const result = Array.isArray(completed) ? completed[0] : completed as { allowed: boolean; reason?: string }
      if (!result?.allowed) {
        await admin.storage.from('attachments').remove([item.storage_path])
        await admin.from('attachments').delete().eq('id', item.id).eq('user_id', user.id)
        return json({ error: result?.reason || 'Attachment storage is full.' }, 429)
      }
      return json({ uploaded: true, size: blob.size })
    }
    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id) return json({ error: 'Choose a file to remove.' }, 400)
      const { data: attachment, error } = await admin.from('attachments').select('id,storage_path').eq('user_id', user.id).eq('id', id).maybeSingle()
      if (error) throw error
      if (attachment) {
        const { data: references, error: referencesError } = await admin.from('batches').select('id').eq('user_id', user.id).contains('attachment_ids', [id]).limit(1)
        if (referencesError) throw referencesError
        if (references?.length) return json({ error: 'This file is attached to saved campaign history. Delete that campaign first, or wait until its 30-day retention ends.' }, 409)
        const { error: storageError } = await admin.storage.from('attachments').remove([attachment.storage_path])
        if (storageError) throw storageError
        const { error: deleteError } = await admin.from('attachments').delete().eq('user_id', user.id).eq('id', id)
        if (deleteError) throw deleteError
      }
      return json({ deleted: true })
    }
    return json({ error: 'Use GET, POST, or DELETE.' }, 405)
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: ['GET', 'POST', 'PUT', 'DELETE'] }
