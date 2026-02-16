import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { requestId, resolveRuntimeConfig } from '../src/config.js'

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

describe('resolveRuntimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('respects precedence flags > env > project > user > defaults', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-config-'))
    const homeDir = path.join(tmpRoot, 'home')
    const cwd = path.join(tmpRoot, 'project')
    fs.mkdirSync(homeDir, { recursive: true })
    fs.mkdirSync(cwd, { recursive: true })

    writeJson(path.join(homeDir, '.config', 'peptaide', 'config.json'), {
      api_url: 'http://user.example',
      profile: 'user-profile',
      timeout_ms: 1111,
    })
    writeJson(path.join(cwd, '.peptaide.json'), {
      api_url: 'http://project.example',
      profile: 'project-profile',
      timeout_ms: 2222,
    })

    vi.stubEnv('HOME', homeDir)
    vi.stubEnv('PEPTAIDE_API_URL', 'http://env.example')
    vi.stubEnv('PEPTAIDE_PROFILE', 'env-profile')
    vi.stubEnv('PEPTAIDE_TIMEOUT_MS', '3333')
    vi.stubEnv('PEPTAIDE_AUTH_TOKEN', ' env-token ')

    const fromEnv = resolveRuntimeConfig({
      cwd,
      global: {},
    })
    expect(fromEnv.apiUrl).toBe('http://env.example')
    expect(fromEnv.profile).toBe('env-profile')
    expect(fromEnv.timeoutMs).toBe(3333)
    expect(fromEnv.envAuthToken).toBe('env-token')

    const fromFlags = resolveRuntimeConfig({
      cwd,
      global: {
        apiUrl: 'http://flag.example',
        profile: 'flag-profile',
        timeoutMs: 4444,
        requestId: 'rid-1',
        json: true,
        plain: true,
        quiet: true,
        verbose: true,
        input: false,
        color: false,
      },
    })

    expect(fromFlags.apiUrl).toBe('http://flag.example')
    expect(fromFlags.profile).toBe('flag-profile')
    expect(fromFlags.timeoutMs).toBe(4444)
    expect(fromFlags.requestId).toBe('rid-1')
    expect(fromFlags.json).toBe(true)
    expect(fromFlags.plain).toBe(true)
    expect(fromFlags.quiet).toBe(true)
    expect(fromFlags.verbose).toBe(true)
    expect(fromFlags.noInput).toBe(true)
    expect(fromFlags.noColor).toBe(true)
  })
})

describe('requestId', () => {
  test('returns provided id when present', () => {
    expect(requestId('known-id')).toBe('known-id')
  })

  test('creates uuid when not provided', () => {
    const generated = requestId(null)
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
