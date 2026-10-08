import Papa from 'papaparse'

export type ContactTable = { headers: string[]; rows: Array<{ values: string[]; rowNumber: number }> }
export type Contact = {
  rowNumber: number
  companyName: string
  pocName: string
  email: string
  designation: string
  fields: Record<string, string>
  status: 'ready' | 'skipped'
  reason?: string
}

export function normalizeHeader(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseCsv(source: string): ContactTable {
  const parsed = Papa.parse<string[]>(source.replace(/^\uFEFF/, ''), { skipEmptyLines: false, dynamicTyping: false })
  if (parsed.errors.length) throw new Error(`Could not read CSV: ${parsed.errors[0].message}`)
  const matrix = parsed.data
  while (matrix.length && matrix[matrix.length - 1].every((cell) => !String(cell ?? '').trim())) matrix.pop()
  if (matrix.length < 2) throw new Error('The file needs a header row and at least one contact.')
  const headers = matrix[0].map((cell) => String(cell ?? '').trim())
  if (headers.some((header) => !header)) throw new Error('Every column needs a name in the header row.')
  const seen = new Set<string>()
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (seen.has(normalized)) throw new Error(`Duplicate header after normalization: ${header}`)
    seen.add(normalized)
  }
  return {
    headers,
    rows: matrix.slice(1).map((cells, index) => ({
      values: headers.map((_, cellIndex) => String(cells[cellIndex] ?? '').trim()),
      rowNumber: index + 2,
    })),
  }
}

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

export function tableFromMatrix(matrix: unknown[][]): ContactTable {
  const normalized = matrix.map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '').trim()))
  while (normalized.length && normalized[normalized.length - 1].every((cell) => !cell)) normalized.pop()
  if (normalized.length < 2) throw new Error('The worksheet needs a header row and at least one contact.')
  const width = Math.max(...normalized.map((row) => row.length))
  const headers = Array.from({ length: width }, (_, index) => normalized[0][index] ?? '')
  if (headers.some((header) => !header)) throw new Error('Every column needs a name in the header row.')
  const seen = new Set<string>()
  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header)
    if (seen.has(normalizedHeader)) throw new Error(`Duplicate header after normalization: ${header}`)
    seen.add(normalizedHeader)
  }
  return { headers, rows: normalized.slice(1).map((row, index) => ({ values: headers.map((_, cellIndex) => row[cellIndex] ?? ''), rowNumber: index + 2 })) }
}

export function validateContacts(table: ContactTable, emailHeader: string | null): Contact[] {
  const nonblank = table.rows.filter(({ values }) => values.some((value) => value.trim()))
  if (nonblank.length > 100) throw new Error('Upload is limited to 100 contacts per batch.')
  const indexByHeader = new Map(table.headers.map((header, index) => [normalizeHeader(header), index]))
  const emailIndex = emailHeader === null ? undefined : indexByHeader.get(normalizeHeader(emailHeader))
  const autoEmailIndex = table.headers.findIndex((header) => ['email', 'emailid', 'emailaddress', 'recipientemail'].includes(normalizeHeader(header)))
  const targetIndex = emailHeader === null ? autoEmailIndex : emailIndex
  const companyIndex = indexByHeader.get('companyname')
  const pocIndex = indexByHeader.get('pocname')
  const designationIndex = indexByHeader.get('designation')
  const claimed = new Set<string>()
  return nonblank.map(({ values, rowNumber }) => {
    const email = targetIndex === undefined || targetIndex < 0 ? '' : (values[targetIndex] ?? '').trim()
    const fields = Object.fromEntries(table.headers.map((header, index) => [header, values[index] ?? '']))
    let reason: string | undefined
    if (targetIndex === undefined || targetIndex < 0) reason = 'Choose an email column before reviewing this contact.'
    else if (!emailPattern.test(email)) reason = 'Enter one valid email address.'
    else if (claimed.has(email.toLocaleLowerCase())) reason = 'duplicate email address; first occurrence is kept.'
    else claimed.add(email.toLocaleLowerCase())
    return {
      rowNumber,
      companyName: companyIndex === undefined ? '' : values[companyIndex] ?? '',
      pocName: pocIndex === undefined ? '' : values[pocIndex] ?? '',
      email,
      designation: designationIndex === undefined ? '' : values[designationIndex] ?? '',
      fields,
      status: reason ? 'skipped' as const : 'ready' as const,
      ...(reason ? { reason } : {}),
    }
  })
}
