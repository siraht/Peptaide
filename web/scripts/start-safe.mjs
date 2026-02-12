#!/usr/bin/env node

import { spawnSync, spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const DEFAULT_PORT = 3002
const DEFAULT_HOST = '0.0.0.0'

function parseArgs(argv) {
  const opts = {
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--port') {
      const n = Number(argv[i + 1])
      if (Number.isFinite(n) && n > 0) opts.port = Math.floor(n)
      i += 1
    } else if (arg === '--host') {
      const value = String(argv[i + 1] || '').trim()
      if (value) opts.host = value
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'Usage: node scripts/start-safe.mjs [options]',
          '',
          'Options:',
          '  --port <number>   Port to bind (default: 3002)',
          '  --host <host>     Host to bind (default: 0.0.0.0)',
        ].join('\n') + '\n',
      )
      process.exit(0)
    }
  }

  return opts
}

function parsePidFromSsOutput(output, port) {
  const lines = String(output || '').split('\n')
  for (const line of lines) {
    if (!line.includes(`:${port}`)) continue
    const match = line.match(/pid=(\d+)/)
    if (match) {
      const pid = Number(match[1])
      if (Number.isFinite(pid) && pid > 0) return pid
    }
  }
  return null
}

function findPidOnPort(port) {
  const cmd = `ss -ltnpH 'sport = :${port}'`
  const res = spawnSync('bash', ['-lc', cmd], { encoding: 'utf8' })
  if (res.error) throw res.error
  const pidFromSs = parsePidFromSsOutput(res.stdout, port)
  if (pidFromSs) return pidFromSs

  const fuser = spawnSync('bash', ['-lc', `fuser ${port}/tcp 2>/dev/null | awk '{print $1}'`], { encoding: 'utf8' })
  if (fuser.error) throw fuser.error
  const pidFromFuser = Number(String(fuser.stdout || '').trim())
  if (Number.isFinite(pidFromFuser) && pidFromFuser > 0) return pidFromFuser

  return null
}

function tryKill(pid, signal) {
  try {
    process.kill(pid, signal)
    return true
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code || '') : ''
    if (code === 'ESRCH') return false
    throw err
  }
}

async function ensurePortFree(port) {
  const pid = findPidOnPort(port)
  if (!pid) {
    process.stdout.write(`[start-safe] port ${port} already free\n`)
    return
  }

  if (pid === process.pid) {
    throw new Error(`Refusing to kill current process pid=${pid}`)
  }

  process.stdout.write(`[start-safe] found pid=${pid} on port ${port}; sending SIGTERM\n`)
  tryKill(pid, 'SIGTERM')

  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const remainingPid = findPidOnPort(port)
    if (!remainingPid) {
      process.stdout.write(`[start-safe] port ${port} released after SIGTERM\n`)
      return
    }
    await sleep(300)
  }

  const stillPid = findPidOnPort(port)
  if (stillPid) {
    process.stdout.write(`[start-safe] pid=${stillPid} still bound on ${port}; sending SIGKILL\n`)
    tryKill(stillPid, 'SIGKILL')
    await sleep(300)
  }

  const finalPid = findPidOnPort(port)
  if (finalPid) {
    throw new Error(`Port ${port} is still occupied by pid=${finalPid}`)
  }

  process.stdout.write(`[start-safe] port ${port} released after SIGKILL\n`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  await ensurePortFree(opts.port)

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const args = ['run', 'start', '--', '-p', String(opts.port), '-H', opts.host]

  process.stdout.write(`[start-safe] launching: ${npmBin} ${args.join(' ')}\n`)

  const child = spawn(npmBin, args, {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[start-safe] FAIL: ${message}\n`)
  process.exit(1)
})
