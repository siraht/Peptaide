export function validateSameOrigin(request: Request): string | null {
  const expectedOrigin = new URL(request.url).origin

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

