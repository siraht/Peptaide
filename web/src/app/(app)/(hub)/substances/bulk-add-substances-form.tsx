'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import type { BulkAddSubstancesState } from './actions'
import { bulkAddSubstancesAction } from './actions'

export function BulkAddSubstancesForm() {
  const [state, formAction] = useActionState<BulkAddSubstancesState, FormData>(bulkAddSubstancesAction, {
    status: 'idle',
  })

  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return
    if (state.createdCount > 0) {
      if (textareaRef.current) textareaRef.current.value = ''
      router.refresh()
    }
  }, [router, state])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bulk add</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Paste one substance per line. Formats accepted:
        <span className="font-mono"> canonical</span>,
        <span className="font-mono"> canonical,display</span>, or
        <span className="font-mono"> canonical,display,family,target</span>.
        Delimiters supported: comma, tab, or <span className="font-mono">|</span>. Target is one of{' '}
        <span className="font-mono">systemic</span>, <span className="font-mono">cns</span>,{' '}
        <span className="font-mono">both</span>.
      </p>

      <form className="mt-3 space-y-3" action={formAction}>
        <textarea
          ref={textareaRef}
          className="min-h-[140px] w-full rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary p-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
          name="lines"
          placeholder={'semax,Semax,peptide,systemic\nselank,Selank,peptide,cns'}
        />

        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
          Add substances
        </button>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <div className="mt-3 space-y-2">
          <p
            className={`text-sm ${
              state.createdCount === 0
                ? 'text-red-600 dark:text-red-400'
                : state.errors.length > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {state.message}
          </p>
          {state.errors.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
              {state.errors.slice(0, 10).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          ) : null}
          {state.errors.length > 10 ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.errors.length - 10} more errors not shown.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
