import type { Config } from '@netlify/functions'
import { authenticate, errorResponse, json, requireMethod } from '../lib/server.mts'

export default async (request: Request) => {
  try {
    requireMethod(request, 'DELETE')
    const { admin, user } = await authenticate(request)
    const files: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from('attachments').list(user.id, { limit: 1000, offset })
      if (error) throw new Error('Could not remove private attachments.')
      files.push(...(data || []).map((file) => `${user.id}/${file.name}`))
      if (!data || data.length < 1000) break
    }
    for (let index = 0; index < files.length; index += 100) {
      const { error } = await admin.storage.from('attachments').remove(files.slice(index, index + 100))
      if (error) throw new Error('Could not remove private attachments.')
    }
    const { error } = await admin.auth.admin.deleteUser(user.id, true)
    if (error) throw new Error('Could not delete this account. Try again or contact the workspace owner.')
    return json({ deleted: true })
  } catch (error) { return errorResponse(error) }
}

export const config: Config = { method: 'DELETE' }
