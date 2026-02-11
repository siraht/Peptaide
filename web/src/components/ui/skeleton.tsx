export function Skeleton(props: { className?: string; rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' }) {
  const { className = '', rounded = 'md' } = props
  const r =
    rounded === 'sm'
      ? 'rounded-sm'
      : rounded === 'lg'
        ? 'rounded-lg'
        : rounded === 'xl'
          ? 'rounded-xl'
          : rounded === '2xl'
            ? 'rounded-2xl'
            : 'rounded-md'

  return (
    <div
      className={`animate-pulse bg-slate-200/70 dark:bg-slate-700/60 ${r} ${className}`.trim()}
      aria-hidden="true"
    />
  )
}

