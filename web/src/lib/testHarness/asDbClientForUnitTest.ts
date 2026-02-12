import type { DbClient } from '@/lib/repos/types'

/**
 * Unit-test adapter for passing lightweight in-memory stubs to functions that
 * accept a full DbClient. Integration suites should use real Supabase clients.
 */
export function asDbClientForUnitTest(value: unknown): DbClient {
  return value as DbClient
}
