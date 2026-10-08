import { describe, expect, it } from 'vitest'
import { normalizeHeader, parseCsv, tableFromMatrix, validateContacts } from './contacts'

describe('contact imports', () => {
  it('keeps quoted fields intact and maps the supplied template headers', () => {
    const table = parseCsv(
      '\uFEFFCompany Name,POC Name,Email ID,Designation,Notes\r\n"Smith, Patel & Co.",Asha,asha@example.com,Founder,"asked for a demo"\r\n',
    )

    const rows = validateContacts(table, 'Email ID')

    expect(table.headers).toEqual(['Company Name', 'POC Name', 'Email ID', 'Designation', 'Notes'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      companyName: 'Smith, Patel & Co.',
      pocName: 'Asha',
      email: 'asha@example.com',
      designation: 'Founder',
      fields: { Notes: 'asked for a demo' },
      status: 'ready',
    })
  })

  it('skips blank rows, invalid addresses, and repeated valid recipients with reasons', () => {
    const table = parseCsv(
      'Company Name,POC Name,Email ID\nExample,Ada,ada@example.com\n,,\nBad Row,Bob,not-an-email\nDuplicate,Ada,ADA@example.com\n',
    )

    expect(validateContacts(table, 'Email ID')).toMatchObject([
      { status: 'ready', email: 'ada@example.com' },
      { status: 'skipped', email: 'not-an-email', reason: expect.stringContaining('valid') },
      { status: 'skipped', email: 'ADA@example.com', reason: expect.stringContaining('duplicate') },
    ])
  })

  it('normalizes headers and rejects ambiguous duplicates', () => {
    expect(normalizeHeader(' PÓC-Name ')).toBe('pocname')
    expect(() => parseCsv('Email ID,email-id\na@example.com,b@example.com')).toThrow(/duplicate header/i)
  })

  it('requires an explicit email column when no recipient field is identifiable', () => {
    const table = parseCsv('Organization,Representative,Work contact\nExample,Ada,ada@example.com')

    expect(table.headers).toContain('Work contact')
    expect(validateContacts(table, null)[0]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('email column') })
    expect(validateContacts(table, 'Work contact')[0]).toMatchObject({ status: 'ready', email: 'ada@example.com' })
  })

  it('does not silently substitute another email-like column after an explicit mapping', () => {
    const table = parseCsv('Primary Email,Backup Email\na@example.com,b@example.com')
    expect(validateContacts(table, 'Missing Column')[0]).toMatchObject({ status: 'skipped', email: '', reason: expect.stringContaining('email column') })
    expect(validateContacts(table, 'Primary Email')[0]).toMatchObject({ status: 'ready', email: 'a@example.com' })
  })

  it('rejects more than 100 nonblank contacts without truncating them', () => {
    const table = parseCsv(`Company,Email\n${Array.from({ length: 101 }, (_, index) => `Company ${index},c${index}@example.com`).join('\n')}`)

    expect(() => validateContacts(table, 'Email')).toThrow(/100 contacts/i)
  })

  it('keeps Excel sheet rows, dates, and blank rows in source-row order', () => {
    const table = tableFromMatrix([
      ['Company Name', 'POC Name', 'Email ID', 'Added'],
      ['Acme', 'Asha', 'asha@example.com', new Date('2026-01-02T00:00:00.000Z')],
      ['', '', '', ''],
    ])
    expect(table.rows[0]).toMatchObject({ rowNumber: 2, values: ['Acme', 'Asha', 'asha@example.com', '2026-01-02'] })
    expect(validateContacts(table, 'Email ID')).toHaveLength(1)
  })
})
