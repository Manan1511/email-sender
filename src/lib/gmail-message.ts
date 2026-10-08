import { Buffer } from 'node:buffer'

export type Attachment = { filename: string; mimeType: string; content: Buffer | Uint8Array }
export type GmailMessageInput = {
  fromName: string
  fromEmail: string
  to: string
  subject: string
  html: string
  text: string
  attachments: Attachment[]
}

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const safeHeader = (value: string, field: string) => {
  if (/[\r\n\0-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) throw new Error(`${field} cannot contain control characters.`)
  return value
}
const encodeHeader = (value: string) => /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=` : value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const encodeBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd()

export function buildGmailRawMessage(input: GmailMessageInput): string {
  if (!emailPattern.test(input.fromEmail)) throw new Error('Enter a valid email for the sender.')
  if (!emailPattern.test(input.to)) throw new Error('Choose one recipient with a valid email address.')
  const fromName = encodeHeader(safeHeader(input.fromName, 'Sender name'))
  const subject = encodeHeader(safeHeader(input.subject, 'Subject'))
  const to = safeHeader(input.to, 'Recipient')
  const boundary = `email-sender-${crypto.randomUUID()}`
  const hasAttachments = input.attachments.length > 0
  const lines = [
    `From: ${fromName ? `"${fromName}" ` : ''}<${input.fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/${hasAttachments ? 'mixed' : 'alternative'}; boundary="${boundary}"`,
    '',
  ]
  if (hasAttachments) lines.push(`--${boundary}`, 'Content-Type: multipart/alternative; boundary="alt"', '')
  const innerBoundary = hasAttachments ? 'alt' : boundary
  lines.push(`--${innerBoundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', encodeBase64(Buffer.from(input.text, 'utf8')))
  lines.push(`--${innerBoundary}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', encodeBase64(Buffer.from(input.html, 'utf8')), `--${innerBoundary}--`)
  if (hasAttachments) {
    for (const attachment of input.attachments) {
      const filename = safeHeader(attachment.filename, 'Attachment filename')
      const mimeType = safeHeader(attachment.mimeType, 'Attachment type')
      lines.push(`--${boundary}`, `Content-Type: ${mimeType}; name*=UTF-8''${encodeURIComponent(filename)}`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, '', encodeBase64(attachment.content))
    }
    lines.push(`--${boundary}--`)
  }
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
}

export function decodeGmailRawMessage(raw: string) {
  return Buffer.from(raw, 'base64url').toString('utf8')
}
