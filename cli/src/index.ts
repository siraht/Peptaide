#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { Command } from 'commander'

import { resolveRuntimeConfig } from './config.js'
import { exitCodeForEnvelope } from './exit-codes.js'
import { parseFilterExpression, parseSortExpression } from './filters.js'
import { callApi } from './http.js'
import { clearTokens, cloneProfile, deleteProfile, getProfile, listProfiles, saveTokens } from './profile-store.js'
import { renderEnvelope } from './output.js'
import type { CliEnvelope } from './types.js'

function intValue(input: string): number {
  const n = Number(input)
  if (!Number.isInteger(n)) {
    throw new Error(`Expected integer but got: ${input}`)
  }
  return n
}

function floatValue(input: string): number {
  const n = Number(input)
  if (!Number.isFinite(n)) {
    throw new Error(`Expected number but got: ${input}`)
  }
  return n
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

function csv(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return items.length > 0 ? items : undefined
}

function commandConfig(command: Command) {
  const opts = command.optsWithGlobals()
  return resolveRuntimeConfig({
    global: opts,
    cwd: process.cwd(),
  })
}

async function runApiAction(command: Command, opts: {
  domain: string
  payload: Record<string, unknown>
  authRequired?: boolean
}): Promise<CliEnvelope> {
  const config = commandConfig(command)
  const envelope = await callApi({
    config,
    domain: opts.domain,
    payload: opts.payload,
    authRequired: opts.authRequired ?? true,
  })
  renderEnvelope(envelope, config)
  process.exitCode = exitCodeForEnvelope(envelope)
  return envelope
}

function runLocalEnvelope(command: Command, envelope: CliEnvelope): void {
  const config = commandConfig(command)
  renderEnvelope(envelope, config)
  process.exitCode = exitCodeForEnvelope(envelope)
}

function requireForceWhenNoInput(opts: {
  command: Command
  apply?: boolean
  force?: boolean
  commandName: string
  actionLabel: string
}): boolean {
  if (!opts.apply) return true
  const config = commandConfig(opts.command)
  if (!config.noInput || opts.force) return true

  runLocalEnvelope(
    opts.command,
    actionEnvelope({
      ok: false,
      code: 'conflict',
      message: `${opts.commandName} requires --force when --no-input is set (${opts.actionLabel}).`,
      errors: ['Re-run with --force or omit --no-input.'],
    }),
  )
  return false
}

function ensureApplyOrDryRun(payload: { apply?: boolean; dryRunFlag?: boolean }): {
  apply: boolean
  dry_run: boolean
} {
  if (payload.apply) return { apply: true, dry_run: false }
  if (payload.dryRunFlag) return { apply: false, dry_run: true }
  return { apply: false, dry_run: true }
}

function actionEnvelope(opts: {
  ok: boolean
  code: string
  message: string
  data?: unknown
  warnings?: string[]
  errors?: string[]
}): CliEnvelope {
  return {
    ok: opts.ok,
    code: opts.code,
    message: opts.message,
    data: opts.data ?? null,
    warnings: opts.warnings ?? [],
    errors: opts.errors ?? [],
    request_id: 'local',
  }
}

function addInputFlags(cmd: Command): Command {
  return cmd
    .option('--input-text <text>')
    .option('--input-kind <kind>')
    .option('--input-value <number>', 'numeric value', floatValue)
    .option('--input-unit <unit>')
    .option('--normalized-unit <unit>')
    .option('--prefer-structured')
}

function addDoseFlags(cmd: Command): Command {
  return cmd
    .option('--concentration-mg-per-ml <number>', 'numeric value', floatValue)
    .option('--vial-content-mass-mg <number>', 'numeric value', floatValue)
    .option('--vial-total-volume-ml <number>', 'numeric value', floatValue)
    .option('--volume-ml-per-device-unit <number>', 'numeric value', floatValue)
    .option('--prefer-direct-concentration')
}

function addEffectiveFlags(cmd: Command): Command {
  return cmd
    .option('--dose-mg <number>', 'numeric value', floatValue)
    .option('--compartment <compartment>')
    .option('--base-fraction-dist-id <id>')
    .option('--multiplier-dist-id <id>', 'repeatable', collect, [])
    .option('--formulation-id <id>')
    .option('--substance-id <id>')
    .option('--route-id <id>')
    .option('--systemic-base-fraction-dist-id <id>')
    .option('--cns-base-fraction-dist-id <id>')
    .option('--systemic-multiplier-dist-id <id>', 'repeatable', collect, [])
    .option('--cns-multiplier-dist-id <id>', 'repeatable', collect, [])
    .option('--mc-n <int>', 'integer value', intValue)
    .option('--mc-seed <seed>')
    .option('--strict-model-coverage')
}

function baseCalcPayload(opts: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    input_text: opts.inputText,
    input_kind: opts.inputKind,
    input_value: opts.inputValue,
    input_unit: opts.inputUnit,
    normalized_unit: opts.normalizedUnit,
    prefer_structured: Boolean(opts.preferStructured),
    concentration_mg_per_ml: opts.concentrationMgPerMl,
    vial_content_mass_mg: opts.vialContentMassMg,
    vial_total_volume_ml: opts.vialTotalVolumeMl,
    volume_ml_per_device_unit: opts.volumeMlPerDeviceUnit,
    prefer_direct_concentration: Boolean(opts.preferDirectConcentration),
    dose_mg: opts.doseMg,
    compartment: opts.compartment,
    base_fraction_dist_id: opts.baseFractionDistId,
    multiplier_dist_id: (opts.multiplierDistId as string[])?.length
      ? (opts.multiplierDistId as string[])
      : undefined,
    formulation_id: opts.formulationId,
    substance_id: opts.substanceId,
    route_id: opts.routeId,
    systemic_base_fraction_dist_id: opts.systemicBaseFractionDistId,
    cns_base_fraction_dist_id: opts.cnsBaseFractionDistId,
    systemic_multiplier_dist_id: (opts.systemicMultiplierDistId as string[])?.length
      ? (opts.systemicMultiplierDistId as string[])
      : undefined,
    cns_multiplier_dist_id: (opts.cnsMultiplierDistId as string[])?.length
      ? (opts.cnsMultiplierDistId as string[])
      : undefined,
    mc_n: opts.mcN,
    mc_seed: opts.mcSeed,
    strict_model_coverage: Boolean(opts.strictModelCoverage),
  }

  if (payload.mc_seed === 'auto') {
    payload.mc_seed = 'auto'
  } else if (typeof payload.mc_seed === 'string' && payload.mc_seed.length > 0) {
    payload.mc_seed = intValue(payload.mc_seed)
  } else {
    delete payload.mc_seed
  }

  for (const [key, value] of Object.entries(payload)) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete payload[key]
    }
  }

  return payload
}

