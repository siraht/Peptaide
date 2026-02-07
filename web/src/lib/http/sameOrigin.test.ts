import { describe, expect, it } from 'vitest'

import { validateSameOrigin } from './sameOrigin'

describe('validateSameOrigin', () => {
  it('allows same-origin requests with Origin header', () => {
    const req = new Request('http://example.test/api/import', {
      method: 'POST',
      headers: { origin: 'http://example.test' },
    })
    expect(validateSameOrigin(req)).toBeNull()
  })

  it('blocks cross-origin requests with Origin header', () => {
    const req = new Request('http://example.test/api/import', {
      method: 'POST',
      headers: { origin: 'http://evil.test' },
    })
    expect(validateSameOrigin(req)).toMatch(/blocked/i)
  })

  it('allows same-origin requests based on Referer when Origin is missing', () => {
    const req = new Request('http://example.test/api/import', {
      method: 'POST',
      headers: { referer: 'http://example.test/settings' },
    })
    expect(validateSameOrigin(req)).toBeNull()
  })

  it('blocks cross-origin requests based on Referer when Origin is missing', () => {
    const req = new Request('http://example.test/api/import', {
      method: 'POST',
      headers: { referer: 'http://evil.test/settings' },
    })
    expect(validateSameOrigin(req)).toMatch(/blocked/i)
  })

  it('blocks cross-site requests based on sec-fetch-site when no Origin/Referer exists', () => {
    const req = new Request('http://example.test/api/import', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    })
    expect(validateSameOrigin(req)).toMatch(/blocked/i)
  })

  it('allows requests with no browser-originating headers (e.g. CLI)', () => {
    const req = new Request('http://example.test/api/import', { method: 'POST' })
    expect(validateSameOrigin(req)).toBeNull()
  })
})

