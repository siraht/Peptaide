export function validateSameOrigin(request: Request): string | null {
  const url = new URL(request.url)

  function firstHeaderValue(v: string | null): string | null {
    if (!v) return null
    const first = v.split(',')[0]?.trim()
    return first || null
  }

  // Next.js route handlers can see `request.url` as `0.0.0.0` when the server is bound to 0.0.0.0.
  // For same-origin enforcement we want the externally-visible origin, which is conveyed by the
  // forwarded headers (Tailscale Serve / reverse proxies) and the Host header.
  const proto = firstHeaderValue(request.headers.get('x-forwarded-proto')) || url.protocol.replace(':', '')
  const host =
    firstHeaderValue(request.headers.get('x-forwarded-host')) || firstHeaderValue(request.headers.get('host')) || url.host
  const expectedOrigin = `${proto}://${host}`

  const origin = request.headers.get('origin')
  if (origin) {
    if (origin !== expectedOrigin) {
      return `Blocked cross-origin request (origin=${origin}, expected=${expectedOrigin}).`
    }
    return null
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (refOrigin !== expectedOrigin) {
        return `Blocked cross-origin request (referer_origin=${refOrigin}, expected=${expectedOrigin}).`
      }
      return null
    } catch {
      return 'Blocked request with invalid referer header.'
    }
  }

  // Defense-in-depth for modern browsers; do not rely on this header always existing.
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return `Blocked cross-site request (sec-fetch-site=${secFetchSite}).`
  }

  // If none of the browser-originating headers exist, allow the request (e.g. CLI usage).
  return null
}
