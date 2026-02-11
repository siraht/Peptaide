'use client'

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ToastInput } from './use-toast'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastInternal = {
  id: string
  createdAt: number
} & Required<Pick<ToastInput, 'kind' | 'title'>> &
  Pick<ToastInput, 'message' | 'durationMs'>

type ToastContextValue = {
  pushToast: (t: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function kindStyles(kind: ToastKind): { bar: string; icon: string; iconColor: string } {
  if (kind === 'success') {
    return {
      bar: 'bg-emerald-500',
      icon: 'check_circle',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    }
  }
  if (kind === 'error') {
    return {
      bar: 'bg-red-500',
      icon: 'error',
      iconColor: 'text-red-600 dark:text-red-400',
    }
  }
  return {
    bar: 'bg-blue-500',
    icon: 'info',
    iconColor: 'text-blue-600 dark:text-blue-400',
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([])
  const timeouts = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts((xs) => xs.filter((t) => t.id !== id))
    const h = timeouts.current.get(id)
    if (h) window.clearTimeout(h)
    timeouts.current.delete(id)
  }, [])

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = makeId()
      const toast: ToastInternal = {
        id,
        createdAt: Date.now(),
        kind: input.kind,
        title: input.title,
        message: input.message,
        durationMs: input.durationMs,
      }

      setToasts((xs) => {
        const next = [...xs, toast]
        return next.length > 5 ? next.slice(next.length - 5) : next
      })

      const durationMs = Math.max(1500, Math.floor(input.durationMs ?? 4500))
      const h = window.setTimeout(() => dismissToast(id), durationMs)
      timeouts.current.set(id, h)
    },
    [dismissToast],
  )

  useEffect(() => {
    return () => {
      for (const h of timeouts.current.values()) {
        window.clearTimeout(h)
      }
      timeouts.current.clear()
    }
  }, [])

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[60] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions removals"
        data-e2e="toast-viewport"
      >
        {toasts.map((t) => {
          const styles = kindStyles(t.kind)
          return (
            <div
              key={t.id}
              className="relative overflow-hidden rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-xl"
              role="status"
              data-e2e="toast"
              data-kind={t.kind}
            >
              <div className={`absolute left-0 top-0 h-full w-1.5 ${styles.bar}`} aria-hidden="true" />
              <div className="flex gap-3 p-4 pl-5">
                <span className={`material-icons text-lg ${styles.iconColor}`} aria-hidden="true">
                  {styles.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.title}</div>
                  {t.message ? (
                    <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 break-words">{t.message}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss notification"
                >
                  <span className="material-icons text-base" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

