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
      className={`relative overflow-hidden bg-slate-200/80 dark:bg-slate-700/60 ${r} ${className} before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/55 before:to-transparent before:animate-[peptaide-shimmer_1.6s_ease-in-out_infinite] dark:before:via-slate-300/10 motion-reduce:before:hidden`.trim()}
      aria-hidden="true"
    />
  )
}
