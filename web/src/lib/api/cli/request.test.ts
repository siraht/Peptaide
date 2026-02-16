import { describe, expect, test } from 'vitest'

import { CliApiError } from './response'
import { requireApply, requireForceWhenNonInteractive } from './request'

describe('requireApply', () => {
  test('defaults to dry run when apply is not set', () => {
    expect(requireApply({ command: 'sessions create' })).toEqual({ dryRun: true })
  })

  test('returns non-dry-run when apply is true', () => {
    expect(requireApply({ command: 'sessions create', apply: true })).toEqual({ dryRun: false })
  })

  test('rejects invalid explicit combination', () => {
    expect(() =>
      requireApply({ command: 'sessions create', apply: false, dryRun: false }),
    ).toThrow(CliApiError)
  })
})

describe('requireForceWhenNonInteractive', () => {
  test('allows interactive mode without force', () => {
    expect(() =>
      requireForceWhenNonInteractive({
        command: 'data delete-all',
        actionLabel: 'delete all data',
        noInput: false,
        force: false,
      }),
    ).not.toThrow()
  })

  test('requires force in non-interactive mode', () => {
    expect(() =>
      requireForceWhenNonInteractive({
        command: 'data delete-all',
        actionLabel: 'delete all data',
        noInput: true,
        force: false,
      }),
    ).toThrow(CliApiError)
  })
})
