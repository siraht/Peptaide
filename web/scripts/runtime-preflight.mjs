#!/usr/bin/env node

import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3002'
const DEFAULT_PAGE_PATH = '/sign-in'
const DEFAULT_TIMEOUT_MS = 45000
const DEFAULT_REQUEST_TIMEOUT_MS = 7000
const DEFAULT_RETRY_INTERVAL_MS = 1000

function fail(message) {
  throw new Error(message)
}

function toInt(raw, fallback) {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function parseArgs(argv) {
  const out = {
    baseUrl: DEFAULT_BASE_URL,
    pagePath: DEFAULT_PAGE_PATH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    retryIntervalMs: DEFAULT_RETRY_INTERVAL_MS,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url') {
      out.baseUrl = String(argv[i + 1] || '').trim() || out.baseUrl
      i += 1
    } else if (arg === '--page-path') {
      out.pagePath = String(argv[i + 1] || '').trim() || out.pagePath
      i += 1
    } else if (arg === '--timeout-ms') {
      out.timeoutMs = toInt(argv[i + 1], out.timeoutMs)
      i += 1
    } else if (arg === '--request-timeout-ms') {
      out.requestTimeoutMs = toInt(argv[i + 1], out.requestTimeoutMs)
      i += 1
    } else if (arg === '--retry-interval-ms') {
      out.retryIntervalMs = toInt(argv[i + 1], out.retryIntervalMs)
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'Usage: node scripts/runtime-preflight.mjs [options]',
          '',
          'Options:',
          '  --base-url <url>              Base URL (default: http://127.0.0.1:3002)',
          '  --page-path <path>            Path to validate (default: /sign-in)',
          '  --timeout-ms <ms>             Total preflight timeout (default: 45000)',
          '  --request-timeout-ms <ms>     Per-request timeout (default: 7000)',
          '  --retry-interval-ms <ms>      Retry delay while waiting for page readiness (default: 1000)',
        ].join('\n') + '\n',
      )
      process.exit(0)
    }
  }

  return out
}

async function fetchText(url, requestTimeoutMs) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  const text = await response.text()
  return { response, text }
}

async function waitForHtml(url, { timeoutMs, requestTimeoutMs, retryIntervalMs }) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  let lastStatus = null

  while (Date.now() < deadline) {
    try {
      const { response, text } = await fetchText(url, requestTimeoutMs)
      lastStatus = response.status

      if (response.ok) {
        if (!text || !text.includes('</html>')) {
          lastErr = new Error('Received non-HTML response while waiting for sign-in page.')
        } else {
          return { response, text }
        }
      } else {
        const snippet = text.replace(/\s+/g, ' ').slice(0, 180)
        lastErr = new Error(`HTTP ${response.status} for ${url}. Body starts: ${snippet}`)
      }
    } catch (err) {
      lastErr = err
    }

    await sleep(retryIntervalMs)
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr || 'unknown error')
  fail(`Timed out waiting for ${url}. Last status=${String(lastStatus)}. Last error: ${detail}`)
}

function extractStaticAssets(html) {
  const rx = /"(\/_next\/static\/[^"?#]+\.(?:css|js))"/g
  const assets = []
  const seen = new Set()

  for (const match of html.matchAll(rx)) {
    const assetPath = match[1]
    if (!assetPath || seen.has(assetPath)) continue
    seen.add(assetPath)
    assets.push(assetPath)
  }

  return assets
}

async function fetchAsset(url, requestTimeoutMs) {
  const { response, text } = await fetchText(url, requestTimeoutMs)
  if (!response.ok) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 160)
    fail(`Asset check failed: HTTP ${response.status} ${url} (body starts: ${snippet})`)
  }
  return { response, text }
}

function findCssToken(cssText, tokenName) {
  const rx = new RegExp(`${tokenName}\\s*:\\s*([^;\\}]+)(?:[;\\}])`)
  const match = cssText.match(rx)
  if (!match) return null
  const value = String(match[1] || '').trim()
  return value || null
}

async function run() {
  const opts = parseArgs(process.argv.slice(2))
  const base = new URL(opts.baseUrl)
  const pageUrl = new URL(opts.pagePath, base).toString()

  process.stdout.write(`[runtime-preflight] page=${pageUrl}\n`)

  const page = await waitForHtml(pageUrl, opts)
  const assets = extractStaticAssets(page.text)
  if (assets.length === 0) {
    fail('No /_next/static CSS/JS assets were found in the sign-in HTML response.')
  }

  process.stdout.write(`[runtime-preflight] referenced_assets=${assets.length}\n`)

  const cssBodies = []
  for (const assetPath of assets) {
    const assetUrl = new URL(assetPath, base).toString()
    const asset = await fetchAsset(assetUrl, opts.requestTimeoutMs)
    process.stdout.write(`[runtime-preflight] 200 ${assetPath}\n`)
    if (assetPath.endsWith('.css')) {
      cssBodies.push(asset.text)
    }
  }

  const combinedCss = cssBodies.join('\n')
  if (!combinedCss.trim()) {
    fail('No CSS content was fetched from referenced assets; cannot validate theme token contract.')
  }

  const requiredTokens = ['--color-primary', '--color-background-dark', '--color-surface-dark']
  for (const token of requiredTokens) {
    const value = findCssToken(combinedCss, token)
    if (!value) {
      fail(`Theme token contract failed: ${token} was missing or empty in referenced CSS assets.`)
    }
    process.stdout.write(`[runtime-preflight] token ${token}=${value}\n`)
  }

  process.stdout.write('[runtime-preflight] PASS\n')
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[runtime-preflight] FAIL: ${message}\n`)
  process.exit(1)
})
