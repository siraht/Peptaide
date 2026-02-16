import { inspect } from 'node:util'

import type { CliEnvelope, RuntimeConfig } from './types.js'

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function renderEnvelope(envelope: CliEnvelope, config: RuntimeConfig): void {
  if (config.json) {
    process.stdout.write(`${JSON.stringify(envelope)}\n`)
    return
  }

  if (config.plain) {
    process.stdout.write(
      `ok=${envelope.ok} code=${envelope.code} request_id=${envelope.request_id} message=${JSON.stringify(envelope.message)}\n`,
    )

    if (envelope.data != null) {
      process.stdout.write(`data=${JSON.stringify(envelope.data)}\n`)
    }

    for (const warning of envelope.warnings) {
      process.stderr.write(`warning=${JSON.stringify(warning)}\n`)
    }
    for (const error of envelope.errors) {
      process.stderr.write(`error=${JSON.stringify(error)}\n`)
    }
    return
  }

  if (!config.quiet || !envelope.ok) {
    const summary = envelope.ok ? envelope.message : `${envelope.message} (${envelope.code})`
    const stream = envelope.ok ? process.stdout : process.stderr
    stream.write(`${summary}\n`)
  }

  if (envelope.data != null && !config.quiet) {
    process.stdout.write(`${formatJson(envelope.data)}\n`)
  }

  if (envelope.warnings.length > 0) {
    for (const warning of envelope.warnings) {
      process.stderr.write(`Warning: ${warning}\n`)
    }
  }

  if (envelope.errors.length > 0) {
    for (const error of envelope.errors) {
      process.stderr.write(`Error: ${error}\n`)
    }
  }

  if (config.verbose && envelope.data == null) {
    process.stderr.write(`${inspect(envelope, { depth: 6, colors: false })}\n`)
  }
}
