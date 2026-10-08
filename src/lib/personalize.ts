import type { Contact } from './contacts'

export type SenderProfile = { name: string; email: string; phone: string }
export type PersonalizedDraft = { subject: string; bodyHtml: string; missing: string[] }

export function extractPlaceholders(...values: string[]) {
  const names: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    for (const match of value.matchAll(/\[([^\][\r\n]{1,100})\]/g)) {
      const name = match[1].trim()
      const key = normalize(name)
      if (name && !seen.has(key)) {
        seen.add(key)
        names.push(name)
      }
    }
  }
  return names
}

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function personalizeDraft(subject: string, bodyHtml: string, contact: Contact, sender: SenderProfile): PersonalizedDraft {
  const byName = new Map<string, string>()
  Object.entries(contact.fields).forEach(([key, value]) => byName.set(normalize(key), value))
  byName.set(normalize('Company Name'), contact.companyName)
  byName.set(normalize('POC Name'), contact.pocName)
  byName.set(normalize('Email ID'), contact.email)
  byName.set(normalize('Designation'), contact.designation)
  const senderValues: Record<string, string> = {
    'Your Name': sender.name,
    'Your Email': sender.email,
    'Your Phone Number': sender.phone,
  }
  Object.entries(senderValues).forEach(([key, value]) => byName.set(normalize(key), value))
  const missing: string[] = []
  const missingSeen = new Set<string>()
  const replace = (text: string, html: boolean) => text.replace(/\[([^\][\r\n]{1,100})\]/g, (token, rawName: string) => {
    const name = rawName.trim()
    const key = normalize(name)
    const value = byName.get(key)?.trim()
    if (!value) {
      if (!missingSeen.has(key)) { missingSeen.add(key); missing.push(name) }
      return token
    }
    return html ? escapeHtml(value) : value
  })
  return { subject: replace(subject, false), bodyHtml: replace(bodyHtml, true), missing }
}
