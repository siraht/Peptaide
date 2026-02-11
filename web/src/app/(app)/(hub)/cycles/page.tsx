import Link from 'next/link'

import { CreateCycleNowForm } from './create-cycle-form'
import {
  type CycleHealthTone,
  type CycleInsightCard,
  buildCycleInsightCards,
} from './substanceCycleInsight'

import { EmptyState } from '@/components/ui/empty-state'
import { listCycleSummary } from '@/lib/repos/cycleSummaryRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

const NUM_FMT_2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const DAY_FMT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function fmtNumber(x: number | null | undefined): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return NUM_FMT_2.format(x)
}

function fmtDays(x: number | null | undefined): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return DAY_FMT.format(x)
}

function fmtRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return 'No range'
  if (min != null && max != null) return `${fmtDays(min)}-${fmtDays(max)} days`
  if (min != null) return `>= ${fmtDays(min)} days`
  return `<= ${fmtDays(max)} days`
}

function toneLabel(tone: CycleHealthTone): string {
  if (tone === 'good') return 'On track'
  if (tone === 'warning') return 'Watch'
  if (tone === 'danger') return 'Risk'
  return 'Neutral'
}

function toneClass(tone: CycleHealthTone): string {
  if (tone === 'good') return 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
  if (tone === 'warning') return 'text-amber-300 border-amber-400/40 bg-amber-500/10'
  if (tone === 'danger') return 'text-rose-300 border-rose-400/40 bg-rose-500/10'
  return 'text-slate-300 border-slate-500/40 bg-slate-700/30'
}

function progressFillClass(tone: CycleHealthTone): string {
  if (tone === 'good') return 'bg-emerald-400/90'
  if (tone === 'warning') return 'bg-amber-400/90'
  if (tone === 'danger') return 'bg-rose-400/90'
  return 'bg-slate-400/70'
}

function statusBadgeClass(card: CycleInsightCard): string {
  if (card.statusBucket === 'active') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  }
  if (card.statusBucket === 'completed') {
    return 'border-sky-400/30 bg-sky-500/10 text-sky-300'
  }
  if (card.statusBucket === 'abandoned') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-300'
  }
  return 'border-slate-500/30 bg-slate-700/40 text-slate-300'
}

function ringGradient(card: CycleInsightCard): string {
  const progress = card.cycleProgressPercent ?? 0
  if (card.cycleHealthTone === 'good') {
    return `conic-gradient(rgb(52 211 153) ${progress}%, rgb(51 65 85 / 0.45) ${progress}% 100%)`
  }
  if (card.cycleHealthTone === 'warning') {
    return `conic-gradient(rgb(251 191 36) ${progress}%, rgb(51 65 85 / 0.45) ${progress}% 100%)`
  }
  if (card.cycleHealthTone === 'danger') {
    return `conic-gradient(rgb(251 113 133) ${progress}%, rgb(51 65 85 / 0.45) ${progress}% 100%)`
  }
  return `conic-gradient(rgb(148 163 184) ${progress}%, rgb(51 65 85 / 0.45) ${progress}% 100%)`
}

function TrendBars({ trend }: { trend: number[] }) {
  if (trend.length === 0) {
    return <p className="mt-2 text-xs text-slate-400">No cycle history yet.</p>
  }

  const peak = Math.max(...trend, 1)

  return (
    <div className="mt-2 flex h-8 items-end gap-1" data-e2e="cycle-card-event-trend">
      {trend.map((value, idx) => {
        const pct = Math.max(18, Math.round((value / peak) * 100))
        return (
          <span
            key={`${idx}-${value}`}
            className="w-1.5 rounded-sm bg-primary/70"
            style={{ height: `${pct}%` }}
            title={`Cycle ${idx + 1}: ${value} events`}
          />
        )
      })}
    </div>
  )
}

