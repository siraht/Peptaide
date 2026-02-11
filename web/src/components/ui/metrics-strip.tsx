export type MetricStripItem = {
  label: string
  value: string
  detail?: string
  tone?: 'neutral' | 'good' | 'warn'
}

function toneClasses(tone: MetricStripItem['tone']): string {
  if (tone === 'good') {
    return 'border-emerald-200/70 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-900/20'
  }
  if (tone === 'warn') {
    return 'border-amber-200/70 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20'
  }
  return 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
}

export function MetricsStrip(props: { items: MetricStripItem[] }) {
  const { items } = props

  if (items.length === 0) return null

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-e2e="metrics-strip">
      {items.map((item) => (
        <article
          key={`${item.label}:${item.value}:${item.detail ?? ''}`}
          className={`rounded-2xl border p-4 shadow-sm ${toneClasses(item.tone)}`}
          data-e2e="metrics-strip-item"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.value}</div>
          {item.detail ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.detail}</p> : null}
        </article>
      ))}
    </section>
  )
}
