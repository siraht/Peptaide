import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { callApi } from '../src/http.js'
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
})
