import type { SessionCreateInput } from '@/lib/app/sessions/createSession'

export type SessionUpdatePayloadLike = {
  input_text?: string
  input_kind?: SessionCreateInput['inputKind']
  input_value?: number
  input_unit?: string
  normalized_unit?: string
  prefer_structured?: boolean
  ts?: string
  notes?: string | null
  tags?: string[]
  cycle_decision?: SessionCreateInput['cycleDecision']
}

export type CurrentSessionForUpdateLike = {
  formulation_id: string
  input_text: string
  input_kind: SessionCreateInput['inputKind'] | null
  input_value: number | null
  input_unit: string | null
  ts: string
  notes: string | null
  tags: string[] | null
  vial_id: string | null
}

export function payloadHasOwnKey(payload: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key)
}

export function normalizeSessionNotes(notes: string | null): string | null {
  if (notes == null) return null
  const value = String(notes).trim()
  return value.length > 0 ? value : null
}

export function normalizeSessionTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const value = String(raw).trim()
    if (!value) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function hasStructuredInputPatch(payload: SessionUpdatePayloadLike): boolean {
  return (
    payloadHasOwnKey(payload, 'input_kind') ||
    payloadHasOwnKey(payload, 'input_value') ||
    payloadHasOwnKey(payload, 'input_unit')
  )
}

export function buildSessionUpdateRecomputeInput(opts: {
  payload: SessionUpdatePayloadLike
  current: CurrentSessionForUpdateLike
}): SessionCreateInput {
  const { payload, current } = opts
  const hasTextPatch = payloadHasOwnKey(payload, 'input_text')
  const structuredPatch = hasStructuredInputPatch(payload)
  const preferStructured = payload.prefer_structured ?? (structuredPatch && !hasTextPatch)

  return {
    formulationId: current.formulation_id,
    inputText: hasTextPatch ? payload.input_text : structuredPatch ? undefined : current.input_text,
    inputKind: structuredPatch ? payload.input_kind ?? current.input_kind ?? undefined : undefined,
    inputValue: structuredPatch ? payload.input_value ?? current.input_value ?? undefined : undefined,
    inputUnit: structuredPatch ? payload.input_unit ?? current.input_unit ?? undefined : undefined,
    normalizedUnit: payload.normalized_unit,
    preferStructured,
    ts: payload.ts ?? current.ts,
    notes: payloadHasOwnKey(payload, 'notes') ? payload.notes ?? null : current.notes,
    tags: payloadHasOwnKey(payload, 'tags') ? payload.tags : current.tags ?? undefined,
    cycleDecision: payload.cycle_decision,
    vialId: current.vial_id,
    dryRun: true,
  }
}
