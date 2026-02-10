#!/usr/bin/env node
/**
 * import-spreadsheetdata.mjs
 *
 * Imports a "simple events" CSV into the app via the Settings UI and then runs
 * the Inventory "Reconcile imported vials" step.
 *
 * This is meant for one-off local migrations (e.g. spreadsheetdata/peptaide_simple_events.csv)
 * into a specific user account without hand-clicking.
 *
 * Prereqs:
 * - Supabase stack running (supabase start)
 * - Next server running (default http://127.0.0.1:3002)
 *
 * Env:
 * - IMPORT_BASE_URL (default http://127.0.0.1:3002)
 * - IMPORT_MAILPIT_URL (default http://127.0.0.1:54324)
 * - IMPORT_EMAIL (default t.hinton@protonmail.com)
 * - IMPORT_CSV_PATH (default <repo>/spreadsheetdata/peptaide_simple_events.csv)
 * - IMPORT_REPLACE_EXISTING=1 (DANGEROUS: delete all existing user data before importing; default 0)
 * - IMPORT_SESSION (agent-browser session name; default peptaide-import-<timestamp>)
 * - IMPORT_ARTIFACTS_DIR (default /tmp/peptaide-import-<timestamp>)
 * - IMPORT_HEADED=1 (run headed)
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

function isTruthyEnv(x) {
  if (!x) return false
  const v = String(x).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WEB_DIR = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(WEB_DIR, '..')

const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')

const BASE_URL = process.env.IMPORT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3002'
const MAILPIT_URL = process.env.IMPORT_MAILPIT_URL || process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324'
const EMAIL = process.env.IMPORT_EMAIL || 't.hinton@protonmail.com'
const CSV_PATH =
  process.env.IMPORT_CSV_PATH || path.join(REPO_ROOT, 'spreadsheetdata', 'peptaide_simple_events.csv')

const SESSION = process.env.IMPORT_SESSION || `peptaide-import-${RUN_ID}`
const ARTIFACTS_DIR = process.env.IMPORT_ARTIFACTS_DIR || path.join('/tmp', `peptaide-import-${RUN_ID}`)
const HEADED = isTruthyEnv(process.env.IMPORT_HEADED)
const REPLACE_EXISTING = isTruthyEnv(process.env.IMPORT_REPLACE_EXISTING)

const localAgentBrowser = path.join(WEB_DIR, 'node_modules', '.bin', 'agent-browser')
const AGENT_BROWSER_BIN =
  process.env.AGENT_BROWSER_BIN || (fs.existsSync(localAgentBrowser) ? localAgentBrowser : 'agent-browser')

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function logLine(msg) {
  process.stdout.write(`${msg}\n`)
}

function fail(msg) {
  const err = new Error(msg)
  err.name = 'ImportFailure'
  throw err
}

function sleepSync(ms) {
  const n = Number(ms) || 0
  if (n <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableAgentBrowserError(stderr) {
  const s = String(stderr || '')
  return s.includes('Resource temporarily unavailable (os error 11)') || s.includes('daemon may be busy')
}

function runAgentBrowser(cmdArgs, { json = false, allowFailure = false, retries = 8 } = {}) {
  const args = ['--session', SESSION]
  if (HEADED) args.push('--headed')
  if (json) args.push('--json')
  args.push(...cmdArgs)

  const maxBuffer = 1024 * 1024 * 20

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = spawnSync(AGENT_BROWSER_BIN, args, { encoding: 'utf8', maxBuffer })
    if (result.error) throw result.error

    const stdout = (result.stdout || '').trim()
    const stderr = (result.stderr || '').trim()
    const status = result.status ?? 0

    if (status === 0 || allowFailure) return { stdout, stderr, status }

    if (attempt < retries && isRetryableAgentBrowserError(stderr)) {
      sleepSync(250 + attempt * 100)
      continue
    }

    throw new Error(stderr || stdout || `agent-browser exited with ${status}`)
  }

  return { stdout: '', stderr: '', status: 1 }
}

function extractJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function extractData(payload) {
  if (!payload) return null
  if (typeof payload === 'object' && payload && 'data' in payload) return payload.data
  return payload
}

async function evalJs(script) {
  const raw = runAgentBrowser(['eval', script], { json: true })
  const data = extractData(extractJson(raw.stdout))
  return data && typeof data === 'object' && 'result' in data ? data.result : null
}

async function waitUntil(fn, { timeoutMs = 30000, intervalMs = 250, label = 'condition' } = {}) {
  const start = Date.now()
  for (;;) {
    let ok = false
    try {
      ok = await fn()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const retryable =
        msg.includes('Execution context was destroyed') ||
        msg.includes('most likely because of a navigation') ||
        msg.includes('Cannot find context with specified id')
      if (!retryable) throw e
      ok = false
    }
    if (ok) return
    if (Date.now() - start > timeoutMs) {
      fail(`Timed out waiting for ${label} after ${timeoutMs}ms`)
    }
    await sleep(intervalMs)
  }
}

async function waitForBodyText(needle, { timeoutMs = 30000, label } = {}) {
  await waitUntil(
    async () => {
      const body = await evalJs('document.body.innerText')
      return typeof body === 'string' && body.includes(needle)
    },
    { label: label || `body text includes "${needle}"`, timeoutMs },
  )
}

function setViewport(width, height) {
  runAgentBrowser(['set', 'viewport', String(width), String(height)])
}

function open(url) {
  const retries = 3
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      runAgentBrowser(['open', url])
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const retryable =
        msg.includes('net::ERR_NETWORK_CHANGED') ||
        msg.includes('net::ERR_CONNECTION_RESET') ||
        msg.includes('net::ERR_INTERNET_DISCONNECTED')
      if (attempt < retries && retryable) {
        sleepSync(250 + attempt * 250)
        continue
      }
      throw e
    }
  }
}

function waitFor(selOrMs) {
  runAgentBrowser(['wait', String(selOrMs)])
}

function click(sel) {
  runAgentBrowser(['click', sel])
}

function fill(sel, value) {
  runAgentBrowser(['fill', sel, value])
}

function clickButtonByName(name) {
  runAgentBrowser(['find', 'role', 'button', 'click', '--name', name, '--exact'])
}

function check(sel) {
  runAgentBrowser(['check', sel])
}

function uncheck(sel) {
  runAgentBrowser(['uncheck', sel])
}

function upload(sel, ...files) {
  runAgentBrowser(['upload', sel, ...files])
}

function takeScreenshot(label) {
  const safe = label.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  const outPath = path.join(ARTIFACTS_DIR, `${safe}.png`)
  runAgentBrowser(['screenshot', outPath])
  return outPath
}

async function mailpitFetchJson(pathname) {
  const url = new URL(pathname, MAILPIT_URL)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Mailpit ${url} returned HTTP ${res.status}`)
  }
  return await res.json()
}

function extractOtpCodeFromMagicLinkText(text) {
  if (!text) return null
  const s = String(text)
  const match = s.match(/(?:enter the code:\s*)(\d{6})/i)
  if (match && match[1]) return match[1]
  const match2 = s.match(/\b(\d{6})\b/)
  if (match2 && match2[1]) return match2[1]
  return null
}

async function mailpitMessageIdsForEmail(email) {
  const list = await mailpitFetchJson('/api/v1/messages')
  const messages = Array.isArray(list.messages) ? list.messages : []
  const ids = new Set()

  for (const m of messages) {
    if (!m || !m.ID) continue
    const tos = Array.isArray(m.To) ? m.To : []
    const toMatch = tos.some((t) => t && String(t.Address || '').toLowerCase() === email.toLowerCase())
    if (toMatch) ids.add(String(m.ID))
  }

  return ids
}

async function waitForOtpEmail(email, { sinceMs, excludeIds, timeoutMs = 30000 } = {}) {
  const start = Date.now()
  for (;;) {
    const list = await mailpitFetchJson('/api/v1/messages')
    const messages = Array.isArray(list.messages) ? list.messages : []

    const match = messages.find((m) => {
      if (!m) return false
      if (excludeIds && m.ID && excludeIds.has(String(m.ID))) return false
      const created = m.Created ? Date.parse(m.Created) : null
      if (sinceMs && created && created < sinceMs) return false
      const tos = Array.isArray(m.To) ? m.To : []
      return tos.some((t) => t && String(t.Address || '').toLowerCase() === email.toLowerCase())
    })

    if (match && match.ID) {
      const msg = await mailpitFetchJson(`/api/v1/message/${match.ID}`)
      const text = msg.Text || msg.HTML || ''
      const code = extractOtpCodeFromMagicLinkText(text)
      if (!code) throw new Error(`Could not extract OTP code from Mailpit message ${match.ID}`)
      return { code }
    }

    if (Date.now() - start > timeoutMs) {
      fail(`Timed out waiting for OTP email for ${email}`)
    }

    await sleep(500)
  }
}

async function requestOtpEmail(email) {
  logLine(`auth: requesting OTP for ${email}`)
  open(`${BASE_URL}/sign-in`)
  waitFor('input[name="email"]')
  await evalJs('window.confirm = () => true')
  fill('input[name="email"]', email)

  const existingIds = await mailpitMessageIdsForEmail(email)
  const since = Date.now()
  clickButtonByName('Send sign-in link')

  return await waitForOtpEmail(email, { sinceMs: since - 2000, excludeIds: existingIds })
}

async function signInWithCode(email) {
  const { code } = await requestOtpEmail(email)
  logLine('auth: verifying OTP code')

  waitFor('input[name="code"]')
  fill('input[name="code"]', code)
  clickButtonByName('Sign in')

  await waitUntil(
    async () => {
      const url = await evalJs('window.location.href')
      return typeof url === 'string' && url.startsWith(`${BASE_URL}/today`)
    },
    { label: 'redirect to /today via code', timeoutMs: 60000 },
  )
}

async function settingsImportSimpleEventsCsv({ csvPath, replaceExisting, inferCycles }) {
  logLine(`settings: importing simple events csv (replace=${replaceExisting ? '1' : '0'})`)
  open(`${BASE_URL}/settings?tab=app`)
  await waitForBodyText('Simple import: events CSV', { label: 'settings simple import visible', timeoutMs: 60000 })
  await evalJs('window.confirm = () => true')

  if (inferCycles) check('input[data-e2e="simple-events-infer-cycles"]')
  else uncheck('input[data-e2e="simple-events-infer-cycles"]')

  if (replaceExisting) check('input[data-e2e="simple-events-replace"]')
  else uncheck('input[data-e2e="simple-events-replace"]')

  upload('input[data-e2e="simple-events-file"]', csvPath)

  click('button[data-e2e="simple-events-dry-run"]')
  await waitUntil(
    async () => {
      const text = await evalJs('document.querySelector(\'[data-e2e="simple-events-summary"]\')?.textContent || \"\"')
      return typeof text === 'string' && text.includes('mode=dry-run')
    },
    { label: 'simple events dry run', timeoutMs: 120000 },
  )

  click('button[data-e2e="simple-events-apply"]')
  await waitUntil(
    async () => {
      const err = await evalJs(
        'document.querySelector(\'[data-e2e=\"simple-events-error\"]\')?.textContent?.trim() || \"\"',
      )
      if (typeof err === 'string' && err) return true
      const text = await evalJs('document.querySelector(\'[data-e2e=\"simple-events-summary\"]\')?.textContent || \"\"')
      return typeof text === 'string' && text.includes('mode=apply')
    },
    { label: 'simple events import apply complete', timeoutMs: 180000 },
  )

  const importErr = await evalJs(
    'document.querySelector(\'[data-e2e=\"simple-events-error\"]\')?.textContent?.trim() || \"\"',
  )
  if (typeof importErr === 'string' && importErr) {
    takeScreenshot('simple-import-error')
    fail(`Simple events import failed: ${importErr}`)
  }

  const summary = await evalJs('document.querySelector(\'[data-e2e=\"simple-events-summary\"]\')?.textContent?.trim() || \"\"')
  logLine(`settings: simple import summary: ${summary}`)
}

async function inventoryReconcileImportedVials() {
  logLine('inventory: reconcile imported vial tags')
  open(`${BASE_URL}/inventory`)
  await waitForBodyText('Inventory', { label: 'inventory page visible', timeoutMs: 60000 })

  click('[data-e2e="reconcile-imported-vials-submit"]')

  await waitUntil(
    async () => {
      const err = await evalJs(
        'document.querySelector(\'[data-e2e=\"reconcile-imported-vials-error\"]\')?.textContent?.trim() || \"\"',
      )
      if (typeof err === 'string' && err) return true

      const ok = await evalJs(
        'document.querySelector(\'[data-e2e=\"reconcile-imported-vials-success\"]\')?.textContent?.trim() || \"\"',
      )
      return typeof ok === 'string' && ok.includes('Reconciled imported vial tags')
    },
    { label: 'inventory reconcile completion', timeoutMs: 240000 },
  )

  const err = await evalJs(
    'document.querySelector(\'[data-e2e=\"reconcile-imported-vials-error\"]\')?.textContent?.trim() || \"\"',
  )
  if (typeof err === 'string' && err) {
    takeScreenshot('reconcile-imported-vials-error')
    fail(`Reconcile imported vials failed: ${err}`)
  }

  await waitUntil(
    async () => Boolean(await evalJs('document.body.innerText.includes(\"vial_\")')),
    { label: 'inventory shows vial_# lots', timeoutMs: 120000 },
  )
}

async function main() {
  ensureDir(ARTIFACTS_DIR)
  logLine(`run_id: ${RUN_ID}`)
  logLine(`base_url: ${BASE_URL}`)
  logLine(`mailpit_url: ${MAILPIT_URL}`)
  logLine(`email: ${EMAIL}`)
  logLine(`csv: ${CSV_PATH}`)
  logLine(`replace_existing: ${REPLACE_EXISTING ? '1' : '0'}`)
  logLine(`session: ${SESSION}`)
  logLine(`artifacts_dir: ${ARTIFACTS_DIR}`)

  if (!fs.existsSync(CSV_PATH)) {
    fail(`CSV file not found: ${CSV_PATH}`)
  }

  // Clean any existing browser for this session.
  runAgentBrowser(['close'], { allowFailure: true })
  setViewport(1280, 720)

  await signInWithCode(EMAIL)
  takeScreenshot('signed-in-today')

  await settingsImportSimpleEventsCsv({ csvPath: CSV_PATH, replaceExisting: REPLACE_EXISTING, inferCycles: true })
  takeScreenshot('after-simple-import-settings')

  await inventoryReconcileImportedVials()
  takeScreenshot('after-reconcile-inventory')

  open(`${BASE_URL}/analytics`)
  await waitForBodyText('Analytics', { label: 'analytics page visible', timeoutMs: 60000 })
  takeScreenshot('analytics-after-import')

  logLine('PASS: spreadsheetdata import + reconcile completed')
}

main()
  .catch((err) => {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'Error'
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${name}: ${msg}\n`)
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`)
    }
    process.exit(1)
  })
  .finally(() => {
    try {
      runAgentBrowser(['close'], { allowFailure: true })
    } catch {
      // ignore
    }
  })