function readJsonLines(filePath: string): Array<Record<string, unknown>> {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`Invalid JSONL at line ${index + 1}`)
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`JSONL line ${index + 1} must be an object.`)
    }

    const out = parsed as Record<string, unknown>
    if (!out.idempotency_key) {
      out.idempotency_key = createHash('sha1').update(line).digest('hex').slice(0, 24)
    }
    return out
  })
}

const program = new Command()

program
  .name('peptaide')
  .description('Agent-friendly CLI for Peptaide session calculation, logging, cycle actions, and personal settings.')
  .option('--json', 'machine-readable JSON envelope output')
  .option('--plain', 'line-stable output for script parsing')
  .option('-q, --quiet', 'reduce human output')
  .option('-v, --verbose', 'extra diagnostics output')
  .option('--no-input', 'disable interactive prompts')
  .option('--no-color', 'disable ANSI color output')
  .option('--api-url <url>', 'Peptaide API base URL')
  .option('--profile <name>', 'profile name for stored credentials')
  .option('--timeout-ms <int>', 'request timeout in milliseconds', intValue)
  .option('--request-id <id>', 'optional request id for tracing')

const auth = program.command('auth').description('Authenticate and manage local auth profiles')

auth
  .command('login')
  .requiredOption('--email <email>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'auth',
      authRequired: false,
      payload: {
        action: 'login',
        email: opts.email,
      },
    })
  })

