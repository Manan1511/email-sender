import { describe, expect, it } from 'vitest'
import { buildGmailRawMessage, decodeGmailRawMessage } from './gmail-message'

describe('Gmail message encoding', () => {
  it('creates one MIME message for exactly one recipient and connected Gmail identity', () => {
    const raw = buildGmailRawMessage({
      fromName: 'Manan Shah',
      fromEmail: 'manan@gmail.com',
      to: 'poc@example.com',
      subject: 'Acme × ForkThis — sponsorship',
      html: '<p>Dear Asha</p>',
      text: 'Dear Asha',
      attachments: [],
    })
    const decoded = decodeGmailRawMessage(raw)

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decoded).toContain('To: poc@example.com')
    expect(decoded).toContain('From:')
    expect(decoded).toContain('manan@gmail.com')
    expect(decoded).toContain('Content-Type: multipart/alternative')
    expect(decoded).toContain(Buffer.from('Dear Asha').toString('base64'))
    expect(decoded).not.toContain('Bcc:')
  })

  it('includes safe base64 attachments and rejects newline attempts in MIME headers', () => {
    const input = {
      fromName: 'Manan Shah',
      fromEmail: 'manan@gmail.com',
      to: 'poc@example.com',
      subject: 'Hello',
      html: '<p>Brochure</p>',
      text: 'Brochure',
      attachments: [{ filename: 'Event brochure.pdf', mimeType: 'application/pdf', content: Buffer.from('PDF DATA') }],
    }
    const decoded = decodeGmailRawMessage(buildGmailRawMessage(input))

    expect(decoded).toContain('filename*=UTF-8\'\'Event%20brochure.pdf')
    expect(decoded).toContain('Content-Type: application/pdf')
    expect(decoded).toContain(Buffer.from('PDF DATA').toString('base64'))
    expect(() => buildGmailRawMessage({ ...input, fromName: 'Manan\r\nBcc: attacker@example.com' })).toThrow(/control characters/i)
    expect(() => buildGmailRawMessage({ ...input, subject: 'Hello\r\nBcc: attacker@example.com' })).toThrow(/control characters/i)
  })

  it('rejects invalid sender and recipient addresses before building a message', () => {
    const input = { fromName: 'Sender', fromEmail: 'bad\nfrom@example.com', to: 'poc@example.com', subject: 'Hi', html: '', text: '', attachments: [] }

    expect(() => buildGmailRawMessage(input)).toThrow(/valid email/i)
    expect(() => buildGmailRawMessage({ ...input, fromEmail: 'sender@gmail.com', to: 'poc@example.com,other@example.com' })).toThrow(/one recipient/i)
  })
})
