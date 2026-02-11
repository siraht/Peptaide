'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type CompactModuleTone = 'neutral' | 'good' | 'warn'

export type CompactModuleSummaryItem = {
  label: string
  value: string
  tone?: CompactModuleTone
}

function toneClasses(tone: CompactModuleTone | undefined): string {
  if (tone === 'good') {
    return 'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-200'
  }
  if (tone === 'warn') {
    return 'border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200'
  }
  return 'border-border-light bg-slate-50 text-slate-700 dark:border-border-dark dark:bg-slate-900/50 dark:text-slate-200'
}

export function CompactEntryModule(props: {
  id: string
  title: string
  description?: string
  summaryItems?: CompactModuleSummaryItem[]
  defaultCollapsed?: boolean
  storageKey?: string
  children: React.ReactNode
  className?: string
  emptyCta?: {
    href: string
    label: string
  }
}) {
  const {
    id,
    title,
    description,
    summaryItems = [],
    defaultCollapsed = true,
    storageKey,
    children,
    className,
    emptyCta,
  } = props

  const [open, setOpen] = useState(() => {
    const fallback = !defaultCollapsed
    if (!storageKey || typeof window === 'undefined') return fallback
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw === 'open') return true
      if (raw === 'closed') return false
    } catch {
      // Storage can be disabled in private mode; fall back to in-memory state.
    }
    return fallback
  })

  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, open ? 'open' : 'closed')
    } catch {
      // Ignore storage write failures.
    }
  }, [open, storageKey])

  const panelId = useMemo(() => `compact-module-panel-${id}`, [id])

  return (
    <section
      className={`rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm ${className ?? ''}`.trim()}
      data-e2e="compact-module"
      data-module-id={id}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Entry Module</div>
          <h2 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}

          {summaryItems.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summaryItems.map((item) => (
                <div
                  key={`${item.label}:${item.value}`}
                  className={`rounded-lg border px-2.5 py-2 ${toneClasses(item.tone)}`}
                  data-e2e="compact-module-summary-item"
                >
                  <div className="text-[11px] uppercase tracking-wide opacity-80">{item.label}</div>
                  <div className="mt-0.5 text-sm font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {!open && emptyCta ? (
            <div className="mt-3">
              <Link
                href={emptyCta.href}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-primary hover:decoration-primary/40 dark:text-slate-300"
              >
                {emptyCta.label}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex-none">
          {open ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/50 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:border-primary/40 hover:text-primary"
              aria-expanded="true"
              aria-controls={panelId}
              data-e2e="compact-module-close"
              onClick={() => setOpen(false)}
            >
              <span className="material-icons text-base" aria-hidden="true">
                expand_less
              </span>
              Close editor
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              aria-expanded="false"
              aria-controls={panelId}
              data-e2e="compact-module-open"
              onClick={() => setOpen(true)}
            >
              <span className="material-icons text-base" aria-hidden="true">
                edit_note
              </span>
              Open editor
            </button>
          )}
        </div>
      </div>

      <div
        id={panelId}
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'} `}
        data-e2e="compact-module-content"
        data-expanded={open ? '1' : '0'}
      >
        <div className={`overflow-hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>{children}</div>
      </div>
    </section>
  )
}