auth
  .command('verify')
  .requiredOption('--email <email>')
  .requiredOption('--code <otp>')
  .action(async function action(this: Command, opts) {
    const cmd = this as Command
    const envelope = await runApiAction(cmd, {
      domain: 'auth',
      authRequired: false,
      payload: {
        action: 'verify',
        email: opts.email,
        code: opts.code,
      },
    })

    if (envelope.ok && envelope.data && typeof envelope.data === 'object') {
      const data = envelope.data as Record<string, unknown>
      const accessToken = String(data.access_token ?? '')
      const refreshToken = String(data.refresh_token ?? '')
      if (accessToken && refreshToken) {
        const config = commandConfig(cmd)
        saveTokens(config.profile, {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at:
            typeof data.expires_at === 'number' && Number.isFinite(data.expires_at)
              ? data.expires_at
              : null,
          token_type: String(data.token_type ?? 'bearer'),
        })
      }
    }
  })

const token = auth.command('token').description('Manage local token profiles')

token
  .command('create')
  .requiredOption('--name <label>')
  .option('--expires-days <int>', 'integer value', intValue)
  .option('--apply')
  .action(async function action(this: Command, opts) {
    const cmd = this as Command
    const config = commandConfig(cmd)
    const current = getProfile(config.profile)

    if (!current.access_token || !current.refresh_token) {
      runLocalEnvelope(cmd, actionEnvelope({
        ok: false,
        code: 'auth_required',
        message: 'Current profile has no auth session. Run `peptaide auth verify` first.',
      }))
      return
    }

    if (!opts.apply) {
      runLocalEnvelope(cmd, actionEnvelope({
        ok: true,
        code: 'dry_run',
        message: 'Dry run complete.',
        data: {
          action: 'auth token create',
          source_profile: config.profile,
          target_profile: opts.name,
          expires_days: opts.expiresDays ?? null,
        },
      }))
      return
    }

    cloneProfile({ from: config.profile, to: opts.name })
    runLocalEnvelope(cmd, actionEnvelope({
      ok: true,
      code: 'ok',
      message: 'Token profile created.',
      data: {
        token_id: opts.name,
        profile: opts.name,
      },
    }))
  })

token
  .command('revoke')
  .requiredOption('--token-id <id>')
  .option('--apply')
  .option('--force')
  .action(async function action(this: Command, opts) {
    const cmd = this as Command
    if (!opts.apply) {
      runLocalEnvelope(cmd, actionEnvelope({
        ok: true,
        code: 'dry_run',
        message: 'Dry run complete.',
        data: {
          action: 'auth token revoke',
          token_id: opts.tokenId,
        },
      }))
      return
    }

    if (
      !requireForceWhenNoInput({
        command: cmd,
        apply: Boolean(opts.apply),
        force: Boolean(opts.force),
        commandName: 'auth token revoke',
        actionLabel: 'profile deletion',
      })
    ) {
      return
    }

    deleteProfile(opts.tokenId)
    runLocalEnvelope(cmd, actionEnvelope({
      ok: true,
      code: 'ok',
      message: 'Token profile revoked.',
      data: {
        token_id: opts.tokenId,
      },
    }))
  })

auth
  .command('whoami')
  .action(async function action(this: Command) {
    await runApiAction(this as Command, {
      domain: 'auth',
      payload: { action: 'whoami' },
    })
  })

auth
  .command('logout')
  .action(async function action(this: Command) {
    const cmd = this as Command
    const config = commandConfig(cmd)

    await runApiAction(cmd, {
      domain: 'auth',
      payload: { action: 'logout' },
    })

    clearTokens(config.profile)
  })

const calc = program.command('calc').description('Dose and effective-dose calculations')

calc
  .command('parse')
  .requiredOption('--text <text>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'calc',
      authRequired: false,
      payload: {
        action: 'parse',
        text: opts.text,
      },
    })
  })

