import { z } from 'zod'

import {
  calcDoseRequestSchema,
  calcEffectiveRequestSchema,
  calcParseRequestSchema,
} from '@/lib/api/contracts/cli'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { readJsonBody, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'
import { calcDose, calcEffective, calcParse } from '@/lib/app/sessions/calc'

export const runtime = 'nodejs'

type CalcAction = 'parse' | 'dose' | 'effective' | 'from_text'

const calcFromTextRequestSchema = calcEffectiveRequestSchema.safeExtend({
  input_text: z.string().min(1),
})

function readAction(payload: unknown): CalcAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'parse':
    case 'dose':
    case 'effective':
    case 'from_text':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid calc action.',
        details: ['Supported actions: parse, dose, effective, from_text'],
      })
  }
}

export async function POST(request: Request): Promise<Response> {
  return runCliRoute(request, async (requestId) => {
    const originError = validateSameOrigin(request)
    if (originError) {
      throw new CliApiError({ code: 'forbidden', status: 403, message: originError })
    }

    const body = await readJsonBody(request)
    const action = readAction(body)

    if (action === 'parse') {
      const payload = validateBody(calcParseRequestSchema, body)
      const parsed = calcParse(payload.text)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Parsed input text.',
          data: parsed,
        }),
      }
    }

    if (action === 'dose') {
      const payload = validateBody(calcDoseRequestSchema, body)
      const result = calcDose(payload)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Dose calculation complete.',
          data: result,
          warnings: result.warnings,
        }),
      }
    }

    if (action === 'effective') {
      const payload = validateBody(calcEffectiveRequestSchema, body)
      const auth = await requireCliBearer(request)
      const result = await calcEffective(auth.supabase, payload)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Effective-dose Monte Carlo calculation complete.',
          data: result,
          warnings: result.warnings,
        }),
      }
    }

    const payload = validateBody(calcFromTextRequestSchema, body)
    const auth = await requireCliBearer(request)
    const result = await calcEffective(auth.supabase, {
      ...payload,
      prefer_structured: false,
    })

    return {
      envelope: okEnvelope({
        requestId,
        message: 'Calculated effective dose from text input.',
        data: result,
        warnings: result.warnings,
      }),
    }
  })
}
