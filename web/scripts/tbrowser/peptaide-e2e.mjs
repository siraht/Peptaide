#!/usr/bin/env node
/**
 * Conclusive browser verification for Peptaide (t-browser style).
 *
 * Uses agent-browser (Playwright CLI) to:
 * - sign in via Supabase OTP (magic link + code) retrieved from Mailpit
 * - exercise core CRUD + logging flows
 * - validate RLS isolation by signing in as a second user
 * - verify data portability via export/import/delete flows
 * - sweep all major pages at desktop + mobile viewports
 *
 * The run fails if it detects any console errors or any failed (4xx/5xx) network requests
 * on the swept pages.
 *
 * Prereqs (run outside this script):
 * - supabase start
 * - next server running at E2E_BASE_URL (default http://127.0.0.1:3002)
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

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3002'
const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324'
const EMAIL_A = process.env.E2E_EMAIL_A || 'e2e.a@example.com'
const EMAIL_B = process.env.E2E_EMAIL_B || 'e2e.b@example.com'

const SESSION = process.env.E2E_SESSION || `peptaide-e2e-${RUN_ID}`
const ARTIFACTS_DIR = process.env.E2E_ARTIFACTS_DIR || path.join('/tmp', `peptaide-e2e-${RUN_ID}`)

const HEADED = isTruthyEnv(process.env.E2E_HEADED)
const FULL_SCREENSHOT = isTruthyEnv(process.env.E2E_FULL)
const SKIP_DB_RESET = isTruthyEnv(process.env.E2E_SKIP_DB_RESET)

const localAgentBrowser = path.join(WEB_DIR, 'node_modules', '.bin', 'agent-browser')
const AGENT_BROWSER_BIN =
  process.env.AGENT_BROWSER_BIN || (fs.existsSync(localAgentBrowser) ? localAgentBrowser : 'agent-browser')

function sleepSync(ms) {
  const n = Number(ms) || 0
  if (n <= 0) return
  // Synchronous sleep without pulling in extra deps.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
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

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = spawnSync(AGENT_BROWSER_BIN, args, { encoding: 'utf8' })
    if (result.error) throw result.error

    const stdout = (result.stdout || '').trim()
    const stderr = (result.stderr || '').trim()
    const status = result.status ?? 0

    if (status === 0 || allowFailure) {
      return { stdout, stderr, status }
    }

    if (attempt < retries && isRetryableAgentBrowserError(stderr)) {
      sleepSync(250 + attempt * 100)
      continue
    }

    throw new Error(stderr || stdout || `agent-browser exited with ${status}`)
  }

  // Unreachable (loop throws or returns), but keep TS/linters happy.
  return { stdout: '', stderr: '', status: 1 }
}

function runCmd(bin, args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', cwd })
  if (result.error) throw result.error
  const stdout = (result.stdout || '').trim()
  const stderr = (result.stderr || '').trim()
  const status = result.status ?? 0
  if (status !== 0 && !allowFailure) {
    throw new Error(stderr || stdout || `${bin} exited with ${status}`)
  }
  return { stdout, stderr, status }
}

async function resetLocalSupabaseDb() {
  if (SKIP_DB_RESET) {
    logLine('supabase: skipping db reset (E2E_SKIP_DB_RESET=1)')
    return
  }

  logLine('supabase: ensuring local dev stack is running')
  runCmd('supabase', ['start'], { cwd: REPO_ROOT, allowFailure: true })

  // `supabase db reset` can transiently 502 while the local gateway restarts. Prefer a longer
  // retry loop so the "conclusive" run is resilient to local infra flakiness.
  const maxAttempts = 10
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logLine(`supabase: db reset (local) --yes (attempt ${attempt}/${maxAttempts})`)
    const res = runCmd('supabase', ['db', 'reset', '--yes'], { cwd: REPO_ROOT, allowFailure: true })
    if (res.status === 0) return

    const stderr = res.stderr || ''
    const isTransient502 =
      stderr.includes('Error status 502') || stderr.includes('invalid response was received from the upstream server')

    if (!isTransient502) {
      fail(`supabase db reset failed (exit ${res.status}). stderr: ${stderr}`)
    }

    if (attempt < maxAttempts) {
      const waitMs = 4000 + attempt * 2500
      logLine(`supabase: transient 502 during reset; retrying after ${waitMs}ms`)
      await sleep(waitMs)
    }
  }

  fail('supabase db reset failed after repeated transient 502s; check local supabase health')
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function logLine(msg) {
  process.stdout.write(`${msg}\n`)
}

function fail(msg) {
  const err = new Error(msg)
  err.name = 'E2EFailure'
  throw err
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function screenshotPath(label) {
  const safe = label.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  return path.join(ARTIFACTS_DIR, `${safe}.png`)
}

function takeScreenshot(label) {
  const outPath = screenshotPath(label)
  const args = ['screenshot', outPath]
  if (FULL_SCREENSHOT) args.push('--full')
  runAgentBrowser(args)
  return outPath
}

function clearDiagnostics() {
  runAgentBrowser(['console', '--clear'], { allowFailure: true })
  runAgentBrowser(['errors', '--clear'], { allowFailure: true })
  // `network requests` currently requires a non-null filter; '.' matches all.
  runAgentBrowser(['network', 'requests', '--clear', '--filter', '.'], { allowFailure: true })
}

function normalizeConsole(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.messages)) return data.messages
  if (Array.isArray(data.logs)) return data.logs
  return []
}

function normalizeErrors(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.errors)) return data.errors
  return []
}

function normalizeNetwork(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.requests)) return data.requests
  if (Array.isArray(data.entries)) return data.entries
  return []
}

function pickText(obj) {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.text || obj.title || obj.value || obj.url || obj.name || ''
}

function collectDiagnostics() {
  const consoleRaw = runAgentBrowser(['console'], { json: true, allowFailure: true })
  const errorsRaw = runAgentBrowser(['errors'], { json: true, allowFailure: true })
  const networkRaw = runAgentBrowser(['network', 'requests', '--filter', '.'], {
    json: true,
    allowFailure: true,
  })
  const titleRaw = runAgentBrowser(['get', 'title'], { json: true, allowFailure: true })
  const urlRaw = runAgentBrowser(['get', 'url'], { json: true, allowFailure: true })

  const consoleData = extractData(extractJson(consoleRaw.stdout))
  const errorsData = extractData(extractJson(errorsRaw.stdout))
  const networkData = extractData(extractJson(networkRaw.stdout))
  const titleData = extractData(extractJson(titleRaw.stdout))
  const urlData = extractData(extractJson(urlRaw.stdout))

  const consoleMsgs = normalizeConsole(consoleData)
  const pageErrors = normalizeErrors(errorsData)
  const requests = normalizeNetwork(networkData)

  const consoleErrors = []
  const consoleWarnings = []
  for (const m of consoleMsgs) {
    const level = String(m.type || m.level || m.kind || '').toLowerCase()
    const text = String(m.text || m.message || m.msg || '')
    if (!text) continue
    if (level.includes('error')) consoleErrors.push(text)
    else if (level.includes('warn')) consoleWarnings.push(text)
  }

  const errorTexts = []
  for (const e of pageErrors) {
    const text = String(e.text || e.message || e.msg || e.error || '')
    if (text) errorTexts.push(text)
  }

  const failedRequests = []
  for (const r of requests) {
    const status = Number(r.status ?? r.statusCode ?? 0)
    if (Number.isFinite(status) && status >= 400) {
      failedRequests.push({
        method: String(r.method || r.requestMethod || 'GET'),
        url: String(r.url || ''),
        status,
      })
    }
  }

  return {
    pageTitle: pickText(titleData) || '(unknown)',
    pageUrl: pickText(urlData) || '(unknown)',
    consoleErrors,
    consoleWarnings,
    pageErrors: errorTexts,
    failedRequests,
  }
}

function writeDiagSummary(label, diag) {
  const lines = []
  lines.push(`page: ${label}`)
  lines.push(`title: ${diag.pageTitle}`)
  lines.push(`url: ${diag.pageUrl}`)
  lines.push(`console_errors: ${diag.consoleErrors.length}`)
  lines.push(`page_errors: ${diag.pageErrors.length}`)
  lines.push(`console_warnings: ${diag.consoleWarnings.length}`)
  lines.push(`failed_requests: ${diag.failedRequests.length}`)
  if (diag.consoleErrors.length) lines.push(`console_errors_sample: ${diag.consoleErrors[0]}`)
  if (diag.pageErrors.length) lines.push(`page_errors_sample: ${diag.pageErrors[0]}`)
  if (diag.failedRequests.length) {
    const r = diag.failedRequests[0]
    lines.push(`failed_requests_sample: ${r.method} ${r.status} ${r.url}`)
  }
  fs.writeFileSync(path.join(ARTIFACTS_DIR, `${label}.diag.txt`), `${lines.join('\n')}\n`)
}

function assertHealthy(label, { allowWarnings = true } = {}) {
  const diag = collectDiagnostics()
  writeDiagSummary(label, diag)

  if (diag.consoleErrors.length > 0) {
    fail(`Console errors detected on ${label}: ${diag.consoleErrors[0]}`)
  }
  if (diag.pageErrors.length > 0) {
    fail(`Page errors detected on ${label}: ${diag.pageErrors[0]}`)
  }
  if (diag.failedRequests.length > 0) {
    const r = diag.failedRequests[0]
    fail(`Failed network request on ${label}: ${r.method} ${r.status} ${r.url}`)
  }

  if (!allowWarnings && diag.consoleWarnings.length > 0) {
    fail(`Console warnings detected on ${label}: ${diag.consoleWarnings[0]}`)
  }

  return diag
}

function setViewport(width, height) {
  runAgentBrowser(['set', 'viewport', String(width), String(height)])
}

function isRetryableNavigationError(e) {
  const msg = e instanceof Error ? e.message : String(e)
  return (
    msg.includes('net::ERR_NETWORK_CHANGED') ||
    msg.includes('net::ERR_CONNECTION_RESET') ||
    msg.includes('net::ERR_INTERNET_DISCONNECTED')
  )
}

function open(url) {
  const retries = 3
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      clearDiagnostics()
      runAgentBrowser(['open', url])
      return
    } catch (e) {
      if (attempt < retries && isRetryableNavigationError(e)) {
        const waitMs = 250 + attempt * 250
        logLine(`nav: transient error; retrying open after ${waitMs}ms`)
        sleepSync(waitMs)
        continue
      }
      throw e
    }
  }
}

function waitFor(selectorOrMs) {
  runAgentBrowser(['wait', String(selectorOrMs)])
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

function click(sel) {
  runAgentBrowser(['click', sel])
}

function clickButtonByName(name) {
  runAgentBrowser(['find', 'role', 'button', 'click', '--name', name, '--exact'])
}

function clickLinkByName(name) {
  runAgentBrowser(['find', 'role', 'link', 'click', '--name', name, '--exact'])
}

function clickFirst(selector) {
  runAgentBrowser(['find', 'first', selector, 'click'])
}

function fill(sel, value) {
  runAgentBrowser(['fill', sel, value])
}

function type(sel, value) {
  runAgentBrowser(['type', sel, value])
}

function press(key) {
  runAgentBrowser(['press', key])
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

function getCookies() {
  const raw = runAgentBrowser(['cookies', 'get'], { json: true })
  const data = extractData(extractJson(raw.stdout))
  const cookies = data && typeof data === 'object' && Array.isArray(data.cookies) ? data.cookies : []
  return cookies
}

function cookieHeaderForUrl(url) {
  const u = new URL(url)
  const host = u.hostname
  const isHttps = u.protocol === 'https:'

  const cookies = getCookies()
  const pairs = []

  for (const c of cookies) {
    if (!c || typeof c !== 'object') continue

    const name = String(c.name || '')
    const value = String(c.value || '')
    if (!name) continue

    const domainRaw = String(c.domain || '')
    const domain = domainRaw.startsWith('.') ? domainRaw.slice(1) : domainRaw
    if (domain && domain !== host && !host.endsWith(`.${domain}`)) continue

    const secure = Boolean(c.secure)
    if (secure && !isHttps) continue

    const pathName = String(c.path || '/')
    if (!u.pathname.startsWith(pathName)) continue

    pairs.push(`${name}=${value}`)
  }

  return pairs.join('; ')
}

async function evalJs(script) {
  const raw = runAgentBrowser(['eval', script], { json: true })
  const data = extractData(extractJson(raw.stdout))
  return data && typeof data === 'object' && 'result' in data ? data.result : null
}

async function waitUntil(fn, { timeoutMs = 30000, intervalMs = 250, label = 'condition' } = {}) {
  const start = Date.now()
  for (;;) {
    const ok = await fn()
    if (ok) return
    if (Date.now() - start > timeoutMs) {
      fail(`Timed out waiting for ${label} after ${timeoutMs}ms`)
    }
    await sleep(intervalMs)
  }
}

async function mailpitFetchJson(pathname) {
  const url = new URL(pathname, MAILPIT_URL)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Mailpit ${url} returned HTTP ${res.status}`)
  }
  return await res.json()
}

function extractFirstUrlFromMagicLinkText(text) {
  if (!text) return null
  // Prefer the verify link inside parentheses in Mailpit's plain text.
  const match = String(text).match(/\(\s*(https?:\/\/[^\s)]+)\s*\)/)
  if (match && match[1]) return match[1]
  // Fallback: first URL-ish token.
  const match2 = String(text).match(/https?:\/\/\S+/)
  if (match2 && match2[0]) return match2[0]
  return null
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
      const link = extractFirstUrlFromMagicLinkText(text)
      const code = extractOtpCodeFromMagicLinkText(text)
      if (!link || !code) {
        throw new Error(`Could not extract magic link URL and code from Mailpit message ${match.ID}`)
      }
      return { link, code }
    }

    if (Date.now() - start > timeoutMs) {
      fail(`Timed out waiting for magic link email for ${email}`)
    }

    await sleep(500)
  }
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

function isLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1'
}

function assertMagicLinkHostMatchesScenario(magicLink) {
  const baseHost = new URL(BASE_URL).hostname
  const magicHost = new URL(magicLink).hostname

  // This is the class of failure we care about for remote clients: webapp is not local, but the
  // auth verify URL points at 127.0.0.1/localhost (which would refer to the *client* machine).
  if (!isLocalHostname(baseHost) && isLocalHostname(magicHost)) {
    fail(`magic link host is local (${magicHost}) but base url host is remote (${baseHost}). Fix supabase [api].external_url.`)
  }
}

async function requestOtpEmail(email) {
  logLine(`auth: requesting OTP for ${email}`)
  open(`${BASE_URL}/sign-in`)
  waitFor('input[name="email"]')

  await evalJs('window.confirm = () => true')

  fill('input[name="email"]', email)
  // Mailpit runs in a different container and can have minor clock skew; tracking existing IDs
  // is more reliable than a strict timestamp filter.
  const existingIds = await mailpitMessageIdsForEmail(email)
  const since = Date.now()
  clickButtonByName('Send sign-in link')

  const { link, code } = await waitForOtpEmail(email, { sinceMs: since - 2000, excludeIds: existingIds })
  assertMagicLinkHostMatchesScenario(link)
  return { link, code }
}

async function signInWithMagicLink(email) {
  const { link } = await requestOtpEmail(email)
  logLine('auth: opening magic link')
  open(link)

  await waitUntil(
    async () => {
      const url = await evalJs('window.location.href')
      return typeof url === 'string' && url.startsWith(`${BASE_URL}/today`)
    },
    { label: 'redirect to /today' },
  )
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
    { label: 'redirect to /today via code' },
  )
}

async function signOut() {
  logLine('auth: signing out')
  // The header is always present in the authed app layout.
  clickButtonByName('Sign out')
  await waitUntil(
    async () => {
      const url = await evalJs('window.location.href')
      return typeof url === 'string' && url.startsWith(`${BASE_URL}/sign-in`)
    },
    { label: 'redirect to /sign-in' },
  )
}

async function seedDemoDataIfAvailable() {
  // After auth callback, /today can take a moment to fully render/hydrate.
  // Wait for either the empty-state or the grid before deciding whether to seed.
  await waitUntil(
    async () => {
      const body = await evalJs('document.body.innerText')
      if (typeof body !== 'string') return false
      return body.includes('Seed demo data') || body.includes('Log (grid)') || body.includes('No formulations exist yet')
    },
    { label: 'today content rendered' },
  )

  const hasSeed = await evalJs('document.body.innerText.includes("Seed demo data")')
  if (!hasSeed) return
  logLine('today: seeding demo data')
  clickButtonByName('Seed demo data')
  await waitUntil(
    async () => {
      const hasGrid = await evalJs('document.body.innerText.includes("Log (grid)")')
      return Boolean(hasGrid)
    },
    { label: 'today grid after seeding', timeoutMs: 45000 },
  )
}

async function createDistribution({ name, valueType, distType, p1 }) {
  logLine(`dist: creating ${name}`)
  open(`${BASE_URL}/distributions`)
  waitFor('input[name="name"]')
  fill('input[name="name"]', name)
  runAgentBrowser(['select', 'select[name="value_type"]', valueType])
  runAgentBrowser(['select', 'select[name="dist_type"]', distType])
  // For point, p1 is the Value field; for other dist types this helper isn't used.
  fill('input[name="p1"]', String(p1))
  clickButtonByName('Create')
  await waitForBodyText('Created', { label: `distribution created: ${name}` })
}

async function tagSetupForms(requiredTags) {
  const res = await evalJs(
    `(() => {
      function tagByButtonText(text, tag) {
        const btn = Array.from(document.querySelectorAll('button'))
          .find((b) => (b.textContent || '').trim() === text)
        const form = btn ? btn.closest('form') : null
        if (!form) return false
        form.setAttribute('data-e2e-form', tag)
        return true
      }

      return {
        routes: tagByButtonText('Add routes', 'routes'),
        formulations: tagByButtonText('Add formulations', 'formulations'),
        vial: tagByButtonText('Create', 'vial'),
        ba: tagByButtonText('Save spec', 'ba'),
        cal: tagByButtonText('Create calibration', 'cal'),
        mod: tagByButtonText('Save modifier', 'mod'),
      }
    })()`,
  )
  if (!res || typeof res !== 'object') return
  const required = Array.isArray(requiredTags) ? requiredTags : []
  const missing = required.filter((k) => !res[k])
  if (missing.length > 0) {
    fail(`Could not tag setup forms: missing=${missing.join(',')}`)
  }
}

async function bulkAddRoutes({ names, defaultKind, defaultUnit, supportsCalibration }) {
  logLine('setup: bulk-adding routes')
  open(`${BASE_URL}/setup`)
  waitFor('textarea[name="lines"]')

  await tagSetupForms(['routes'])

  const formSel = 'form[data-e2e-form="routes"]'
  fill(`${formSel} textarea[name="lines"]`, names.join('\n'))
  runAgentBrowser(['select', `${formSel} select[name="default_input_kind"]`, defaultKind])
  fill(`${formSel} input[name="default_input_unit"]`, defaultUnit)
  if (supportsCalibration) {
    check(`${formSel} input[name="supports_device_calibration"]`)
  } else {
    uncheck(`${formSel} input[name="supports_device_calibration"]`)
  }
  click(`${formSel} button[type="submit"]`)
  // Wait for a success message.
  await waitForBodyText('Created', { label: 'routes bulk-add success' })
}

async function createDevice({ name, kind, defaultUnit }) {
  logLine(`device: creating ${name}`)
  open(`${BASE_URL}/devices`)
  waitFor('input[name="name"]')
  fill('input[name="name"]', name)
  runAgentBrowser(['select', 'select[name="device_kind"]', kind])
  fill('input[name="default_unit"]', defaultUnit)
  clickButtonByName('Create')
  await waitForBodyText('Created', { label: `device created: ${name}` })
}

async function selectOptionValue(selectSelector, matchText) {
  const options = await evalJs(
    `Array.from(document.querySelectorAll(${JSON.stringify(selectSelector)} + " option")).map(o => ({ value: o.value, text: (o.textContent || '').trim() }))`,
  )
  if (!Array.isArray(options)) {
    fail(`Could not read options for ${selectSelector}`)
  }
  const found = options.find((o) => o && typeof o.text === 'string' && o.text.includes(matchText))
  if (!found || !found.value) {
    fail(`Could not find option containing "${matchText}" in ${selectSelector}`)
  }
  return found.value
}

async function bulkAddFormulation({ formulationName, substanceLabelIncludes, routeLabelIncludes, deviceLabelIncludes }) {
  logLine(`setup: creating formulation ${formulationName}`)
  open(`${BASE_URL}/setup`)
  waitFor('textarea[name="lines"]')

  await tagSetupForms(['formulations'])
  const formSel = 'form[data-e2e-form="formulations"]'

  // Choose the correct substance/route/device by label matching.
  const substanceId = await selectOptionValue(`${formSel} select[name="substance_id"]`, substanceLabelIncludes)
  const routeId = await selectOptionValue(`${formSel} select[name="route_id"]`, routeLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="substance_id"]`, substanceId])
  runAgentBrowser(['select', `${formSel} select[name="route_id"]`, routeId])

  if (deviceLabelIncludes) {
    const deviceId = await selectOptionValue(`${formSel} select[name="device_id"]`, deviceLabelIncludes)
    runAgentBrowser(['select', `${formSel} select[name="device_id"]`, deviceId])
  }

  fill(`${formSel} textarea[name="lines"]`, formulationName)
  click(`${formSel} button[type="submit"]`)
  await waitForBodyText('Created', { label: 'formulations bulk-add success' })
}

async function createVial({ formulationLabelIncludes, massValue, massUnit, volumeValue, volumeUnit, costUsd }) {
  logLine('setup: creating vial')
  open(`${BASE_URL}/setup`)
  waitFor('select[name="formulation_id"]')

  await tagSetupForms(['vial'])
  const formSel = 'form[data-e2e-form="vial"]'

  const formulationId = await selectOptionValue(`${formSel} select[name="formulation_id"]`, formulationLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="formulation_id"]`, formulationId])
  runAgentBrowser(['select', `${formSel} select[name="status"]`, 'active'])
  fill(`${formSel} input[name="content_mass_value"]`, String(massValue))
  runAgentBrowser(['select', `${formSel} select[name="content_mass_unit"]`, massUnit])
  fill(`${formSel} input[name="total_volume_value"]`, String(volumeValue))
  runAgentBrowser(['select', `${formSel} select[name="total_volume_unit"]`, volumeUnit])
  fill(`${formSel} input[name="cost_usd"]`, String(costUsd))
  click(`${formSel} button[type="submit"]`)
  await waitForBodyText('Created', { label: 'vial create success' })
}

async function addBaseBaSpec({ substanceLabelIncludes, routeLabelIncludes, distLabelIncludes }) {
  logLine('setup: adding base bioavailability spec')
  open(`${BASE_URL}/setup`)
  // Ensure the BA spec form is visible.
  waitFor('select[name="base_fraction_dist_id"]')

  await tagSetupForms(['ba'])
  const formSel = 'form[data-e2e-form="ba"]'

  const substanceId = await selectOptionValue(`${formSel} select[name="substance_id"]`, substanceLabelIncludes)
  const routeId = await selectOptionValue(`${formSel} select[name="route_id"]`, routeLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="substance_id"]`, substanceId])
  runAgentBrowser(['select', `${formSel} select[name="route_id"]`, routeId])
  runAgentBrowser(['select', `${formSel} select[name="compartment"]`, 'systemic'])

  const distId = await selectOptionValue(`${formSel} select[name="base_fraction_dist_id"]`, distLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="base_fraction_dist_id"]`, distId])
  click(`${formSel} button[type="submit"]`)
  await waitForBodyText('Saved', { label: 'ba spec saved' })
}

async function addDeviceCalibration({ deviceLabelIncludes, routeLabelIncludes, unitLabel, distLabelIncludes }) {
  logLine('setup: adding device calibration')
  open(`${BASE_URL}/setup`)
  // The calibration form is only rendered if there is at least one calibration route and a volume dist.
  waitFor('select[name="volume_ml_per_unit_dist_id"]')

  await tagSetupForms(['cal'])
  const formSel = 'form[data-e2e-form="cal"]'

  const deviceId = await selectOptionValue(`${formSel} select[name="device_id"]`, deviceLabelIncludes)
  const routeId = await selectOptionValue(`${formSel} select[name="route_id"]`, routeLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="device_id"]`, deviceId])
  runAgentBrowser(['select', `${formSel} select[name="route_id"]`, routeId])
  fill(`${formSel} input[name="unit_label"]`, unitLabel)

  const distId = await selectOptionValue(`${formSel} select[name="volume_ml_per_unit_dist_id"]`, distLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="volume_ml_per_unit_dist_id"]`, distId])
  click(`${formSel} button[type="submit"]`)
  await waitForBodyText('Created', { label: 'calibration created' })
}

async function addFormulationModifier({ formulationLabelIncludes, distLabelIncludes }) {
  logLine('setup: adding formulation modifier spec')
  open(`${BASE_URL}/setup`)
  waitFor('select[name="multiplier_dist_id"]')

  await tagSetupForms(['mod'])
  const formSel = 'form[data-e2e-form="mod"]'

  const formulationId = await selectOptionValue(`${formSel} select[name="formulation_id"]`, formulationLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="formulation_id"]`, formulationId])
  runAgentBrowser(['select', `${formSel} select[name="compartment"]`, 'both'])
  const distId = await selectOptionValue(`${formSel} select[name="multiplier_dist_id"]`, distLabelIncludes)
  runAgentBrowser(['select', `${formSel} select[name="multiplier_dist_id"]`, distId])
  click(`${formSel} button[type="submit"]`)
  await waitForBodyText('Saved', { label: 'modifier saved' })
}

async function logEventInTodayGrid({ formulationLabelIncludes, rowIndex1Based, inputText }) {
  open(`${BASE_URL}/today`)
  await waitForBodyText('Log (grid)', { label: 'today grid visible' })

  // Override confirm for cycle prompts (default-yes for e2e).
  await evalJs('window.confirm = () => true')

  const row = rowIndex1Based
  const formulationSel = `select[aria-label="Formulation row ${row}"]`
  const doseSel = `input[aria-label="Dose row ${row}"]`

  if (formulationLabelIncludes) {
    const options = await evalJs(
      `Array.from(document.querySelectorAll(${JSON.stringify(formulationSel)} + " option")).map(o => ({ value: o.value, text: (o.textContent || '').trim() }))`,
    )
    if (!Array.isArray(options)) fail('Could not read formulation options on /today grid')
    const found = options.find((o) => o && typeof o.text === 'string' && o.text.includes(formulationLabelIncludes))
    if (!found || !found.value) {
      fail(`Could not find /today formulation option containing "${formulationLabelIncludes}"`)
    }
    runAgentBrowser(['select', formulationSel, found.value])
  }

  click(doseSel)
  fill(doseSel, inputText)
  press('Enter')

  await waitUntil(
    async () => {
      const ok = await evalJs(
        `(() => {
          const input = document.querySelector(${JSON.stringify(doseSel)})
          const row = input ? input.closest('tr') : null
          const statusCell = row ? row.querySelector('td:last-child') : null
          return Boolean(statusCell && (statusCell.textContent || '').includes('Saved'))
        })()`,
      )
      return Boolean(ok)
    },
    { label: `today grid save row ${row}` },
  )
}

async function deleteAndRestoreFirstTodayEvent() {
  logLine('today: delete + restore first event')
  open(`${BASE_URL}/today`)
  await waitForBodyText('Today log', { label: 'today log table visible' })

  // Delete one event.
  clickFirst('button:has-text("Delete")')
  await waitUntil(
    async () => {
      const hasShowDeleted = await evalJs('document.body.innerText.includes("Show deleted")')
      return Boolean(hasShowDeleted)
    },
    { label: 'today after delete' },
  )

  // Toggle "Show deleted" and restore.
  clickLinkByName('Show deleted')
  await waitUntil(
    async () => {
      const hasRestore = await evalJs('document.body.innerText.includes("Restore")')
      return Boolean(hasRestore)
    },
    { label: 'deleted events view' },
  )
  clickFirst('button:has-text("Restore")')
  await waitUntil(
    async () => {
      const hasHideDeleted = await evalJs('document.body.innerText.includes("Hide deleted")')
      return Boolean(hasHideDeleted)
    },
    { label: 'after restore' },
  )
}

async function cycleSplitAndEnd() {
  logLine('cycles: open first cycle, split, end')
  open(`${BASE_URL}/cycles`)
  await waitForBodyText('Cycles', { label: 'cycles page visible' })

  const cycleHref = await evalJs('document.querySelector(\'a[href^="/cycles/"]\')?.getAttribute("href")')
  if (typeof cycleHref !== 'string' || !cycleHref.startsWith('/cycles/')) {
    fail('Could not find a cycle link on /cycles')
  }

  open(`${BASE_URL}${cycleHref}`)
  await waitForBodyText('Summary', { label: 'cycle detail visible' })

  // Split at the first event (if available).
  const hasSplit = await evalJs('document.body.innerText.includes("Split cycle here")')
  if (hasSplit) {
    clickFirst('button:has-text("Split cycle here")')
    await waitUntil(
      async () => {
        const url = await evalJs('window.location.pathname')
        return typeof url === 'string' && url.startsWith('/cycles/')
      },
      { label: 'redirect after split' },
    )
    await waitForBodyText('Summary', { label: 'cycle detail visible after split' })
  }

  // End the (current) cycle.
  const canEnd = await evalJs('document.body.innerText.includes("End cycle now")')
  if (canEnd) {
    clickButtonByName('End cycle now')
    await waitForBodyText('Summary', { label: 'cycle detail visible after end' })
  }
}

async function ordersCreateAndGenerateVials({ substanceLabelIncludes, formulationLabelIncludes }) {
  logLine('orders: vendor + order + item + generate vials')
  open(`${BASE_URL}/orders`)
  await waitForBodyText('Orders', { label: 'orders page visible' })

  async function tagOrdersForm(headingText, tag) {
    const ok = await evalJs(
      `(() => {
        const h = Array.from(document.querySelectorAll('h2'))
          .find((el) => (el.textContent || '').trim() === ${JSON.stringify(headingText)})
        const card = h ? h.closest('div') : null
        const form = card ? card.querySelector('form') : null
        if (!form) return false
        form.setAttribute('data-e2e-form', ${JSON.stringify(tag)})
        return true
      })()`,
    )
    if (!ok) fail(`Could not tag orders form: heading="${headingText}" tag="${tag}"`)
    return `form[data-e2e-form="${tag}"]`
  }

  const vendorForm = await tagOrdersForm('Add vendor', 'vendor')

  // Vendor
  fill(`${vendorForm} input[name="name"]`, 'E2E Vendor')
  click(`${vendorForm} button[type="submit"]`)
  await waitForBodyText('E2E Vendor', { label: 'vendor created in UI' })

  // Order form only appears after at least one vendor exists.
  await waitForBodyText('Add order', { label: 'order form visible' })
  const orderForm = await tagOrdersForm('Add order', 'order')

  // Order
  const vendorId = await selectOptionValue(`${orderForm} select[name="vendor_id"]`, 'E2E Vendor')
  runAgentBrowser(['select', `${orderForm} select[name="vendor_id"]`, vendorId])
  fill(`${orderForm} input[name="shipping_cost_usd"]`, '5')
  fill(`${orderForm} input[name="total_cost_usd"]`, '105')
  click(`${orderForm} button[type="submit"]`)
  await waitForBodyText('Add order item', { label: 'order created (order item form visible)' })

  // Order item form only appears after at least one order exists.
  const itemForm = await tagOrdersForm('Add order item', 'item')

  // Order item
  const orderId = await selectOptionValue(`${itemForm} select[name="order_id"]`, 'E2E Vendor')
  const substanceId = await selectOptionValue(`${itemForm} select[name="substance_id"]`, substanceLabelIncludes)
  const formulationId = await selectOptionValue(`${itemForm} select[name="formulation_id"]`, formulationLabelIncludes)
  runAgentBrowser(['select', `${itemForm} select[name="order_id"]`, orderId])
  runAgentBrowser(['select', `${itemForm} select[name="substance_id"]`, substanceId])
  runAgentBrowser(['select', `${itemForm} select[name="formulation_id"]`, formulationId])
  fill(`${itemForm} input[name="qty"]`, '2')
  fill(`${itemForm} input[name="unit_label"]`, 'vial')
  fill(`${itemForm} input[name="price_total_usd"]`, '100')
  fill(`${itemForm} input[name="expected_vials"]`, '2')
  click(`${itemForm} button[type="submit"]`)
  // Generate vials form only appears after at least one order item exists.
  await waitForBodyText('Generate vials', { label: 'generate vials form visible', timeoutMs: 60000 })
  const genForm = await tagOrdersForm('Generate vials', 'gen')

  await waitUntil(
    async () => {
      const ok = await evalJs(
        `(() => {
          const opts = Array.from(document.querySelectorAll(${JSON.stringify(`${genForm} select[name="order_item_id"] option`)}))
            .map((o) => (o.textContent || '').trim())
          return opts.some((t) => t.includes('E2E Vendor'))
        })()`,
      )
      return Boolean(ok)
    },
    { label: 'order item reflected in generate-vials select', timeoutMs: 60000 },
  )

  // Generate vials from order item.
  const orderItemId = await selectOptionValue(`${genForm} select[name="order_item_id"]`, 'E2E Vendor')
  runAgentBrowser(['select', `${genForm} select[name="order_item_id"]`, orderItemId])
  fill(`${genForm} input[name="content_mass_value"]`, '10')
  runAgentBrowser(['select', `${genForm} select[name="content_mass_unit"]`, 'mg'])
  fill(`${genForm} input[name="total_volume_value"]`, '10')
  runAgentBrowser(['select', `${genForm} select[name="total_volume_unit"]`, 'mL'])
  click(`${genForm} button[type="submit"]`)
  await waitForBodyText('Generated', { label: 'generate vials success' })
}

async function inventoryActivateCloseOneVial() {
  logLine('inventory: activate then close one vial (if present)')
  open(`${BASE_URL}/inventory`)
  await waitForBodyText('Inventory', { label: 'inventory page visible' })

  const hasActivate = await evalJs('document.body.innerText.includes("Activate")')
  if (hasActivate) {
    clickFirst('button:has-text("Activate")')
    await waitForBodyText('Inventory', { label: 'inventory after activate' })
  }

  const hasClose = await evalJs('document.body.innerText.includes("Close")')
  if (hasClose) {
    clickFirst('button:has-text("Close")')
    await waitForBodyText('Inventory', { label: 'inventory after close' })
  }
}

async function exportZipToFile(outPath) {
  logLine('data: exporting zip via /api/export (using browser session cookies)')
  const url = `${BASE_URL}/api/export`
  const cookieHeader = cookieHeaderForUrl(url)
  if (!cookieHeader) fail('No cookies found for export; are we signed in?')

  const res = await fetch(url, {
    headers: {
      Cookie: cookieHeader,
      Accept: 'application/zip',
    },
  })
  if (!res.ok) {
    fail(`Export failed with HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/zip')) {
    fail(`Export returned unexpected Content-Type: ${contentType}`)
  }

  const buf = new Uint8Array(await res.arrayBuffer())
  fs.writeFileSync(outPath, buf)
  return { contentType, bytes: buf.byteLength }
}

async function settingsDeleteMyData() {
  logLine('settings: delete-my-data via UI')
  open(`${BASE_URL}/settings`)
  await waitForBodyText('Settings', { label: 'settings page visible' })
  await evalJs('window.confirm = () => true')

  // Type DELETE into the confirm input and click the delete button.
  const confirmInput = 'input[placeholder="DELETE"]'
  click(confirmInput)
  // Use `type` (not `fill`) to ensure React `onChange` fires and the delete button enables.
  fill(confirmInput, '')
  type(confirmInput, 'DELETE')

  await waitUntil(
    async () =>
      Boolean(
        await evalJs(`(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find((b) => (b.textContent || '').trim() === 'Delete all my data')
          return btn && !btn.disabled
        })()`),
      ),
    { label: 'delete-my-data button enabled', timeoutMs: 10000 },
  )

  clickButtonByName('Delete all my data')

  await waitUntil(
    async () => {
      const confirm = await evalJs('document.querySelector(\'input[placeholder="DELETE"]\')?.value')
      if (confirm === '') return true

      const err = await evalJs('document.querySelector(\'p.text-red-700\')?.innerText')
      if (typeof err === 'string' && err.trim().length > 0) {
        fail(`delete-my-data failed: ${err.trim()}`)
      }
      return false
    },
    { label: 'delete-my-data completion', timeoutMs: 60000 },
  )
}

async function settingsImportZip({ zipPath, replaceExisting }) {
  logLine(`settings: import zip via UI (replace=${replaceExisting ? '1' : '0'})`)
  open(`${BASE_URL}/settings`)
  await waitForBodyText('Import bundle', { label: 'settings import section visible' })
  await evalJs('window.confirm = () => true')

  // Set replace checkbox if requested.
  if (replaceExisting) {
    check('input[data-e2e="bundle-replace"]')
  } else {
    uncheck('input[data-e2e="bundle-replace"]')
  }

  // Upload the file.
  upload('input[data-e2e="bundle-zip-file"]', zipPath)

  // Dry run first.
  click('button[data-e2e="bundle-dry-run"]')
  await waitUntil(
    async () => {
      const hasFormat = await evalJs('document.body.innerText.includes("format=peptaide-csv-bundle-v1")')
      return Boolean(hasFormat)
    },
    { label: 'import dry run result', timeoutMs: 60000 },
  )

  // Apply import.
  click('button[data-e2e="bundle-apply"]')
  await waitUntil(
    async () => {
      const ok = await evalJs(
        `(() => {
          const table = Array.from(document.querySelectorAll('table')).find((t) =>
            (t.textContent || '').includes('Inserted')
          )
          if (!table) return false
          const rows = Array.from(table.querySelectorAll('tbody tr'))
          if (rows.length === 0) return false
          const inserted = rows
            .map((r) => (r.children && r.children[2] ? (r.children[2].textContent || '').trim() : ''))
            .filter(Boolean)
          return inserted.some((t) => t !== '-')
        })()`,
      )
      return Boolean(ok)
    },
    { label: 'import apply inserted counts', timeoutMs: 120000 },
  )
}

async function settingsImportSimpleEventsCsv({ csvPath, replaceExisting, inferCycles }) {
  logLine(`settings: simple events import via UI (replace=${replaceExisting ? '1' : '0'})`)
  open(`${BASE_URL}/settings`)
  await waitForBodyText('Simple import: events CSV', { label: 'settings simple import section visible' })
  await evalJs('window.confirm = () => true')

  const cycleGapDaysRaw = process.env.E2E_SIMPLE_EVENTS_PROFILE_CYCLE_GAP_DAYS
  if (cycleGapDaysRaw && cycleGapDaysRaw.trim()) {
    const n = Number(cycleGapDaysRaw)
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      logLine(`settings: setting profile cycle_gap_default_days=${n}`)
      fill('input[name="cycle_gap_default_days"]', String(n))
      await evalJs(
        `(() => {
          const input = document.querySelector('input[name="cycle_gap_default_days"]')
          const form = input && input.closest('form')
          if (!form) return false
          // Prefer requestSubmit so any onSubmit hooks run as expected.
          if (typeof form.requestSubmit === 'function') form.requestSubmit()
          else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
          return true
        })()`,
      )
      await waitUntil(
        async () => {
          const body = await evalJs('document.body.innerText')
          return typeof body === 'string' && body.includes('Updated.')
        },
        { label: 'profile save (cycle gap days)', timeoutMs: 60000 },
      )
    } else {
      fail(`Invalid E2E_SIMPLE_EVENTS_PROFILE_CYCLE_GAP_DAYS value: ${cycleGapDaysRaw}`)
    }
  }

  if (inferCycles) {
    check('input[data-e2e="simple-events-infer-cycles"]')
  } else {
    uncheck('input[data-e2e="simple-events-infer-cycles"]')
  }

  if (replaceExisting) {
    check('input[data-e2e="simple-events-replace"]')
  } else {
    uncheck('input[data-e2e="simple-events-replace"]')
  }

  upload('input[data-e2e="simple-events-file"]', csvPath)

  click('button[data-e2e="simple-events-dry-run"]')
  await waitUntil(
    async () => {
      const text = await evalJs('document.querySelector(\'[data-e2e="simple-events-summary"]\')?.textContent || ""')
      return typeof text === 'string' && text.includes('mode=dry-run')
    },
    { label: 'simple events import dry run result', timeoutMs: 60000 },
  )

  click('button[data-e2e="simple-events-apply"]')
  await waitUntil(
    async () => {
      const err = await evalJs('document.querySelector(\'[data-e2e="simple-events-error"]\')?.textContent?.trim() || ""')
      if (typeof err === 'string' && err) return true
      const text = await evalJs('document.querySelector(\'[data-e2e="simple-events-summary"]\')?.textContent || ""')
      return typeof text === 'string' && text.includes('mode=apply')
    },
    { label: 'simple events import apply complete', timeoutMs: 120000 },
  )
  const importErr = await evalJs('document.querySelector(\'[data-e2e="simple-events-error"]\')?.textContent?.trim() || ""')
  if (typeof importErr === 'string' && importErr) {
    fail(`simple events import apply failed: ${importErr}`)
  }
  const importSummary = await evalJs('document.querySelector(\'[data-e2e="simple-events-summary"]\')?.textContent?.trim() || ""')
  if (typeof importSummary === 'string' && importSummary) {
    logLine(`simple events import summary: ${importSummary}`)
  }

  // Confirm we can navigate to /today and see a non-empty surface.
  open(`${BASE_URL}/today`)
  // Avoid a "black hole" timeout: if navigation lands on an error page or a blank screen,
  // capture a screenshot + body snippet to help diagnose.
  const todayLoadStart = Date.now()
  let todayBody = ''
  for (;;) {
    const raw = await evalJs('document.body.innerText')
    if (typeof raw === 'string') todayBody = raw
    if (todayBody.includes('Today') || todayBody.includes('Sign in')) break
    if (Date.now() - todayLoadStart > 60000) {
      takeScreenshot('simple-import-today-timeout')
      const snippet = (todayBody || '').replace(/\\s+/g, ' ').slice(0, 300)
      fail(`Timed out waiting for /today to load after simple import. Body starts: ${snippet}`)
    }
    await sleep(250)
  }
  if (typeof todayBody !== 'string') {
    takeScreenshot('simple-import-today-unknown')
    fail('Could not read /today body text after simple import.')
  }
  if (todayBody.includes('Sign in')) {
    takeScreenshot('simple-import-today-signed-out')
    fail('After simple import, /today redirected to sign-in (session lost).')
  }
  if (todayBody.includes('No formulations exist yet')) {
    takeScreenshot('simple-import-today-empty')
    fail('After simple import, /today shows empty state (no formulations). Import did not create formulations as expected.')
  }
  if (!todayBody.includes('Log (grid)')) {
    takeScreenshot('simple-import-today-no-grid')
    const snippet = todayBody.replace(/\s+/g, ' ').slice(0, 300)
    fail(`After simple import, /today did not show the log grid. Body starts: ${snippet}`)
  }
}

async function sweepPages({ labelPrefix }) {
  const pages = [
    { label: 'today', path: '/today' },
    { label: 'setup', path: '/setup' },
    { label: 'analytics', path: '/analytics' },
    { label: 'substances', path: '/substances' },
    { label: 'routes', path: '/routes' },
    { label: 'devices', path: '/devices' },
    { label: 'formulations', path: '/formulations' },
    { label: 'inventory', path: '/inventory' },
    { label: 'orders', path: '/orders' },
    { label: 'cycles', path: '/cycles' },
    { label: 'distributions', path: '/distributions' },
    { label: 'evidence-sources', path: '/evidence-sources' },
    { label: 'settings', path: '/settings' },
  ]

  for (const p of pages) {
    const label = `${labelPrefix}-${p.label}`
    logLine(`sweep: ${p.path}`)
    open(`${BASE_URL}${p.path}`)
    waitFor('main')
    // Give the page a moment to settle so network/console diagnostics are meaningful.
    waitFor(300)
    takeScreenshot(label)
    assertHealthy(label)
  }
}

async function main() {
  ensureDir(ARTIFACTS_DIR)
  logLine(`run_id: ${RUN_ID}`)
  logLine(`base_url: ${BASE_URL}`)
  logLine(`mailpit_url: ${MAILPIT_URL}`)
  logLine(`session: ${SESSION}`)
  logLine(`artifacts_dir: ${ARTIFACTS_DIR}`)

  await resetLocalSupabaseDb()

  // Best-effort: clean any old browser instance for this session name.
  runAgentBrowser(['close'], { allowFailure: true })

  setViewport(1280, 720)

  await signInWithMagicLink(EMAIL_A)
  await seedDemoDataIfAvailable()

  // Create a small set of distributions for setup/calibration/modifiers.
  await createDistribution({ name: 'E2E: fraction 0.5', valueType: 'fraction', distType: 'point', p1: 0.5 })
  await createDistribution({ name: 'E2E: multiplier 2.0', valueType: 'multiplier', distType: 'point', p1: 2.0 })
  await createDistribution({
    name: 'E2E: vol per spray 0.10',
    valueType: 'volume_ml_per_unit',
    distType: 'point',
    p1: 0.1,
  })

  // Add a device + calibration route + formulation + vial + specs, then log with device units.
  await createDevice({ name: 'E2E Spray', kind: 'spray', defaultUnit: 'spray' })
  await bulkAddRoutes({
    names: ['E2E intranasal'],
    defaultKind: 'device_units',
    defaultUnit: 'spray',
    supportsCalibration: true,
  })
  await bulkAddFormulation({
    formulationName: 'E2E IN formulation',
    substanceLabelIncludes: 'Demo substance',
    routeLabelIncludes: 'E2E intranasal',
    deviceLabelIncludes: 'E2E Spray',
  })
  await createVial({
    formulationLabelIncludes: 'E2E IN formulation',
    massValue: 10,
    massUnit: 'mg',
    volumeValue: 10,
    volumeUnit: 'mL',
    costUsd: 50,
  })
  await addBaseBaSpec({
    substanceLabelIncludes: 'Demo substance',
    routeLabelIncludes: 'E2E intranasal',
    distLabelIncludes: 'E2E: fraction 0.5',
  })
  await addDeviceCalibration({
    deviceLabelIncludes: 'E2E Spray',
    routeLabelIncludes: 'E2E intranasal',
    unitLabel: 'spray',
    distLabelIncludes: 'E2E: vol per spray 0.10',
  })
  await addFormulationModifier({
    formulationLabelIncludes: 'E2E IN formulation',
    distLabelIncludes: 'E2E: multiplier 2.0',
  })

  // Log events with multiple input types.
  await logEventInTodayGrid({ formulationLabelIncludes: 'Demo formulation', rowIndex1Based: 1, inputText: '0.3mL' })
  await logEventInTodayGrid({ formulationLabelIncludes: 'Demo formulation', rowIndex1Based: 2, inputText: '250mcg' })
  await logEventInTodayGrid({ formulationLabelIncludes: 'Demo formulation', rowIndex1Based: 3, inputText: '500 IU' })
  await logEventInTodayGrid({ formulationLabelIncludes: 'E2E IN formulation', rowIndex1Based: 4, inputText: '2 sprays' })

  await deleteAndRestoreFirstTodayEvent()
  await cycleSplitAndEnd()

  await ordersCreateAndGenerateVials({ substanceLabelIncludes: 'Demo substance', formulationLabelIncludes: 'E2E IN formulation' })
  await inventoryActivateCloseOneVial()

  // Capture one deep-link for RLS cross-user checks.
  open(`${BASE_URL}/substances`)
  waitFor('text=Substances')
  const substanceHref = await evalJs('document.querySelector(\'a[href^="/substances/"]\')?.getAttribute("href")')
  const deviceHref = await evalJs('document.querySelector(\'a[href^="/devices/"]\')?.getAttribute("href")')
  const formulationHref = await evalJs('document.querySelector(\'a[href^="/formulations/"]\')?.getAttribute("href")')
  const cycleHref = await evalJs('document.querySelector(\'a[href^="/cycles/"]\')?.getAttribute("href")')

  // Data portability: export -> delete -> import -> verify restored.
  const exportPath = path.join(ARTIFACTS_DIR, 'export.zip')
  const exportInfo = await exportZipToFile(exportPath)
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'export.meta.txt'), `content_type=${exportInfo.contentType}\nbytes=${exportInfo.bytes}\n`)

  await settingsDeleteMyData()
  // Confirm empty-state surfaces return.
  open(`${BASE_URL}/today`)
  await waitUntil(
    async () => Boolean(await evalJs('document.body.innerText.includes("No formulations exist yet")')),
    { label: 'today empty state after delete', timeoutMs: 60000 },
  )

  await settingsImportZip({ zipPath: exportPath, replaceExisting: false })
  open(`${BASE_URL}/today`)
  await waitUntil(
    async () => Boolean(await evalJs('document.body.innerText.includes("Log (grid)")')),
    { label: 'today grid after import', timeoutMs: 60000 },
  )

  // Page sweep (desktop).
  logLine('sweep: desktop viewport')
  setViewport(1280, 720)
  await sweepPages({ labelPrefix: 'desktop' })

  // Page sweep (mobile).
  logLine('sweep: mobile viewport')
  setViewport(390, 844)
  await sweepPages({ labelPrefix: 'mobile' })

  // Multi-user RLS: sign out, sign in as B, verify A's deep links are 404/not-found.
  await signOut()
  await signInWithCode(EMAIL_B)

  // User B should see empty state on /today.
  await waitUntil(
    async () => Boolean(await evalJs('document.body.innerText.includes("No formulations exist yet")')),
    { label: 'userB today empty state', timeoutMs: 60000 },
  )

  const deepLinks = [substanceHref, deviceHref, formulationHref, cycleHref].filter((h) => typeof h === 'string')
  for (const href of deepLinks) {
    open(`${BASE_URL}${href}`)
    // Next.js notFound renders a simple 404 page. Assert we do not see app layout content.
    await waitUntil(
      async () => {
        const body = await evalJs('document.body.innerText')
        if (typeof body !== 'string') return false
        return body.toLowerCase().includes('not found') || body.toLowerCase().includes('could not be found')
      },
      { label: `userB cannot open ${href}`, timeoutMs: 30000 },
    )
  }

  // Simple CSV import (sparse datasets): import a tiny events CSV for user B and verify it produces a usable /today and /cycles.
  const customSimpleCsv = process.env.E2E_SIMPLE_EVENTS_CSV_PATH
  const simpleCsvPath = customSimpleCsv ? path.resolve(customSimpleCsv) : path.join(ARTIFACTS_DIR, 'simple-events.csv')
  if (!customSimpleCsv) {
    fs.writeFileSync(
      simpleCsvPath,
      [
        'substance,ts,dose_ml,mg_per_ml,route',
        `E2E Simple,2026-01-01T10:00:00Z,0.25,10,SubQ`,
        `E2E Simple,2026-01-20T10:00:00Z,0.25,10,SubQ`,
      ].join('\n') + '\n',
    )
  } else if (!fs.existsSync(simpleCsvPath)) {
    fail(`E2E_SIMPLE_EVENTS_CSV_PATH does not exist: ${simpleCsvPath}`)
  }
  await settingsImportSimpleEventsCsv({ csvPath: simpleCsvPath, replaceExisting: false, inferCycles: true })
  open(`${BASE_URL}/cycles`)
  await waitForBodyText('Cycles', { label: 'cycles page visible after simple import' })

  logLine('PASS: conclusive browser verification completed')
  logLine(`artifacts_dir: ${ARTIFACTS_DIR}`)
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
    // Best-effort clean-up: close the browser session.
    try {
      runAgentBrowser(['close'], { allowFailure: true })
    } catch {
      // ignore
    }
  })
