'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import type { NotificationItem, NotificationSeverity } from '@/lib/notifications/notifications'

function severityMeta(s: NotificationSeverity): { icon: string; pill: string; pillClass: string } {
  if (s === 'urgent') {
    return {
      icon: 'priority_high',
      pill: 'Urgent',
      pillClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    }
  }
  if (s === 'warning') {
    return {
      icon: 'warning',
      pill: 'Warning',
      pillClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    }
  }
  return {
    icon: 'info',
    pill: 'Info',
    pillClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  }
}

export function NotificationsBell(props: { items: NotificationItem[] }) {
  const items = props.items
  const count = items.length

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    function onMouseDown(e: MouseEvent) {
      const root = rootRef.current
      if (!root) return
      const target = e.target
      if (!(target instanceof Node)) return
      if (!root.contains(target)) setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative" data-e2e="notifications-root">
      <button
        className="relative rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
        aria-label="Open notifications"
        aria-expanded={open}
        aria-controls={panelId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-e2e="notifications-button"
      >
        <span className="material-icons" aria-hidden="true">
          notifications
        </span>
        {count > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center shadow"
            aria-label={`${count} active alerts`}
            data-e2e="notifications-badge"
          >
            {count > 9 ? '9+' : String(count)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-2xl max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-16 max-sm:mt-0"
          data-e2e="notifications-panel"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border-light bg-slate-50/70 p-4 dark:border-border-dark dark:bg-slate-900/20">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Alerts computed from your inventory and spend data.
              </div>
            </div>
            <Link
              className="shrink-0 text-xs font-medium text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-slate-100 underline underline-offset-2"
              href="/settings?tab=app#notifications"
              onClick={() => setOpen(false)}
              data-e2e="notifications-open-settings"
            >
              Settings
            </Link>
          </div>

          {count === 0 ? (
            <div className="p-5">
              <div className="flex items-start gap-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
                <span className="material-icons text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                  task_alt
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">All clear</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    No active alerts right now. You can tighten thresholds in Settings if you want earlier warnings.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto custom-scrollbar">
              <ul className="divide-y divide-border-light dark:divide-border-dark">
                {items.map((it) => {
                  const meta = severityMeta(it.severity)
                  const content = (
                  <div className="flex gap-3 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="material-icons text-slate-500 dark:text-slate-400" aria-hidden="true">
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {it.title}
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.pillClass}`}>
                            {meta.pill}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 break-words">
                          {it.description}
                        </div>
                      </div>
                      {it.href ? (
                        <span className="material-icons text-slate-400" aria-hidden="true">
                          chevron_right
                        </span>
                      ) : null}
                    </div>
                  )

                  return (
                    <li key={it.id} data-e2e="notification-item" data-id={it.id}>
                      {it.href ? (
                        <Link href={it.href} onClick={() => setOpen(false)} className="block">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
