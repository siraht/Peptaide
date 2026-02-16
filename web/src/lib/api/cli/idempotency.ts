import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { CliEnvelope } from '@/lib/api/contracts/cli'
import type { Database, Json } from '@/lib/supabase/database.types'

import { CliApiError } from './response'

type CliIdempotencyRow = {
  operation: string
  idempotency_key: string
  request_hash: string
  status_code: number
  response_json: Json
}

type IdempotencyResult = {
  status: number
  envelope: CliEnvelope
  replayed: boolean
}

function stableCanonicalize(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input)

  if (Array.isArray(input)) {
    return `[${input.map((v) => stableCanonicalize(v)).join(',')}]`
  }

  const obj = input as Record<string, unknown>
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalize(obj[k])}`)
  return `{${parts.join(',')}}`
}

export function buildIdempotencyRequestHash(payload: unknown): string {
  const canonical = stableCanonicalize(payload)
  return createHash('sha256').update(canonical).digest('hex')
}

function toEnvelope(value: Json): CliEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stored idempotency response is invalid.')
  }

  const payload = value as Record<string, unknown>
  return {
    ok: Boolean(payload.ok),
    code: String(payload.code ?? ''),
    message: String(payload.message ?? ''),
    data: (payload.data as unknown) ?? null,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((x) => String(x)) : [],
    errors: Array.isArray(payload.errors) ? payload.errors.map((x) => String(x)) : [],
    request_id: String(payload.request_id ?? ''),
  }
}

async function readExistingRecord(
  supabase: SupabaseClient<Database>,
  operation: string,
  idempotencyKey: string,
): Promise<CliIdempotencyRow | null> {
  const res = await supabase
    .from('cli_idempotency_records' as any)
    .select('operation,idempotency_key,request_hash,status_code,response_json')
    .eq('operation', operation)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (res.error) {
    throw new Error(res.error.message)
  }

  return (res.data as CliIdempotencyRow | null) ?? null
}

async function writeRecord(
  supabase: SupabaseClient<Database>,
  opts: {
    operation: string
    idempotencyKey: string
    requestHash: string
    statusCode: number
    envelope: CliEnvelope
  },
): Promise<void> {
  const { operation, idempotencyKey, requestHash, statusCode, envelope } = opts

  const res = await supabase.from('cli_idempotency_records' as any).insert({
    operation,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    status_code: statusCode,
    response_json: envelope,
  })

  if (res.error) {
    throw new Error(res.error.message)
  }
}

export async function withIdempotency(opts: {
  supabase: SupabaseClient<Database>
  operation: string
  idempotencyKey: string
  requestPayload: unknown
  execute: () => Promise<{ status: number; envelope: CliEnvelope }>
}): Promise<IdempotencyResult> {
  const { supabase, operation, idempotencyKey, requestPayload, execute } = opts
  const requestHash = buildIdempotencyRequestHash(requestPayload)

  const existing = await readExistingRecord(supabase, operation, idempotencyKey)
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new CliApiError({
        code: 'conflict',
        status: 409,
        message: 'Idempotency key conflict: request payload does not match prior request.',
        details: ['Use a new idempotency key for changed payloads.'],
      })
    }

    return {
      status: existing.status_code,
      envelope: toEnvelope(existing.response_json),
      replayed: true,
    }
  }

  const result = await execute()

  try {
    await writeRecord(supabase, {
      operation,
      idempotencyKey,
      requestHash,
      statusCode: result.status,
      envelope: result.envelope,
    })
    return {
      status: result.status,
      envelope: result.envelope,
      replayed: false,
    }
  } catch (writeError) {
    const msg = writeError instanceof Error ? writeError.message : String(writeError)
    const isUnique = msg.includes('duplicate key value') || msg.includes('23505')
    if (!isUnique) throw writeError

    // Race: another request with the same key just committed.
    const raceWinner = await readExistingRecord(supabase, operation, idempotencyKey)
    if (!raceWinner) throw writeError

    if (raceWinner.request_hash !== requestHash) {
      throw new CliApiError({
        code: 'conflict',
        status: 409,
        message: 'Idempotency key conflict: request payload does not match prior request.',
        details: ['Use a new idempotency key for changed payloads.'],
      })
    }

    return {
      status: raceWinner.status_code,
      envelope: toEnvelope(raceWinner.response_json),
      replayed: true,
    }
  }
}
