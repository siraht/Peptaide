#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function fail(msg) {
  process.stderr.write(`[coverage-diff] ${msg}\n`)
  process.exit(1)
}

function run(bin, args, { cwd } = {}) {
  const res = spawnSync(bin, args, { cwd, encoding: 'utf8' })
  if (res.error) throw res.error
  if ((res.status ?? 0) !== 0) {
    const err = (res.stderr || res.stdout || '').trim()
    fail(`${bin} ${args.join(' ')} failed: ${err}`)
  }
  return (res.stdout || '').trim()
}

function detectRepoRoot(cwd) {
  const root = run('git', ['rev-parse', '--show-toplevel'], { cwd })
  return root ? path.resolve(root) : cwd
}

function parseLcov(lcovText) {
  const map = new Map()
  let current = null

  for (const line of String(lcovText || '').split('\n')) {
    if (!line) continue
    if (line.startsWith('SF:')) {
      current = line.slice(3).trim()
      if (!map.has(current)) map.set(current, new Map())
      continue
    }
    if (!current) continue

    if (line.startsWith('DA:')) {
      const raw = line.slice(3).split(',')
      const lineNo = Number(raw[0])
      const hits = Number(raw[1])
      if (Number.isFinite(lineNo) && Number.isFinite(hits)) {
        map.get(current).set(lineNo, hits)
      }
    }
  }

  return map
}

function parseChangedLines(diffText) {
  const fileToLines = new Map()
  let currentFile = null

  for (const line of String(diffText || '').split('\n')) {
    if (line.startsWith('diff --git ')) {
      currentFile = null
      continue
    }

    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim()
      if (!fileToLines.has(currentFile)) fileToLines.set(currentFile, new Set())
      continue
    }
    if (line.startsWith('+++ ')) {
      // Deleted files are emitted as "+++ /dev/null"; they have no new-file lines to cover.
      currentFile = null
      continue
    }

    if (!currentFile) continue
    if (!line.startsWith('@@')) continue

    // Example: @@ -10,2 +20,4 @@
    const match = line.match(/\+(\d+)(?:,(\d+))?/)
    if (!match) continue

    const start = Number(match[1])
    const count = Number(match[2] || '1')
    if (!Number.isFinite(start) || !Number.isFinite(count)) continue
    if (count === 0) continue

    const lines = fileToLines.get(currentFile)
    for (let i = 0; i < count; i += 1) {
      lines.add(start + i)
    }
  }

  return fileToLines
}

function resolveLcovPath(cwd) {
  const explicit = process.env.COVERAGE_LCOV_PATH
  if (explicit) return path.resolve(cwd, explicit)
  return path.resolve(cwd, 'coverage/lcov.info')
}

function readSourceLines(absPath) {
  if (!fs.existsSync(absPath)) return null
  return fs.readFileSync(absPath, 'utf8').split('\n')
}

function isIgnorableChangedLine(lineText) {
  const s = String(lineText || '').trim()
  if (!s) return true
  if (s.startsWith('//')) return true
  if (s.startsWith('/*') || s.startsWith('*') || s.startsWith('*/')) return true
  if (s.startsWith('import ')) return true
  if (s.startsWith('export type ')) return true
  if (s.startsWith('type ')) return true
  if (s.startsWith('interface ')) return true
  if (s.startsWith('export interface ')) return true
  // Common barrel-only lines.
  if (/^export\s*\{[^}]*\}\s*(from\s+['"][^'"]+['"])?\s*;?$/.test(s)) return true
  if (/^[{}()[\];,]+$/.test(s)) return true
  return false
}

