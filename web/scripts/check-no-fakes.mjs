#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.resolve(ROOT, 'src')
const WAIVER_FILE = path.resolve(ROOT, 'docs/testing/no-fakes-waivers.json')

const RULES = [
  {
    id: 'fake-db-cast',
    description: 'Avoid casting unknown objects to DbClient in integration tests.',
    regex: /as\s+unknown\s+as\s+DbClient/g,
  },
  {
    id: 'fake-class',
    description: 'Avoid fake query/db classes in integration tests.',
    regex: /\bclass\s+Fake[A-Za-z0-9_]+/g,
  },
  {
    id: 'vi-mock',
    description: 'Avoid vi.mock in integration suites unless explicitly waived.',
    regex: /\bvi\.mock\s*\(/g,
  },
  {
    id: 'fake-timers',
    description: 'Avoid fake timers unless explicitly waived for deterministic boundary tests.',
    regex: /\bvi\.(useFakeTimers|setSystemTime)\s*\(/g,
  },
]

function fail(msg) {
  process.stderr.write(`[no-fakes] ${msg}\n`)
  process.exit(1)
}

function listFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFilesRecursive(p))
    else out.push(p)
  }
  return out
}

function readWaivers() {
  if (!fs.existsSync(WAIVER_FILE)) return []
  const raw = fs.readFileSync(WAIVER_FILE, 'utf8')
  const json = JSON.parse(raw)
  if (!Array.isArray(json.waivers)) return []
  return json.waivers
}

function isExpired(expiryIso) {
  const d = new Date(expiryIso)
  if (Number.isNaN(d.getTime())) return true
  return d.getTime() < Date.now()
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    fail(`Could not find src directory at ${SRC_DIR}`)
  }

  const waivers = readWaivers()
  const files = listFilesRecursive(SRC_DIR).filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))

  const violations = []

  for (const absFile of files) {
    const relFile = path.relative(ROOT, absFile).replaceAll('\\', '/')
    const text = fs.readFileSync(absFile, 'utf8')

    for (const rule of RULES) {
      const matches = [...text.matchAll(rule.regex)]
      if (matches.length === 0) continue

      const validWaiver = waivers.find(
        (w) =>
          w &&
          w.file === relFile &&
          w.rule === rule.id &&
          !isExpired(String(w.expires_on || '')),
      )

      if (validWaiver) continue

      violations.push({
        file: relFile,
        rule: rule.id,
        count: matches.length,
        description: rule.description,
      })
    }
  }

  if (violations.length > 0) {
    process.stderr.write('[no-fakes] Violations found:\n')
    for (const v of violations) {
      process.stderr.write(`  - ${v.file}: ${v.rule} x${v.count} (${v.description})\n`)
    }
    process.stderr.write(
      `[no-fakes] Add a time-bounded waiver in ${path.relative(ROOT, WAIVER_FILE)} only when strictly necessary.\n`,
    )
    process.exit(1)
  }

  process.stdout.write(`[no-fakes] OK. Checked ${files.length} test files.\n`)
}

main()
