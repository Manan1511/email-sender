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
  warning?: string
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

// These spelling suggestions are advisory; they do not verify domain or mailbox existence.
const emailProviders = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'aol.com', 'aim.com', 'mail.com', 'email.com', 'gmx.com', 'gmx.net', 'zoho.com']

function spellingDistance(left: string, right: string) {
  const distances = Array.from({ length: left.length + 1 }, (_, row) => Array.from({ length: right.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0))
  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      distances[row][column] = Math.min(distances[row - 1][column] + 1, distances[row][column - 1] + 1, distances[row - 1][column - 1] + Number(left[row - 1] !== right[column - 1]))
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1)
      }
    }
  }
  return distances[left.length][right.length]
}

export function emailDomainWarning(email: string): string | undefined {
  if (!emailPattern.test(email)) return undefined
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  if (emailProviders.includes(domain)) return undefined
  const candidates = emailProviders.filter((provider) => Math.abs(domain.length - provider.length) <= 2)
    .map((provider) => ({ provider, distance: spellingDistance(domain, provider) }))
    .filter(({ provider, distance }) => distance === 1 || (distance === 2 && provider.split('.')[0].length >= 5 && domain.slice(0, 2) === provider.slice(0, 2) && domain.slice(domain.lastIndexOf('.')) === provider.slice(provider.lastIndexOf('.'))))
    .sort((a, b) => a.distance - b.distance)
  const closest = candidates[0]
  if (!closest || candidates[1]?.distance === closest.distance) return undefined
  return `Possible email typo: ${domain} resembles ${closest.provider}. Check the address before sending.`
}

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
    else if (!emailPattern.test(email)) reason = 'Enter one email address in the correct format.'
    else if (claimed.has(email.toLocaleLowerCase())) reason = 'duplicate email address; first occurrence is kept.'
    else claimed.add(email.toLocaleLowerCase())
    const warning = reason ? undefined : emailDomainWarning(email)
    return {
      rowNumber,
      companyName: companyIndex === undefined ? '' : values[companyIndex] ?? '',
      pocName: pocIndex === undefined ? '' : values[pocIndex] ?? '',
      email,
      designation: designationIndex === undefined ? '' : values[designationIndex] ?? '',
      fields,
      status: reason ? 'skipped' as const : 'ready' as const,
      ...(reason ? { reason } : {}),
      ...(warning ? { warning } : {}),
    }
  })
}
