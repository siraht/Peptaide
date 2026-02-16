import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { GlobalOptions, RuntimeConfig } from './types.js'

type ConfigFile = {
  api_url?: string
  profile?: string
  timeout_ms?: number
}

const DEFAULTS: Omit<RuntimeConfig, 'requestId' | 'noInput' | 'json' | 'plain' | 'quiet' | 'verbose' | 'noColor' | 'envAuthToken'> = {
  apiUrl: 'http://127.0.0.1:3002',
  profile: 'default',
  timeoutMs: 20_000,
}

function readJsonFile(filePath: string): ConfigFile {
  try {
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as ConfigFile
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readUserConfig(): ConfigFile {
  const filePath = path.join(os.homedir(), '.config', 'peptaide', 'config.json')
  return readJsonFile(filePath)
}

function readProjectConfig(cwd: string): ConfigFile {
  return readJsonFile(path.join(cwd, '.peptaide.json'))
}

function envInt(name: string): number | null {
  const raw = process.env[name]
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
}

export function resolveRuntimeConfig(opts: {
  global: GlobalOptions
  cwd: string
}): RuntimeConfig {
  const userConfig = readUserConfig()
  const projectConfig = readProjectConfig(opts.cwd)
  const global = opts.global

  const apiUrl =
    global.apiUrl ||
    process.env.PEPTAIDE_API_URL ||
    projectConfig.api_url ||
    userConfig.api_url ||
    DEFAULTS.apiUrl

  const profile =
    global.profile ||
    process.env.PEPTAIDE_PROFILE ||
    projectConfig.profile ||
    userConfig.profile ||
    DEFAULTS.profile

  const timeoutMs =
    (typeof global.timeoutMs === 'number' && Number.isFinite(global.timeoutMs) && global.timeoutMs > 0
      ? Math.floor(global.timeoutMs)
      : null) ||
    envInt('PEPTAIDE_TIMEOUT_MS') ||
    (typeof projectConfig.timeout_ms === 'number' && projectConfig.timeout_ms > 0
      ? Math.floor(projectConfig.timeout_ms)
      : null) ||
    (typeof userConfig.timeout_ms === 'number' && userConfig.timeout_ms > 0
      ? Math.floor(userConfig.timeout_ms)
      : null) ||
    DEFAULTS.timeoutMs

  return {
    apiUrl,
    profile,
    timeoutMs,
    requestId: global.requestId || null,
    noInput: global.input === false,
    json: Boolean(global.json),
    plain: Boolean(global.plain),
    quiet: Boolean(global.quiet),
    verbose: Boolean(global.verbose),
    noColor: global.color === false,
    envAuthToken: process.env.PEPTAIDE_AUTH_TOKEN?.trim() || null,
  }
}

export function requestId(base: string | null): string {
  return base || randomUUID()
}
