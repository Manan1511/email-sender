import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('sanitizer runtime compatibility', () => {
  it('loads and sanitizes rich text with Lambda-style ESM require restrictions', () => {
    const output = execFileSync(process.execPath, [
      '--no-experimental-require-module',
      '--experimental-strip-types',
      '--input-type=module',
      '--eval', `
        import { sanitizeMessage, htmlToText } from './netlify/lib/sanitize.mts'
        const html = sanitizeMessage('<p onclick="bad()">Hello <strong>team</strong><script>bad()</script></p>')
        process.stdout.write(JSON.stringify({ html, text: htmlToText(html) }))
      `,
    ], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      timeout: 10_000,
    })

    expect(JSON.parse(output)).toEqual({
      html: '<p>Hello <strong>team</strong></p>',
      text: 'Hello team',
    })
  })
})
