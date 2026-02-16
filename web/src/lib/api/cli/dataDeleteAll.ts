export function shouldStoreDeleteAllIdempotency(opts: {
  dryRun: boolean
  idempotencyKey?: string | null
}): boolean {
  return !opts.dryRun && Boolean(opts.idempotencyKey)
}
