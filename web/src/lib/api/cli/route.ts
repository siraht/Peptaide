import type { CliEnvelope } from '@/lib/api/contracts/cli'

import { jsonNoStore, readRequestId, toCliError } from './response'

export async function runCliRoute(
  request: Request,
  handler: (requestId: string) => Promise<{ status?: number; envelope: CliEnvelope }>,
): Promise<Response> {
  const requestId = readRequestId(request)

  try {
    const result = await handler(requestId)
    return jsonNoStore(result.envelope, result.status ?? 200)
  } catch (error) {
    const converted = toCliError(error, requestId)
    return jsonNoStore(converted.envelope, converted.status)
  }
}
