import type { PostgrestError } from '@supabase/supabase-js'

export function requireData<T>(
  data: T | null,
  error: PostgrestError | null,
  context: string,
): T {
  if (error) {
    const details = error.details ? ` (${error.details})` : ''
    const hint = error.hint ? ` (hint: ${error.hint})` : ''
    throw new Error(`${context}: ${error.message}${details}${hint}`)
  }
  if (data == null) {
    throw new Error(`${context}: missing data`)
  }
  return data
}

export function requireOk(
  error: PostgrestError | null,
  context: string,
): void {
  if (!error) return
  const details = error.details ? ` (${error.details})` : ''
  const hint = error.hint ? ` (hint: ${error.hint})` : ''
  throw new Error(`${context}: ${error.message}${details}${hint}`)
}

