export type CliEnvelope<T = unknown> = {
  ok: boolean
  code: string
  message: string
  data: T | null
  warnings: string[]
  errors: string[]
  request_id: string
}

export type GlobalOptions = {
  json?: boolean
  plain?: boolean
  quiet?: boolean
  verbose?: boolean
  input?: boolean
  color?: boolean
  apiUrl?: string
  profile?: string
  timeoutMs?: number
  requestId?: string
}

export type RuntimeConfig = {
  apiUrl: string
  profile: string
  timeoutMs: number
  requestId: string | null
  noInput: boolean
  json: boolean
  plain: boolean
  quiet: boolean
  verbose: boolean
  noColor: boolean
  envAuthToken: string | null
}

export type StoredTokens = {
  access_token: string
  refresh_token: string
  expires_at: number | null
  token_type: string
}
