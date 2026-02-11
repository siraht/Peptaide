import Link from 'next/link'

export function SetupStepShell(props: {
  title: string
  description: string
  children: React.ReactNode
  backHref?: string | null
  backLabel?: string
  nextHref?: string | null
  nextLabel?: string
  nextDisabledReason?: string | null
}) {
  const {
    title,
    description,
    children,
    backHref = null,
    backLabel = 'Back',
    nextHref = null,
    nextLabel = 'Next',
    nextDisabledReason = null,
  } = props

  return (
    <div className="space-y-4" data-e2e="setup-step">
      <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </div>

        <div className="mt-6">{children}</div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-light dark:border-border-dark pt-4">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary/40 hover:text-primary transition-colors"
              data-e2e="setup-back"
            >
              <span className="material-icons text-base" aria-hidden="true">
                arrow_back
              </span>
              {backLabel}
            </Link>
          ) : (
            <div />
          )}

          <div className="flex flex-col items-end gap-2">
            {nextHref && !nextDisabledReason ? (
              <Link
                href={nextHref}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                data-e2e="setup-next"
              >
                {nextLabel}
                <span className="material-icons text-base" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            ) : nextDisabledReason ? (
              <div className="text-sm">
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-200/80 dark:bg-slate-700/60 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-not-allowed"
                  aria-disabled="true"
                  data-e2e="setup-next-disabled"
                >
                  {nextLabel}
                  <span className="material-icons text-base" aria-hidden="true">
                    arrow_forward
                  </span>
                </button>
              </div>
            ) : null}

            {nextDisabledReason ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-[28rem] text-right">
                {nextDisabledReason}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

