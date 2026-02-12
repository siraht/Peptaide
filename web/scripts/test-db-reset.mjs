#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

function run(bin, args, { allowFailure = false } = {}) {
  const res = spawnSync(bin, args, { encoding: 'utf8' })
  if (res.error) throw res.error
  const status = res.status ?? 0
  if (status !== 0 && !allowFailure) {
    const msg = (res.stderr || res.stdout || '').trim()
    throw new Error(`${bin} ${args.join(' ')} failed: ${msg}`)
  }
  return res
}

function parseArgs(argv) {
  return {
    start: !argv.includes('--no-start'),
    yes: argv.includes('--yes') || process.env.TEST_DB_RESET_YES === '1',
    linked: argv.includes('--linked'),
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.yes) {
    process.stdout.write('[test-db-reset] Refusing to run without --yes (or TEST_DB_RESET_YES=1).\n')
    process.exit(2)
  }

  if (opts.start) {
    process.stdout.write('[test-db-reset] Ensuring local Supabase services are up...\n')
    run('supabase', ['start'], { allowFailure: true })
  }

  const args = ['db', 'reset', '--yes']
  if (opts.linked) args.push('--linked')

  process.stdout.write(`[test-db-reset] Running: supabase ${args.join(' ')}\n`)
  run('supabase', args)

  process.stdout.write('[test-db-reset] PASS\n')
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[test-db-reset] FAIL: ${msg}\n`)
  process.exit(1)
})
