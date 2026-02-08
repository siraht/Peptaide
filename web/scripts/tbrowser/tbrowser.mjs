#!/usr/bin/env node
/*
 * tbrowser.mjs: PAI-style diagnostics on top of agent-browser (project-local copy).
 *
 * Usage (from web/):
 *   node scripts/tbrowser/tbrowser.mjs http://localhost:3002/today
 *   node scripts/tbrowser/tbrowser.mjs errors
 *   node scripts/tbrowser/tbrowser.mjs network
 *
 * Notes:
 * - Uses agent-browser sessions for persistence.
 * - `agent-browser network requests` requires a non-null filter in agent-browser@0.9.1.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WEB_DIR = path.resolve(__dirname, '..', '..')

const AGENT_BROWSER_BIN =
  process.env.AGENT_BROWSER_BIN ||
  (fs.existsSync(path.join(WEB_DIR, 'node_modules', '.bin', 'agent-browser'))
    ? path.join(WEB_DIR, 'node_modules', '.bin', 'agent-browser')
    : 'agent-browser')

const SESSION = process.env.TBROWSER_SESSION || process.env.AGENT_BROWSER_SESSION || 't-browser'
const CDP_PORT = process.env.TBROWSER_CDP_PORT
const EXECUTABLE_PATH = process.env.TBROWSER_EXECUTABLE_PATH || process.env.AGENT_BROWSER_EXECUTABLE_PATH
const HEADED = ['1', 'true', 'yes'].includes(String(process.env.TBROWSER_HEADED || '').toLowerCase())
const FULL_SCREENSHOT = ['1', 'true', 'yes'].includes(String(process.env.TBROWSER_FULL || '').toLowerCase())
const CLEAR_DIAGNOSTICS = !['0', 'false', 'no'].includes(String(process.env.TBROWSER_CLEAR || '').toLowerCase())

function baseArgs(json) {
  const args = []
  if (SESSION) args.push('--session', SESSION)
  if (CDP_PORT) args.push('--cdp', String(CDP_PORT))
  if (EXECUTABLE_PATH) args.push('--executable-path', EXECUTABLE_PATH)
  if (HEADED) args.push('--headed')
  if (json) args.push('--json')
  return args
}

function runAgentBrowser(cmdArgs, { json = false, allowFailure = false } = {}) {
  const fullArgs = [...baseArgs(json), ...cmdArgs]
  const result = spawnSync(AGENT_BROWSER_BIN, fullArgs, { encoding: 'utf8' })
  if (result.error) throw result.error
  const stdout = (result.stdout || '').trim()
  const stderr = (result.stderr || '').trim()
  if (result.status !== 0 && !allowFailure) {
    throw new Error(stderr || stdout || 'agent-browser command failed')
  }
  return { stdout, stderr, status: result.status ?? 0 }
}

function clearDiagnostics() {
  if (!CLEAR_DIAGNOSTICS) return
  runAgentBrowser(['console', '--clear'], { allowFailure: true })
  runAgentBrowser(['errors', '--clear'], { allowFailure: true })
  runAgentBrowser(['network', 'requests', '--clear', '--filter', '.'], { allowFailure: true })
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
  if (typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

function normalizeLogs(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.logs)) return data.logs
  if (Array.isArray(data.messages)) return data.messages
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
  return obj.text || obj.title || obj.value || ''
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 3)}...`
}

function formatDiagnostics(diag, screenshotPath) {
  const lines = []

  if (screenshotPath) {
    lines.push(`Screenshot: ${screenshotPath}`)
    lines.push('')
  }

  if (diag.errors.length > 0) {
    lines.push(`Console Errors (${diag.errors.length}):`)
    for (const err of diag.errors.slice(0, 5)) {
      lines.push(`  - ${truncate(err.text, 140)}`)
    }
    if (diag.errors.length > 5) {
      lines.push(`  ... and ${diag.errors.length - 5} more`)
    }
    lines.push('')
  }

  if (diag.warnings.length > 0) {
    lines.push(`Console Warnings (${diag.warnings.length}):`)
    for (const warn of diag.warnings.slice(0, 3)) {
      lines.push(`  - ${truncate(warn.text, 140)}`)
    }
    if (diag.warnings.length > 3) {
      lines.push(`  ... and ${diag.warnings.length - 3} more`)
    }
    lines.push('')
  }

  if (diag.failedRequests.length > 0) {
    lines.push(`Failed Requests (${diag.failedRequests.length}):`)
    for (const req of diag.failedRequests.slice(0, 5)) {
      const urlPath = req.url ? new URL(req.url).pathname : ''
      lines.push(`  - ${req.method || 'GET'} ${truncate(urlPath, 80)} -> ${req.status || ''}`)
    }
    if (diag.failedRequests.length > 5) {
      lines.push(`  ... and ${diag.failedRequests.length - 5} more`)
    }
    lines.push('')
  }

  lines.push(
    `Network: ${diag.stats.totalRequests} requests | ${formatBytes(diag.stats.totalSize)} | avg ${Math.round(diag.stats.avgDuration)}ms`,
  )

  const hasIssues = diag.errors.length > 0 || diag.failedRequests.length > 0
  lines.push(`${hasIssues ? 'Page loaded with issues' : 'Page loaded successfully'}: "${diag.pageTitle}"`)
  lines.push(`URL: ${diag.pageUrl}`)

  return lines.join('\n')
}

async function collectDiagnostics() {
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

  const consoleLogs = normalizeLogs(consoleData)
  const errorLogs = normalizeLogs(errorsData)
  const networkLogs = normalizeNetwork(networkData)

  const errors = []
  const warnings = []

  for (const log of consoleLogs) {
    const type = String(log.type || log.level || log.kind || '').toLowerCase()
    const text = String(log.text || log.message || log.msg || '')
    if (!text) continue
    if (type.includes('warn')) warnings.push({ type, text, timestamp: log.timestamp || Date.now() })
    if (type.includes('error')) errors.push({ type, text, timestamp: log.timestamp || Date.now() })
  }

  for (const log of errorLogs) {
    const text = String(log.text || log.message || log.msg || log.error || '')
    if (!text) continue
    errors.push({ type: 'error', text, timestamp: log.timestamp || Date.now() })
  }

  const failedRequests = []
  let totalSize = 0
  let totalDuration = 0
  let durationCount = 0

  for (const entry of networkLogs) {
    const status = entry.status || entry.statusCode
    const size = entry.size || entry.transferSize || entry.responseSize || 0
    const duration = entry.duration || entry.time || entry.responseTime
    if (status && status >= 400) {
      failedRequests.push({
        url: entry.url || '',
        method: entry.method || entry.requestMethod || 'GET',
        status,
      })
    }
    if (size) totalSize += Number(size)
    if (duration) {
      totalDuration += Number(duration)
      durationCount += 1
    }
  }

  const stats = {
    totalRequests: networkLogs.length,
    totalResponses: networkLogs.length,
    totalSize,
    avgDuration: durationCount ? totalDuration / durationCount : 0,
  }

  const pageTitle = pickText(titleData) || '(unknown)'
  const pageUrl = pickText(urlData) || '(unknown)'

  return { errors, warnings, failedRequests, stats, pageTitle, pageUrl }
}

function showHelp() {
  console.log(`
Usage:
  node scripts/tbrowser/tbrowser.mjs <url>             Navigate with diagnostics
  node scripts/tbrowser/tbrowser.mjs errors            Console errors only
  node scripts/tbrowser/tbrowser.mjs warnings          Console warnings only
  node scripts/tbrowser/tbrowser.mjs console           All console output
  node scripts/tbrowser/tbrowser.mjs network           Network activity
  node scripts/tbrowser/tbrowser.mjs failed            Failed requests (4xx/5xx)
  node scripts/tbrowser/tbrowser.mjs screenshot [path] Screenshot current page
  node scripts/tbrowser/tbrowser.mjs navigate <url>    Navigate without report
  node scripts/tbrowser/tbrowser.mjs click <selector>  Click element
  node scripts/tbrowser/tbrowser.mjs fill <sel> <val>  Fill input
  node scripts/tbrowser/tbrowser.mjs type <sel> <txt>  Type with delay
  node scripts/tbrowser/tbrowser.mjs eval "<js>"       Execute JavaScript
`)
}

function isUrl(input) {
  return /^https?:\/\//i.test(input) || /^localhost\b/i.test(input) || /^127\.0\.0\.1\b/.test(input)
}

async function debugUrl(url) {
  console.log(`Navigating: ${url}`)
  clearDiagnostics()
  runAgentBrowser(['open', url])

  const screenshotPath = `/tmp/browse-${Date.now()}.png`
  console.log('Taking screenshot')
  const screenshotArgs = ['screenshot', screenshotPath]
  if (FULL_SCREENSHOT) screenshotArgs.push('--full')
  runAgentBrowser(screenshotArgs)

  const diag = await collectDiagnostics()
  console.log(formatDiagnostics(diag, screenshotPath))
}

async function showErrors() {
  const diag = await collectDiagnostics()
  if (diag.errors.length === 0) {
    console.log('No console errors')
    return
  }
  console.log(`Console Errors (${diag.errors.length}):`)
  for (const err of diag.errors) console.log(err.text)
}

async function showWarnings() {
  const diag = await collectDiagnostics()
  if (diag.warnings.length === 0) {
    console.log('No console warnings')
    return
  }
  console.log(`Console Warnings (${diag.warnings.length}):`)
  for (const warn of diag.warnings) console.log(warn.text)
}

async function showConsole() {
  const consoleRaw = runAgentBrowser(['console'], { json: true, allowFailure: true })
  const consoleData = extractData(extractJson(consoleRaw.stdout))
  const consoleLogs = normalizeLogs(consoleData)
  if (consoleLogs.length === 0) {
    console.log('No console output')
    return
  }
  for (const log of consoleLogs) {
    const text = String(log.text || log.message || log.msg || '')
    if (text) console.log(text)
  }
}

async function showNetwork() {
  const networkRaw = runAgentBrowser(['network', 'requests', '--filter', '.'], { json: true, allowFailure: true })
  const networkData = extractData(extractJson(networkRaw.stdout))
  const networkLogs = normalizeNetwork(networkData)
  if (networkLogs.length === 0) {
    console.log('No network activity')
    return
  }
  for (const log of networkLogs.slice(-20)) {
    const urlPath = log.url ? new URL(log.url).pathname : ''
    const status = log.status || log.statusCode || 0
    console.log(`${status} ${log.method || log.requestMethod || 'GET'} ${truncate(urlPath, 80)}`)
  }
}

async function showFailed() {
  const diag = await collectDiagnostics()
  if (diag.failedRequests.length === 0) {
    console.log('No failed requests')
    return
  }
  console.log(`Failed Requests (${diag.failedRequests.length}):`)
  for (const req of diag.failedRequests) console.log(`${req.status} ${req.method} ${req.url}`)
}

function takeScreenshot(pathArg) {
  const screenshotPath = pathArg || `/tmp/screenshot-${Date.now()}.png`
  runAgentBrowser(['screenshot', screenshotPath])
  console.log(`Screenshot saved to ${screenshotPath}`)
}

function navigate(url) {
  runAgentBrowser(['open', url])
  console.log(`Navigated to ${url}`)
}

function click(selector) {
  runAgentBrowser(['click', selector])
  console.log(`Clicked ${selector}`)
}

function fill(selector, value) {
  runAgentBrowser(['fill', selector, value])
  console.log(`Filled ${selector}`)
}

function typeText(selector, text) {
  runAgentBrowser(['type', selector, text])
  console.log(`Typed in ${selector}`)
}

function evaluate(script) {
  const result = runAgentBrowser(['eval', script], { json: true, allowFailure: true })
  const payload = extractJson(result.stdout)
  const data = extractData(payload)
  console.log(JSON.stringify(data ?? payload ?? {}, null, 2))
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  if (isUrl(command)) {
    const url = command.startsWith('localhost') ? `http://${command}` : command
    await debugUrl(url)
    return
  }

  switch (command) {
    case 'errors':
      await showErrors()
      break
    case 'warnings':
      await showWarnings()
      break
    case 'console':
      await showConsole()
      break
    case 'network':
      await showNetwork()
      break
    case 'failed':
      await showFailed()
      break
    case 'screenshot':
      takeScreenshot(args[1])
      break
    case 'navigate':
      if (!args[1]) throw new Error('URL required')
      navigate(args[1])
      break
    case 'click':
      if (!args[1]) throw new Error('Selector required')
      click(args[1])
      break
    case 'fill':
      if (!args[1] || !args[2]) throw new Error('Selector and value required')
      fill(args[1], args[2])
      break
    case 'type':
      if (!args[1] || !args[2]) throw new Error('Selector and text required')
      typeText(args[1], args[2])
      break
    case 'eval':
      if (!args[1]) throw new Error('JavaScript required')
      evaluate(args[1])
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})

