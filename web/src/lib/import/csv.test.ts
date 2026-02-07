import { describe, expect, it } from 'vitest'

import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses a simple header + row', () => {
    const parsed = parseCsv('a,b\n1,2\n')
    expect(parsed.header).toEqual(['a', 'b'])
    expect(parsed.rows).toEqual([['1', '2']])
  })

  it('parses quoted cells with commas and escaped quotes', () => {
    const parsed = parseCsv('a,b\n"hello, world","he said ""hi"""\n')
    expect(parsed.rows).toEqual([['hello, world', 'he said "hi"']])
  })

  it('parses newlines inside quoted fields', () => {
    const parsed = parseCsv('a,b\n"line1\nline2",x\n')
    expect(parsed.rows).toEqual([['line1\nline2', 'x']])
  })

  it('handles CRLF line endings', () => {
    const parsed = parseCsv('a,b\r\n1,2\r\n')
    expect(parsed.header).toEqual(['a', 'b'])
    expect(parsed.rows).toEqual([['1', '2']])
  })

  it('throws on unterminated quoted fields', () => {
    expect(() => parseCsv('a\n"oops\n')).toThrow(/unterminated/i)
  })
})