function findCoverageHitsForFile(changedFile, lcovByFile, cwd, repoRoot) {
  const normalizedChanged = String(changedFile || '').replaceAll('\\', '/')
  const cwdBase = path.basename(cwd)
  const cwdPrefixed = `${cwdBase}/`

  const candidateAbs = new Set([
    path.resolve(cwd, normalizedChanged),
    path.resolve(repoRoot, normalizedChanged),
  ])

  if (normalizedChanged.startsWith(cwdPrefixed)) {
    candidateAbs.add(path.resolve(cwd, normalizedChanged.slice(cwdPrefixed.length)))
  }

  for (const candidate of candidateAbs) {
    const direct = lcovByFile.get(candidate)
    if (direct) return direct
  }

  for (const [lcovPath, lineHits] of lcovByFile.entries()) {
    const normalized = path.resolve(String(lcovPath || ''))
    if (candidateAbs.has(normalized)) return lineHits

    const lcovUnix = normalized.replaceAll('\\', '/')
    if (lcovUnix.endsWith(`/${normalizedChanged}`)) return lineHits
    if (normalizedChanged.startsWith(cwdPrefixed) && lcovUnix.endsWith(`/${normalizedChanged.slice(cwdPrefixed.length)}`)) {
      return lineHits
    }
  }

  return null
}

function main() {
  const cwd = process.cwd()
  const repoRoot = detectRepoRoot(cwd)
  const baseRef = process.env.COVERAGE_BASE_REF || 'HEAD~1'
  const threshold = Number(process.env.COVERAGE_DIFF_THRESHOLD || '95')

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
    fail(`Invalid COVERAGE_DIFF_THRESHOLD=${String(process.env.COVERAGE_DIFF_THRESHOLD || '')}`)
  }

  const lcovPath = resolveLcovPath(cwd)
  if (!fs.existsSync(lcovPath)) {
    fail(`Missing lcov file at ${lcovPath}. Run coverage first.`)
  }

  const diff = run('git', ['diff', '--relative', '--unified=0', baseRef, '--', '.'], { cwd })
  if (!diff.trim()) {
    process.stdout.write('[coverage-diff] No changes detected in src vs base ref.\n')
    return
  }

  const changedLinesByFile = parseChangedLines(diff)
  const lcovByFile = parseLcov(fs.readFileSync(lcovPath, 'utf8'))

  let totalChanged = 0
  let totalCovered = 0
  const missing = []

  for (const [file, changedLines] of changedLinesByFile.entries()) {
    const normalizedFile = String(file || '').replace(/^\.\/+/, '').replaceAll('\\', '/')
    if (!normalizedFile.startsWith('src/')) continue
    if (!normalizedFile.endsWith('.ts') && !normalizedFile.endsWith('.tsx')) continue
    if (normalizedFile.endsWith('.test.ts') || normalizedFile.endsWith('.test.tsx')) continue

    const absFile = path.resolve(cwd, normalizedFile)
    const sourceLines = readSourceLines(absFile)
    const lineHits = findCoverageHitsForFile(normalizedFile, lcovByFile, cwd, repoRoot)

    if (!lineHits) {
      let counted = 0
      for (const n of changedLines) {
        const src = sourceLines ? sourceLines[n - 1] : ''
        if (isIgnorableChangedLine(src)) continue
        totalChanged += 1
        counted += 1
      }
      if (counted > 0) {
        missing.push(normalizedFile)
      }
      continue
    }

    for (const n of changedLines) {
      const hits = lineHits.get(n)
      if (typeof hits !== 'number') continue
      totalChanged += 1
      if (hits > 0) totalCovered += 1
    }
  }

  if (totalChanged === 0) {
    process.stdout.write('[coverage-diff] No relevant changed source lines for diff coverage.\n')
    return
  }

  const pct = (totalCovered / totalChanged) * 100

  process.stdout.write(
    `[coverage-diff] base=${baseRef} changed=${totalChanged} covered=${totalCovered} pct=${pct.toFixed(2)} threshold=${threshold.toFixed(2)}\n`,
  )

  if (missing.length > 0) {
    process.stdout.write(`[coverage-diff] files missing from coverage report (${missing.length}):\n`)
    for (const f of missing) process.stdout.write(`  - ${f}\n`)
  }

  if (pct + 1e-9 < threshold) {
    fail(`Diff coverage ${pct.toFixed(2)}% is below threshold ${threshold.toFixed(2)}%`)
  }
}

main()
