import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { StoredTokens } from './types.js'

export type ProfileRecord = {
  access_token?: string
  refresh_token?: string
  expires_at?: number | null
  token_type?: string
  updated_at?: string
}

type ProfilesFile = {
  current_profile: string
  profiles: Record<string, ProfileRecord>
}

const DEFAULT_FILE: ProfilesFile = {
  current_profile: 'default',
  profiles: {},
}

function profileFilePath(): string {
  return path.join(os.homedir(), '.config', 'peptaide', 'profiles.json')
}

function ensureDir(): void {
  fs.mkdirSync(path.dirname(profileFilePath()), { recursive: true })
}

function readFile(): ProfilesFile {
  try {
    const filePath = profileFilePath()
    if (!fs.existsSync(filePath)) return { ...DEFAULT_FILE }
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as ProfilesFile

    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_FILE }
    if (!parsed.profiles || typeof parsed.profiles !== 'object') return { ...DEFAULT_FILE }

    return {
      current_profile:
        typeof parsed.current_profile === 'string' && parsed.current_profile.trim().length > 0
          ? parsed.current_profile.trim()
          : 'default',
      profiles: parsed.profiles,
    }
  } catch {
    return { ...DEFAULT_FILE }
  }
}

function writeFile(value: ProfilesFile): void {
  ensureDir()
  fs.writeFileSync(profileFilePath(), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function getProfile(profile: string): ProfileRecord {
  const file = readFile()
  return file.profiles[profile] ?? {}
}

export function saveTokens(profile: string, tokens: StoredTokens): void {
  const file = readFile()
  file.current_profile = profile
  file.profiles[profile] = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    token_type: tokens.token_type,
    updated_at: new Date().toISOString(),
  }
  writeFile(file)
}

export function clearTokens(profile: string): void {
  const file = readFile()
  const existing = file.profiles[profile] ?? {}
  file.profiles[profile] = {
    ...existing,
    access_token: undefined,
    refresh_token: undefined,
    expires_at: undefined,
    token_type: undefined,
    updated_at: new Date().toISOString(),
  }
  writeFile(file)
}

export function cloneProfile(opts: { from: string; to: string }): void {
  const file = readFile()
  const source = file.profiles[opts.from]
  if (!source) {
    throw new Error(`Profile ${opts.from} does not exist.`)
  }

  file.profiles[opts.to] = {
    ...source,
    updated_at: new Date().toISOString(),
  }
  writeFile(file)
}

export function deleteProfile(profile: string): void {
  const file = readFile()
  delete file.profiles[profile]
  if (file.current_profile === profile) {
    file.current_profile = 'default'
  }
  writeFile(file)
}

export function listProfiles(): { current: string; names: string[] } {
  const file = readFile()
  return {
    current: file.current_profile,
    names: Object.keys(file.profiles).sort((a, b) => a.localeCompare(b)),
  }
}
