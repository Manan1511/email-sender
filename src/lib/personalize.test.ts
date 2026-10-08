import { describe, expect, it } from 'vitest'
import { extractPlaceholders, personalizeDraft } from './personalize'

const sender = { name: 'Manan Shah', email: 'manan@example.com', phone: '+91 98765 43210' }
const contact = {
  rowNumber: 2,
  companyName: 'Acme Labs',
  pocName: 'Asha',
  email: 'asha@acme.test',
  designation: 'Founder',
  fields: { 'POC Name': 'Asha', Designation: 'Founder', 'Your Name': 'Sheet value', Notes: '' },
  status: 'ready' as const,
}

describe('draft personalization', () => {
  it('replaces sender placeholders from profile and all remaining names from each contact', () => {
    const result = personalizeDraft(
      '[Company Name] × ForkThis — hello [POC Name]',
      '<p>Dear <strong>[POC Name]</strong>,</p><p>[Your Name] · [Your Email] · [Your Phone Number] · [Designation]</p>',
      contact,
      sender,
    )

    expect(result.subject).toBe('Acme Labs × ForkThis — hello Asha')
    expect(result.bodyHtml).toContain('<strong>Asha</strong>')
    expect(result.bodyHtml).toContain('Manan Shah · manan@example.com · +91 98765 43210 · Founder')
    expect(result.missing).toEqual([])
  })

  it('escapes substituted contact content and collects each unresolved placeholder once', () => {
    const malicious = { ...contact, pocName: '<img src=x onerror=alert(1)>', fields: { 'POC Name': '<img src=x onerror=alert(1)>' } }
    const result = personalizeDraft('[Missing] / [missing]', '<p>[POC Name] [Unmapped]</p>', malicious, sender)

    expect(result.bodyHtml).not.toContain('<img')
    expect(result.bodyHtml).toContain('&lt;img')
    expect(result.missing).toEqual(['Missing', 'Unmapped'])
  })

  it('normalizes placeholder names without treating blank spreadsheet values as filled', () => {
    const names = extractPlaceholders('Hello [PÓC Name], [poc-name], [Your Phone Number]')

    expect(names).toEqual(['PÓC Name', 'Your Phone Number'])
    expect(personalizeDraft('Hi [Notes]', '<p>Hi [Notes]</p>', contact, sender).missing).toEqual(['Notes'])
  })
})
