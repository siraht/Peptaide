import type { ZodType } from 'zod'

import { CliApiError } from './response'

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function validateBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'payload'
      return `${path}: ${issue.message}`
    })

    throw new CliApiError({
      code: 'validation_error',
      status: 400,
      message: 'Validation failed.',
      details,
    })
  }

  return parsed.data
}

export function requireApply(opts: { apply?: boolean; dryRun?: boolean; command: string }): {
  dryRun: boolean
} {
  if (opts.apply) {
    return { dryRun: false }
  }

  // `dryRun=true` is explicit, but omitted flags are also treated as dry-run by default.
  if (opts.dryRun == null || opts.dryRun) {
    return { dryRun: true }
  }

  throw new CliApiError({
    code: 'validation_error',
    status: 400,
    message: `Invalid apply/dry-run combination for ${opts.command}.`,
    details: ['Use --apply to mutate data, or omit --apply for dry-run mode.'],
  })
}

export function requireForceWhenNonInteractive(opts: {
  force?: boolean
  noInput?: boolean
  command: string
  actionLabel: string
}): void {
  if (!opts.noInput) return
  if (opts.force) return

  throw new CliApiError({
    code: 'conflict',
    status: 409,
    message: `${opts.command} requires --force in non-interactive mode for ${opts.actionLabel}.`,
    details: ['Re-run with --force --no-input or use an interactive prompt.'],
  })
}
