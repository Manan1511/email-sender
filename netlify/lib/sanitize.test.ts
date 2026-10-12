import { describe, expect, it } from 'vitest'
import { htmlToText, sanitizeMessage } from './sanitize.mts'

describe('message HTML sanitization', () => {
  it('keeps supported formatting while removing scripts and event handlers', () => {
    const result = sanitizeMessage('<p onclick="steal()">Hello <strong>team</strong><script>alert(1)</script></p>')

    expect(result).toContain('<p>Hello <strong>team</strong></p>')
    expect(result).not.toMatch(/onclick|script|alert/i)
  })

  it('removes unsafe links and adds safe link attributes', () => {
    const result = sanitizeMessage('<a href="javascript:alert(1)" onclick="steal()">unsafe</a><a href="https://example.com">safe</a>')

    expect(result).not.toMatch(/javascript:|onclick/i)
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain('target="_blank"')
  })

  it('converts sanitized rich text to plain text', () => {
    expect(htmlToText('<p>Hello <strong>CSI</strong></p><p>VIT</p>')).toBe('Hello CSI VIT')
  })
})
