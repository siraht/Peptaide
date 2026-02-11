import Link from 'next/link'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: string
  title: string
  description: ReactNode
  actionHref?: string
  actionLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  className?: string
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-border-light bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm dark:border-border-dark dark:from-slate-900/40 dark:to-surface-dark ${className ?? ''}`.trim()}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-icons-outlined text-[19px]" aria-hidden="true">
            {icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <div className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</div>

          {actionHref && actionLabel ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={actionHref}
                className="inline-flex items-center rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
              >
                {actionLabel}
              </Link>
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  className="inline-flex items-center rounded-xl border border-border-light bg-surface-light px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:border-border-dark dark:bg-surface-dark dark:text-slate-300 dark:focus-visible:ring-offset-background-dark"
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
