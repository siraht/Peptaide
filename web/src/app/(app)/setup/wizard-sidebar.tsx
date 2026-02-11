'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type SetupStep = {
  key: string
  title: string
  description: string
  href: string
  status: 'todo' | 'done' | 'blocked'
  badge?: string
}

function statusIcon(status: SetupStep['status']): { icon: string; cls: string } {
  if (status === 'done') return { icon: 'check_circle', cls: 'text-emerald-600 dark:text-emerald-400' }
  if (status === 'blocked') return { icon: 'lock', cls: 'text-slate-400' }
  return { icon: 'radio_button_unchecked', cls: 'text-slate-400' }
}

function stepClass(active: boolean): string {
  return `group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${
    active
      ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
      : 'border-transparent hover:border-border-light dark:hover:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800/30'
  }`
}

export function SetupWizardSidebar(props: { steps: SetupStep[] }) {
  const pathname = usePathname() || ''
  const steps = props.steps

  return (
    <nav className="space-y-1" aria-label="Setup steps" data-e2e="setup-sidebar">
      {steps.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`)
        const icon = statusIcon(s.status)

        const meta = (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.title}</div>
              {s.badge ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200">
                  {s.badge}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.description}</div>
          </div>
        )

        if (s.status === 'blocked') {
          return (
            <div key={s.key} className={stepClass(active)} aria-current={active ? 'step' : undefined}>
              <span className={`material-icons text-lg ${icon.cls}`} aria-hidden="true">
                {icon.icon}
              </span>
              {meta}
            </div>
          )
        }

        return (
          <Link key={s.key} href={s.href} className={stepClass(active)} aria-current={active ? 'step' : undefined}>
            <span className={`material-icons text-lg ${icon.cls}`} aria-hidden="true">
              {icon.icon}
            </span>
            {meta}
          </Link>
        )
      })}
    </nav>
  )
}

