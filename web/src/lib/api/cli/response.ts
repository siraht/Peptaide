import { randomUUID } from 'node:crypto'

import type { CliEnvelope } from '@/lib/api/contracts/cli'

export type CliCode =
  | 'ok'
  | 'validation_error'
  | 'auth_required'
  | 'auth_failed'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'network_timeout'
  | 'dry_run'
  | 'runtime_error'

export class CliApiError extends Error {
  readonly code: CliCode
  readonly status: number
  readonly details: string[]
  readonly warnings: string[]
  readonly data: unknown

  constructor(opts: {
    code: CliCode
    message: string
    status: number
    details?: string[]
    warnings?: string[]
    data?: unknown
  }) {
    super(opts.message)
    this.name = 'CliApiError'
    this.code = opts.code
    this.status = opts.status
    this.details = opts.details ?? []
    this.warnings = opts.warnings ?? []
    this.data = opts.data ?? null
  }
}

export function readRequestId(request: Request): string {
  const fromHeader = request.headers.get('x-request-id')?.trim()
  return fromHeader || randomUUID()
}

export function okEnvelope<T>(opts: {
  requestId: string
  code?: CliCode
  message?: string
  data?: T | null
  warnings?: string[]
}): CliEnvelope<T> {
  return {
    ok: true,
    code: opts.code ?? 'ok',
    message: opts.message ?? 'OK',
    data: opts.data ?? null,
    warnings: opts.warnings ?? [],
    errors: [],
    request_id: opts.requestId,
  }
}

export function errorEnvelope(opts: {
  requestId: string
  code: CliCode
  message: string
  errors?: string[]
  warnings?: string[]
  data?: unknown
}): CliEnvelope {
  return {
    ok: false,
    code: opts.code,
    message: opts.message,
    data: opts.data ?? null,
    warnings: opts.warnings ?? [],
    errors: opts.errors ?? [],
    request_id: opts.requestId,
  }
}

export function toCliError(error: unknown, fallbackRequestId: string): {
  status: number
  envelope: CliEnvelope
} {
  if (error instanceof CliApiError) {
    return {
      status: error.status,
      envelope: errorEnvelope({
        requestId: fallbackRequestId,
        code: error.code,
        message: error.message,
        errors: error.details,
        warnings: error.warnings,
        data: error.data,
      }),
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 500,
    envelope: errorEnvelope({
      requestId: fallbackRequestId,
      code: 'runtime_error',
      message: 'Unexpected runtime failure.',
      errors: [message],
    }),
  }
}

export function jsonNoStore(body: CliEnvelope, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