addEffectiveFlags(addDoseFlags(addInputFlags(calc.command('dose').description('Compute dose metrics'))))
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'calc',
      authRequired: false,
      payload: {
        action: 'dose',
        ...baseCalcPayload(opts as Record<string, unknown>),
      },
    })
  })

addEffectiveFlags(addDoseFlags(addInputFlags(calc.command('effective').description('Compute effective-dose Monte Carlo percentiles'))))
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'calc',
      payload: {
        action: 'effective',
        ...baseCalcPayload(opts as Record<string, unknown>),
      },
    })
  })

addEffectiveFlags(addDoseFlags(addInputFlags(calc.command('from-text').description('Parse free text and compute effective dose'))))
  .requiredOption('--text <text>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'calc',
      payload: {
        action: 'from_text',
        ...baseCalcPayload({ ...(opts as Record<string, unknown>), inputText: opts.text }),
        input_text: opts.text,
      },
    })
  })

const sessions = program.command('sessions').description('Session lifecycle operations')

function addSessionMutationFlags(cmd: Command): Command {
  return cmd
    .option('--apply')
    .option('--dry-run')
    .option('--idempotency-key <key>')
}

function addSessionCreateFlags(cmd: Command): Command {
  return addSessionMutationFlags(addEffectiveFlags(addDoseFlags(addInputFlags(cmd))))
    .option('--formulation-name <name>')
    .option('--vial-id <id>')
    .option('--ts <iso8601>')
    .option('--date <yyyy-mm-dd>')
    .option('--time <hh:mm>')
    .option('--timezone <iana>')
    .option('--notes <text>')
    .option('--tag <text>', 'repeatable tag', collect, [])
    .option('--cycle-decision <mode>')
    .option('--deterministic-seed-mode')
}

addSessionCreateFlags(sessions.command('create').description('Create one session'))
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'create',
        ...mode,
        ...baseCalcPayload(opts as Record<string, unknown>),
        formulation_id: opts.formulationId,
        formulation_name: opts.formulationName,
        vial_id: opts.vialId,
        ts: opts.ts,
        date: opts.date,
        time: opts.time,
        timezone: opts.timezone,
        notes: opts.notes,
        tags: (opts.tag as string[])?.length ? opts.tag : undefined,
        cycle_decision: opts.cycleDecision,
        idempotency_key: opts.idempotencyKey,
        deterministic_seed_mode: Boolean(opts.deterministicSeedMode),
      },
    })
  })

addSessionCreateFlags(sessions.command('create-from-text').description('Create one session from free text'))
  .requiredOption('--text <text>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'create_from_text',
        ...mode,
        ...baseCalcPayload({ ...(opts as Record<string, unknown>), inputText: opts.text }),
        input_text: opts.text,
        formulation_id: opts.formulationId,
        formulation_name: opts.formulationName,
        vial_id: opts.vialId,
        ts: opts.ts,
        date: opts.date,
        time: opts.time,
        timezone: opts.timezone,
        notes: opts.notes,
        tags: (opts.tag as string[])?.length ? opts.tag : undefined,
        cycle_decision: opts.cycleDecision,
        idempotency_key: opts.idempotencyKey,
        deterministic_seed_mode: Boolean(opts.deterministicSeedMode),
      },
    })
  })

addSessionMutationFlags(sessions.command('batch').description('Create sessions from JSONL payload'))
  .requiredOption('--jsonl <file>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    const items = readJsonLines(path.resolve(String(opts.jsonl)))
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'batch',
        ...mode,
        items,
      },
    })
  })

sessions
  .command('list')
  .option('--from <iso8601>')
  .option('--to <iso8601>')
  .option('--substance-id <id>')
  .option('--formulation-id <id>')
  .option('--cycle-id <id>')
  .option('--include-deleted')
  .option('--deleted-only')
  .option('--limit <int>', 'integer value', intValue)
  .option('--cursor <cursor>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'list',
        from: opts.from,
        to: opts.to,
        substance_id: opts.substanceId,
        formulation_id: opts.formulationId,
        cycle_id: opts.cycleId,
        include_deleted: Boolean(opts.includeDeleted),
        deleted_only: Boolean(opts.deletedOnly),
        limit: opts.limit,
        cursor: opts.cursor,
      },
    })
  })

