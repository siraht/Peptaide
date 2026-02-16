export function exitCodeForEnvelope(envelope: {
  ok: boolean
  code: string
}): number {
  if (envelope.ok) return 0

  switch (envelope.code) {
    case 'validation_error':
      return 2
    case 'auth_required':
    case 'auth_failed':
      return 3
    case 'not_found':
      return 4
    case 'conflict':
      return 5
    case 'network_timeout':
      return 6
    default:
      return 1
  }
}
