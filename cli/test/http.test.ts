import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { callApi } from '../src/http.js'
import { saveTokens } from '../src/profile-store.js'
import type { RuntimeConfig } from '../src/types.js'

function makeConfig(apiUrl: string): RuntimeConfig {
  return {
    apiUrl,
    profile: 'default',
    timeoutMs: 5_000,
    requestId: 'rid-test',
    noInput: false,
    json: false,
    plain: false,
    quiet: false,
    verbose: false,
    noColor: false,
    envAuthToken: null,
  }
}

describe('callApi', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('preserves configured base path when constructing API URL', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-http-'))
    const homeDir = path.join(tmpRoot, 'home')
    fs.mkdirSync(homeDir, { recursive: true })
    vi.stubEnv('HOME', homeDir)

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          code: 'ok',
          message: 'ok',
          data: null,
          warnings: [],
          errors: [],
          request_id: 'rid-test',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const envelope = await callApi({
      config: makeConfig('https://example.test/base'),
      domain: 'sessions',
      payload: { action: 'list' },
      authRequired: false,
    })

    expect(envelope.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()

    const [requestTarget] = fetchMock.mock.calls[0]!
    const requestUrl = requestTarget instanceof URL ? requestTarget.toString() : String(requestTarget)
    expect(requestUrl).toBe('https://example.test/base/api/cli/sessions')
  })

  test('preserves configured base URL query string', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-http-'))
    const homeDir = path.join(tmpRoot, 'home')
    fs.mkdirSync(homeDir, { recursive: true })
    vi.stubEnv('HOME', homeDir)

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          code: 'ok',
          message: 'ok',
          data: null,
          warnings: [],
          errors: [],
          request_id: 'rid-test',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const envelope = await callApi({
      config: makeConfig('https://example.test/base?env=staging'),
      domain: 'sessions',
      payload: { action: 'list' },
      authRequired: false,
    })

    expect(envelope.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()

    const [requestTarget] = fetchMock.mock.calls[0]!
    const requestUrl = requestTarget instanceof URL ? requestTarget.toString() : String(requestTarget)
    expect(requestUrl).toBe('https://example.test/base/api/cli/sessions?env=staging')
  })

  test('returns auth_required without calling fetch when auth token is missing', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-http-'))
    const homeDir = path.join(tmpRoot, 'home')
    fs.mkdirSync(homeDir, { recursive: true })
    vi.stubEnv('HOME', homeDir)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const envelope = await callApi({
      config: {
        ...makeConfig('https://example.test'),
        profile: `missing-${randomUUID()}`,
      },
      domain: 'sessions',
      payload: { action: 'list' },
      authRequired: true,
    })

    expect(envelope.ok).toBe(false)
    expect(envelope.code).toBe('auth_required')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('returns refresh failure envelope when refresh attempt fails', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-http-'))
    const homeDir = path.join(tmpRoot, 'home')
    fs.mkdirSync(homeDir, { recursive: true })
    vi.stubEnv('HOME', homeDir)

    saveTokens('default', {
      access_token: 'old-access-token',
      refresh_token: 'refresh-token',
      expires_at: null,
      token_type: 'bearer',
    })

    const fetchMock = vi.fn(async (requestUrl: URL) => {
      if (requestUrl.toString().includes('/api/cli/sessions')) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'auth_failed',
            message: 'Access token expired.',
            data: null,
            warnings: [],
            errors: ['expired'],
            request_id: 'rid-test',
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      return new Response(
        JSON.stringify({
          ok: false,
          code: 'auth_failed',
          message: 'Refresh token revoked.',
          data: null,
          warnings: [],
          errors: ['revoked'],
          request_id: 'rid-test',
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const envelope = await callApi({
      config: makeConfig('https://example.test'),
      domain: 'sessions',
      payload: { action: 'list' },
      authRequired: true,
    })

    expect(envelope.ok).toBe(false)
    expect(envelope.code).toBe('auth_failed')
    expect(envelope.message).toBe('Refresh token revoked.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('returns envelope error instead of throwing for invalid api URL', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peptaide-cli-http-'))
    const homeDir = path.join(tmpRoot, 'home')
    fs.mkdirSync(homeDir, { recursive: true })
    vi.stubEnv('HOME', homeDir)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const envelope = await callApi({
      config: makeConfig('not a url'),
      domain: 'sessions',
      payload: { action: 'list' },
      authRequired: false,
    })

    expect(envelope.ok).toBe(false)
    expect(envelope.code).toBe('validation_error')
    expect(envelope.message).toContain('Invalid API URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