sessions
  .command('get')
  .requiredOption('--id <eventId>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'get',
        event_id: opts.id,
      },
    })
  })

addSessionMutationFlags(addInputFlags(sessions.command('update').description('Update one session')))
  .requiredOption('--id <eventId>')
  .option('--ts <iso8601>')
  .option('--notes <text>')
  .option('--tags <csv>')
  .option('--cycle-decision <mode>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'update',
        ...mode,
        event_id: opts.id,
        input_text: opts.inputText,
        input_kind: opts.inputKind,
        input_value: opts.inputValue,
        input_unit: opts.inputUnit,
        normalized_unit: opts.normalizedUnit,
        prefer_structured: Boolean(opts.preferStructured),
        ts: opts.ts,
        notes: opts.notes,
        tags: csv(opts.tags),
        cycle_decision: opts.cycleDecision,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

addSessionMutationFlags(sessions.command('delete').description('Soft delete one session'))
  .requiredOption('--id <eventId>')
  .option('--force')
  .action(async function action(this: Command, opts) {
    if (
      !requireForceWhenNoInput({
        command: this as Command,
        apply: Boolean(opts.apply),
        force: Boolean(opts.force),
        commandName: 'sessions delete',
        actionLabel: 'session deletion',
      })
    ) {
      return
    }

    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'delete',
        ...mode,
        event_id: opts.id,
        force: Boolean(opts.force),
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

addSessionMutationFlags(sessions.command('restore').description('Restore one soft-deleted session'))
  .requiredOption('--id <eventId>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'restore',
        ...mode,
        event_id: opts.id,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

addSessionCreateFlags(sessions.command('copy').description('Copy an existing session with overrides'))
  .requiredOption('--id <eventId>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'sessions',
      payload: {
        action: 'copy',
        ...mode,
        event_id: opts.id,
        ...baseCalcPayload(opts as Record<string, unknown>),
        formulation_id: opts.formulationId,
        formulation_name: opts.formulationName,
        vial_id: opts.vialId,
        ts: opts.ts,
        date: opts.date,
        time: opts.time,
        timezone: opts.timezone,
        notes: opts.notes,
        tags: (opts.tag as string[])?.length ? opts.tag : undefined,
        cycle_decision: opts.cycleDecision,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

const cycles = program.command('cycles').description('Cycle actions and cycle rules')

cycles
  .command('suggest')
  .requiredOption('--substance-id <id>')
  .requiredOption('--new-event-ts <iso8601>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'suggest',
        substance_id: opts.substanceId,
        new_event_ts: opts.newEventTs,
      },
    })
  })

cycles
  .command('start')
  .requiredOption('--substance-id <id>')
  .option('--start-ts <iso8601>')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'start',
        ...mode,
        substance_id: opts.substanceId,
        start_ts: opts.startTs,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

for (const [name, actionName] of [
  ['end', 'end'],
  ['abandon', 'abandon'],
] as const) {
  cycles
    .command(name)
    .requiredOption('--cycle-id <id>')
    .option('--end-ts <iso8601>')
    .option('--apply')
    .option('--dry-run')
    .option('--idempotency-key <key>')
    .action(async function action(this: Command, opts) {
      const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
      await runApiAction(this as Command, {
        domain: 'cycles',
        payload: {
          action: actionName,
          ...mode,
          cycle_id: opts.cycleId,
          end_ts: opts.endTs,
          idempotency_key: opts.idempotencyKey,
        },
      })
    })
}

cycles
  .command('split')
  .requiredOption('--cycle-id <id>')
  .requiredOption('--event-id <id>')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'split',
        ...mode,
        cycle_id: opts.cycleId,
        event_id: opts.eventId,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

cycles
  .command('list')
  .option('--substance-id <id>')
  .option('--active')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'list',
        substance_id: opts.substanceId,
        active: Boolean(opts.active),
      },
    })
  })