function CycleCard({ card }: { card: CycleInsightCard }) {
  const coreCardClass =
    'group relative block overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4 shadow-lg shadow-slate-950/30 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70'

  const content = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(1200px 420px at -20% -60%, rgb(29 78 216 / 0.26), transparent 40%), radial-gradient(600px 260px at 110% -10%, rgb(6 182 212 / 0.16), transparent 55%)',
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Substance</p>
          <h3 className="text-lg font-semibold text-slate-100" data-e2e="cycle-card-substance-name">
            {card.substanceName}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full border px-2 py-1 font-medium ${statusBadgeClass(card)}`}>
              {card.statusLabel}
            </span>
            <span className={`rounded-full border px-2 py-1 font-medium ${toneClass(card.cycleHealthTone)}`}>
              {toneLabel(card.cycleHealthTone)}
            </span>
            {card.primaryCycle?.cycle_number != null ? (
              <span className="rounded-full border border-slate-600/70 bg-slate-800/70 px-2 py-1 font-medium text-slate-300">
                Cycle #{card.primaryCycle.cycle_number}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="relative h-16 w-16 rounded-full p-[4px]"
          style={{ background: ringGradient(card) }}
          aria-label="Cycle day progress"
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-slate-950/95">
            <span className="text-sm font-semibold text-slate-100">{fmtDays(card.cycleDayCount)}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">days</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
          <p className="text-xs text-slate-400">Events</p>
          <p className="mt-1 text-base font-semibold text-slate-100" data-e2e="cycle-card-event-count">
            {fmtNumber(card.eventCount)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
          <p className="text-xs text-slate-400">Administered mg</p>
          <p className="mt-1 text-base font-semibold text-slate-100" data-e2e="cycle-card-admin-mg">
            {fmtNumber(card.administeredMgTotal)}
          </p>
        </div>
      </div>

      <div className="relative mt-4 space-y-3 text-xs">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-slate-300">
            <span>Cycle target</span>
            <span className="text-slate-400">{fmtRange(card.recommendedCycleDaysMin, card.recommendedCycleDaysMax)}</span>
          </div>
          {card.cycleProgressPercent != null ? (
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700/70">
              <div
                className={`h-full rounded-full ${progressFillClass(card.cycleHealthTone)}`}
                style={{ width: `${Math.max(8, Math.round(card.cycleProgressPercent))}%` }}
              />
            </div>
          ) : (
            <div className="mt-2 h-1.5 w-full rounded-full border border-dashed border-slate-600/70" />
          )}
          <p className="mt-2 text-slate-400">{card.cycleGuidance}</p>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-slate-300">
            <span>Break to next</span>
            <span className="text-slate-400">{fmtRange(card.recommendedBreakDaysMin, card.recommendedBreakDaysMax)}</span>
          </div>
          {card.breakProgressPercent != null ? (
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700/70">
              <div
                className={`h-full rounded-full ${progressFillClass(card.breakHealthTone)}`}
                style={{ width: `${Math.max(8, Math.round(card.breakProgressPercent))}%` }}
              />
            </div>
          ) : (
            <div className="mt-2 h-1.5 w-full rounded-full border border-dashed border-slate-600/70" />
          )}
          <p className="mt-2 text-slate-400">{card.breakGuidance}</p>
          {card.breakDaysToNext != null ? (
            <p className="mt-1 text-slate-300">Current: {fmtDays(card.breakDaysToNext)} days</p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs">
        <p className="text-slate-300">Recent event activity</p>
        <TrendBars trend={card.eventTrend} />
      </div>

      <div className="relative mt-4 text-sm">
        {card.detailHref ? (
          <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:text-sky-300">
            Open cycle detail
            <span aria-hidden="true">→</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-300">
            Start first cycle from the manual form above.
          </span>
        )}
      </div>
    </>
  )

  if (card.detailHref) {
    return (
      <Link
        href={card.detailHref}
        className={coreCardClass}
        data-e2e="cycle-substance-card"
        data-substance-id={card.substanceId}
        data-cycle-status={card.statusBucket}
        data-cycle-instance-id={card.primaryCycle?.cycle_instance_id ?? undefined}
        data-e2e-card-open="true"
        aria-label={`Open cycle details for ${card.substanceName}`}
      >
        {content}
      </Link>
    )
  }

  return (
    <article
      className={coreCardClass}
      data-e2e="cycle-substance-card"
      data-substance-id={card.substanceId}
      data-cycle-status={card.statusBucket}
    >
      {content}
    </article>
  )
}

export default async function CyclesPage() {
  const supabase = await createClient()
  const [cycles, substances] = await Promise.all([listCycleSummary(supabase), listSubstances(supabase)])

  const cards = buildCycleInsightCards({ cycles, substances })
  const substanceOptions = substances.map((s) => ({ id: s.id, label: s.display_name }))
  const hasSubstances = substances.length > 0

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cycles</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Substance-first insights for cycle status, pacing, breaks, and activity. Open any card to inspect
          events or run split/end actions.
        </p>
      </div>

      <section id="start-cycle-manual">
        <CreateCycleNowForm substances={substanceOptions} />
      </section>

      {!hasSubstances ? (
        <EmptyState
          icon="biotech"
          title="Add a substance to start tracking cycles"
          description="Cycles are created from logged events (or manually). Add your first substance, then log an event to begin cycle history."
          actionHref="/substances?focus=new"
          actionLabel="Create substance"
        />
      ) : null}

      {hasSubstances ? (
        <section
          className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm"
          data-e2e="cycles-insight-cards"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Substance insights</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                One card per substance. Active cycles are prioritized at the top.
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cards.length} cards</p>
          </div>

          {cycles.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
              No cycle rows yet. Start a cycle manually above or log a new administration event to let Peptaide infer
              the first cycle.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-e2e="cycles-card-grid">
            {cards.map((card) => (
              <CycleCard key={card.substanceId} card={card} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
