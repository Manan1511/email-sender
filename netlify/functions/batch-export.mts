import type { Config } from '@netlify/functions'
import Papa from 'papaparse'
import { authenticate, errorResponse } from '../lib/server.mts'

const safeCell = (value: unknown) => {
  const text = String(value ?? '')
  return /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
}

export default async (request: Request) => {
  try {
    const { admin, user } = await authenticate(request)
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return new Response('Choose a batch.', { status: 400 })
    const { data, error } = await admin.from('batch_recipients').select('company_name,poc_name,email,source_row,status,attempt_count,gmail_message_id,reason').eq('user_id', user.id).eq('batch_id', id).order('source_row')
    if (error) throw error
    const csv = Papa.unparse({
      fields: ['Company Name', 'POC Name', 'Email', 'Source row', 'Status', 'Attempts', 'Gmail message ID', 'Reason'],
      data: (data || []).map((item) => [item.company_name, item.poc_name, item.email, item.source_row, item.status, item.attempt_count, item.gmail_message_id, item.reason].map(safeCell)),
    })
    return new Response(`\uFEFF${csv}`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="email-batch-${id}.csv"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } catch (error) {
    const result = errorResponse(error)
    return new Response(await result.text(), { status: result.status, headers: result.headers })
  }
}

export const config: Config = { method: 'GET' }