cycles
  .command('get')
  .requiredOption('--cycle-id <id>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'get',
        cycle_id: opts.cycleId,
      },
    })
  })

const cycleRules = cycles.command('rules').description('Cycle rules')

cycleRules
  .command('get')
  .requiredOption('--substance-id <id>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'rules_get',
        substance_id: opts.substanceId,
      },
    })
  })

cycleRules
  .command('set')
  .requiredOption('--substance-id <id>')
  .requiredOption('--gap-days-to-suggest-new-cycle <int>', 'integer value', intValue)
  .option('--auto-start-first-cycle <bool>', 'true|false', 'true')
  .option('--notes <text>')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'rules_set',
        ...mode,
        substance_id: opts.substanceId,
        gap_days_to_suggest_new_cycle: opts.gapDaysToSuggestNewCycle,
        auto_start_first_cycle: String(opts.autoStartFirstCycle).toLowerCase() !== 'false',
        notes: opts.notes,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

cycleRules
  .command('delete')
  .requiredOption('--cycle-rule-id <id>')
  .option('--apply')
  .option('--dry-run')
  .option('--force')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    if (
      !requireForceWhenNoInput({
        command: this as Command,
        apply: Boolean(opts.apply),
        force: Boolean(opts.force),
        commandName: 'cycles rules delete',
        actionLabel: 'cycle rule deletion',
      })
    ) {
      return
    }

    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'cycles',
      payload: {
        action: 'rules_delete',
        ...mode,
        cycle_rule_id: opts.cycleRuleId,
        force: Boolean(opts.force),
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

const settings = program.command('settings').description('Profile and notification settings')

const settingsProfile = settings.command('profile')
settingsProfile
  .command('get')
  .action(async function action(this: Command) {
    await runApiAction(this as Command, {
      domain: 'settings',
      payload: { action: 'profile_get' },
    })
  })

settingsProfile
  .command('set')
  .requiredOption('--timezone <iana>')
  .requiredOption('--default-mass-unit <unit>')
  .requiredOption('--default-volume-unit <unit>')
  .requiredOption('--default-simulation-n <int>', 'integer value', intValue)
  .requiredOption('--cycle-gap-default-days <int>', 'integer value', intValue)
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'settings',
      payload: {
        action: 'profile_set',
        ...mode,
        timezone: opts.timezone,
        default_mass_unit: opts.defaultMassUnit,
        default_volume_unit: opts.defaultVolumeUnit,
        default_simulation_n: opts.defaultSimulationN,
        cycle_gap_default_days: opts.cycleGapDefaultDays,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

const settingsNotifications = settings.command('notifications')
settingsNotifications
  .command('get')
  .action(async function action(this: Command) {
    await runApiAction(this as Command, {
      domain: 'settings',
      payload: { action: 'notifications_get' },
    })
  })

settingsNotifications
  .command('set')
  .requiredOption('--notify-low-stock-enabled <bool>', 'true|false')
  .requiredOption('--notify-low-stock-runway-days-threshold <int>', 'integer value', intValue)
  .requiredOption('--notify-spend-enabled <bool>', 'true|false')
  .requiredOption('--notify-spend-usd-per-day-threshold <number>', 'numeric value', floatValue)
  .requiredOption('--notify-spend-window-days <int>', 'integer value', intValue)
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'settings',
      payload: {
        action: 'notifications_set',
        ...mode,
        notify_low_stock_enabled: String(opts.notifyLowStockEnabled).toLowerCase() === 'true',
        notify_low_stock_runway_days_threshold: opts.notifyLowStockRunwayDaysThreshold,
        notify_spend_enabled: String(opts.notifySpendEnabled).toLowerCase() === 'true',
        notify_spend_usd_per_day_threshold: opts.notifySpendUsdPerDayThreshold,
        notify_spend_window_days: opts.notifySpendWindowDays,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

const data = program.command('data').description('Data portability and destructive operations')

data
  .command('export')
  .requiredOption('--out <path>', 'output file path or - for stdout')
  .action(async function action(this: Command, opts) {
    const cmd = this as Command
    const config = commandConfig(cmd)
    const envelope = await callApi({
      config,
      domain: 'data',
      payload: { action: 'export', out: opts.out },
      authRequired: true,
    })
    process.exitCode = exitCodeForEnvelope(envelope)

    const outIsStdout = String(opts.out) === '-'
    if (!envelope.ok || !envelope.data || typeof envelope.data !== 'object') {
      renderEnvelope(envelope, config)
      return
    }

    const dataObj = envelope.data as Record<string, unknown>
    const zipBase64 = String(dataObj.zip_base64 ?? '')
    if (!zipBase64) {
      renderEnvelope(envelope, config)
      return
    }

    const bytes = Buffer.from(zipBase64, 'base64')
    if (outIsStdout) {
      // For stdout mode, write only ZIP bytes so shell piping is safe.
      process.stdout.write(bytes)
      return
    }

    renderEnvelope(envelope, config)
    const outPath = path.resolve(String(opts.out))
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, bytes)
  })

data
  .command('import-bundle')
  .requiredOption('--file <zipPath>')
  .option('--replace')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    const zipBase64 = fs.readFileSync(path.resolve(String(opts.file))).toString('base64')

    await runApiAction(this as Command, {
      domain: 'data',
      payload: {
        action: 'import_bundle',
        ...mode,
        zip_base64: zipBase64,
        replace: Boolean(opts.replace),
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

data
  .command('import-simple-events')
  .requiredOption('--file <csvPath>')
  .option('--replace')
  .option('--infer-cycles')
  .option('--no-infer-cycles')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    const csvText = fs.readFileSync(path.resolve(String(opts.file)), 'utf8')

    await runApiAction(this as Command, {
      domain: 'data',
      payload: {
        action: 'import_simple_events',
        ...mode,
        csv_text: csvText,
        replace: Boolean(opts.replace),
        infer_cycles: opts.inferCycles !== false,
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

data
  .command('delete-all')
  .requiredOption('--confirm <value>')
  .option('--force')
  .option('--apply')
  .option('--dry-run')
  .option('--idempotency-key <key>')
  .action(async function action(this: Command, opts) {
    if (
      !requireForceWhenNoInput({
        command: this as Command,
        apply: Boolean(opts.apply),
        force: Boolean(opts.force),
        commandName: 'data delete-all',
        actionLabel: 'account data deletion',
      })
    ) {
      return
    }

    const mode = ensureApplyOrDryRun({ apply: opts.apply, dryRunFlag: opts.dryRun })
    await runApiAction(this as Command, {
      domain: 'data',
      payload: {
        action: 'delete_all',
        ...mode,
        confirm: opts.confirm,
        force: Boolean(opts.force),
        idempotency_key: opts.idempotencyKey,
      },
    })
  })

const query = program.command('query').description('Broad read-only query surface')

query
  .command('resources')
  .action(async function action(this: Command) {
    await runApiAction(this as Command, {
      domain: 'query',
      payload: { action: 'resources' },
    })
  })

query
  .command('list')
  .requiredOption('--resource <name>')
  .option('--filter <expr>', 'repeatable key=op:value filter', collect, [])
  .option('--sort <expr>', 'repeatable field:asc|desc sort', collect, [])
  .option('--limit <int>', 'integer value', intValue)
  .option('--cursor <cursor>')
  .option('--fields <csv>')
  .action(async function action(this: Command, opts) {
    const filters = (opts.filter as string[]).map((entry) => parseFilterExpression(entry))
    const sort = (opts.sort as string[]).map((entry) => parseSortExpression(entry))

    await runApiAction(this as Command, {
      domain: 'query',
      payload: {
        action: 'list',
        resource: opts.resource,
        filters: filters.length > 0 ? filters : undefined,
        sort: sort.length > 0 ? sort : undefined,
        limit: opts.limit,
        cursor: opts.cursor,
        fields: csv(opts.fields),
      },
    })
  })

query
  .command('get')
  .requiredOption('--resource <name>')
  .requiredOption('--id <id>')
  .option('--fields <csv>')
  .action(async function action(this: Command, opts) {
    await runApiAction(this as Command, {
      domain: 'query',
      payload: {
        action: 'get',
        resource: opts.resource,
        id: opts.id,
        fields: csv(opts.fields),
      },
    })
  })

query
  .command('aggregate')
  .requiredOption('--resource <name>')
  .requiredOption('--metric <metric>')
  .option('--field <field>')
  .option('--filter <expr>', 'repeatable key=op:value filter', collect, [])
  .option('--group-by <csv>')
  .action(async function action(this: Command, opts) {
    const filters = (opts.filter as string[]).map((entry) => parseFilterExpression(entry))

    await runApiAction(this as Command, {
      domain: 'query',
      payload: {
        action: 'aggregate',
        resource: opts.resource,
        metric: opts.metric,
        field: opts.field,
        filters: filters.length > 0 ? filters : undefined,
        group_by: csv(opts.groupBy),
      },
    })
  })

for (const shortcut of [
  ['substances', 'substances'],
  ['routes', 'routes'],
  ['formulations', 'formulations'],
  ['dose-history', 'dose_history'],
  ['inventory', 'inventory'],
  ['inventory-summary', 'inventory_summary'],
  ['active-vials', 'active_vials'],
] as const) {
  query
    .command(shortcut[0])
    .option('--query <text>')
    .option('--substance-id <id>')
    .option('--formulation-id <id>')
    .option('--status <status>')
    .option('--from <iso8601>')
    .option('--to <iso8601>')
    .option('--include-deleted')
    .option('--limit <int>', 'integer value', intValue)
    .option('--cursor <cursor>')
    .action(async function action(this: Command, opts) {
      await runApiAction(this as Command, {
        domain: 'query',
        payload: {
          action: shortcut[1],
          query: opts.query,
          substance_id: opts.substanceId,
          formulation_id: opts.formulationId,
          status: opts.status,
          from: opts.from,
          to: opts.to,
          include_deleted: Boolean(opts.includeDeleted),
          limit: opts.limit,
          cursor: opts.cursor,
        },
      })
    })
}

const catalog = program.command('catalog').description('Catalog convenience aliases over query shortcuts')

function addCatalogListCommand(parent: Command, name: string, actionName: string): void {
  parent
    .command(name)
    .description(`Catalog ${name}`)
    .option('--query <text>')
    .option('--substance-id <id>')
    .option('--formulation-id <id>')
    .option('--status <status>')
    .option('--limit <int>', 'integer value', intValue)
    .option('--cursor <cursor>')
    .action(async function action(this: Command, opts) {
      await runApiAction(this as Command, {
        domain: 'catalog',
        payload: {
          action: actionName,
          query: opts.query,
          substance_id: opts.substanceId,
          formulation_id: opts.formulationId,
          status: opts.status,
          limit: opts.limit,
          cursor: opts.cursor,
        },
      })
    })
}

for (const [name, actionName] of [
  ['substances', 'substances'],
  ['routes', 'routes'],
  ['formulations', 'formulations'],
  ['vials', 'vials'],
] as const) {
  const group = catalog.command(name)
  addCatalogListCommand(group, 'list', actionName)
}

program.command('profiles').description('List local auth profiles').action(function action(this: Command) {
  const cmd = this as Command
  const list = listProfiles()
  runLocalEnvelope(cmd, actionEnvelope({
    ok: true,
    code: 'ok',
    message: 'Local profile list.',
    data: list,
  }))
})

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const config = resolveRuntimeConfig({
    global: program.optsWithGlobals(),
    cwd: process.cwd(),
  })
  const envelope = actionEnvelope({
    ok: false,
    code: 'runtime_error',
    message: 'Command failed.',
    errors: [message],
  })
  renderEnvelope(envelope, config)
  process.exitCode = exitCodeForEnvelope(envelope)
})
