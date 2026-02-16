import { z } from 'zod'

import {
  notificationSetRequestSchema,
  profileSetRequestSchema,
} from '@/lib/api/contracts/cli'
import { validateSameOrigin } from '@/lib/http/sameOrigin'
import { ensureMyProfile, updateMyNotificationPrefs, updateMyProfile } from '@/lib/repos/profilesRepo'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { withIdempotency } from '@/lib/api/cli/idempotency'
import { readJsonBody, requireApply, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'

export const runtime = 'nodejs'

type SettingsAction = 'profile_get' | 'profile_set' | 'notifications_get' | 'notifications_set'

const profileGetRequestSchema = z.object({})

function readAction(payload: unknown): SettingsAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'profile_get':
    case 'profile_set':
    case 'notifications_get':
    case 'notifications_set':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid settings action.',
        details: ['Supported actions: profile_get, profile_set, notifications_get, notifications_set'],
      })
  }
}

export async function POST(request: Request): Promise<Response> {
  return runCliRoute(request, async (requestId) => {
    const originError = validateSameOrigin(request)
    if (originError) {
      throw new CliApiError({ code: 'forbidden', status: 403, message: originError })
    }

    const auth = await requireCliBearer(request)
    const body = await readJsonBody(request)
    const action = readAction(body)

    if (action === 'profile_get' || action === 'notifications_get') {
      validateBody(profileGetRequestSchema, body)
      const profile = await ensureMyProfile(auth.supabase)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Loaded profile settings.',
          data: profile,
        }),
      }
    }

    if (action === 'profile_set') {
      const payload = validateBody(profileSetRequestSchema, body)
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'settings profile set' })

      const tzRes = await auth.supabase.rpc('safe_timezone', { tz: payload.timezone })
      if (tzRes.error || !tzRes.data) {
        throw new CliApiError({
          code: 'validation_error',
          status: 400,
          message: 'Invalid timezone.',
          details: [tzRes.error?.message ?? 'safe_timezone returned null.'],
        })
      }

      const canonicalTimezone = tzRes.data

      const execProfileSet = async () => {
        if (applyMode.dryRun) {
          return {
            status: 200,
            envelope: okEnvelope({
              requestId,
              code: 'dry_run',
              message: 'Dry run complete.',
              data: {
                timezone: canonicalTimezone,
                default_mass_unit: payload.default_mass_unit,
                default_volume_unit: payload.default_volume_unit,
                default_simulation_n: payload.default_simulation_n,
                cycle_gap_default_days: payload.cycle_gap_default_days,
              },
            }),
          }
        }

        await ensureMyProfile(auth.supabase)
        const updated = await updateMyProfile(auth.supabase, {
          timezone: canonicalTimezone,
          defaultMassUnit: payload.default_mass_unit,
          defaultVolumeUnit: payload.default_volume_unit,
          defaultSimulationN: payload.default_simulation_n,
          cycleGapDefaultDays: payload.cycle_gap_default_days,
        })

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Profile updated.',
            data: updated,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'settings.profile_set',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execProfileSet,
        })
      }

      return execProfileSet()
    }

    const payload = validateBody(notificationSetRequestSchema, body)
    const applyMode = requireApply({
      apply: payload.apply,
      dryRun: payload.dry_run,
      command: 'settings notifications set',
    })

    const execNotificationsSet = async () => {
      if (applyMode.dryRun) {
        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: {
              notify_low_stock_enabled: payload.notify_low_stock_enabled,
              notify_low_stock_runway_days_threshold: payload.notify_low_stock_runway_days_threshold,
              notify_spend_enabled: payload.notify_spend_enabled,
              notify_spend_usd_per_day_threshold: payload.notify_spend_usd_per_day_threshold,
              notify_spend_window_days: payload.notify_spend_window_days,
            },
          }),
        }
      }

      await ensureMyProfile(auth.supabase)
      const updated = await updateMyNotificationPrefs(auth.supabase, {
        notifyLowStockEnabled: payload.notify_low_stock_enabled,
        notifyLowStockRunwayDaysThreshold: payload.notify_low_stock_runway_days_threshold,
        notifySpendEnabled: payload.notify_spend_enabled,
        notifySpendUsdPerDayThreshold: payload.notify_spend_usd_per_day_threshold,
        notifySpendWindowDays: payload.notify_spend_window_days,
      })

      return {
        status: 200,
        envelope: okEnvelope({
          requestId,
          message: 'Notification preferences updated.',
          data: updated,
        }),
      }
    }

    if (!applyMode.dryRun && payload.idempotency_key) {
      return withIdempotency({
        supabase: auth.supabase,
        operation: 'settings.notifications_set',
        idempotencyKey: payload.idempotency_key,
        requestPayload: payload,
        execute: execNotificationsSet,
      })
    }

    return execNotificationsSet()
  })
}
