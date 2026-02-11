import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="flex h-full overflow-hidden relative" data-e2e="settings-loading">
      <main className="flex-1 flex flex-col bg-background-light dark:bg-background-dark min-w-0">
        <div className="h-16 flex-none px-6 flex items-center justify-between border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark z-10">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Skeleton className="hidden md:block h-6 w-32" rounded="lg" />
            <div className="h-8 w-px bg-border-light dark:bg-border-dark mx-2 hidden md:block" />
            <Skeleton className="h-10 w-[min(26rem,60vw)]" rounded="xl" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-40" rounded="xl" />
            <Skeleton className="h-10 w-36" rounded="xl" />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" rounded="xl" />
            <Skeleton className="h-8 w-full" rounded="xl" />
            <Skeleton className="h-8 w-full" rounded="xl" />
            <Skeleton className="h-8 w-full" rounded="xl" />
            <Skeleton className="h-8 w-full" rounded="xl" />
            <Skeleton className="h-8 w-[85%]" rounded="xl" />
          </div>
        </div>

        <div className="h-10 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 flex items-center justify-between text-xs text-slate-500">
          <Skeleton className="h-4 w-28" rounded="lg" />
          <Skeleton className="h-4 w-20" rounded="lg" />
        </div>
      </main>

      <aside className="hidden xl:flex w-96 flex-none bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark flex-col shadow-xl z-20">
        <div className="p-6 border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-800/20">
          <Skeleton className="h-4 w-24" rounded="lg" />
          <Skeleton className="mt-2 h-8 w-48" rounded="xl" />
          <Skeleton className="mt-2 h-4 w-56" rounded="lg" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 flex-1" rounded="xl" />
            <Skeleton className="h-8 flex-1" rounded="xl" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          <Skeleton className="h-36 w-full" rounded="2xl" />
          <Skeleton className="h-36 w-full" rounded="2xl" />
          <Skeleton className="h-36 w-full" rounded="2xl" />
        </div>
      </aside>
    </div>
  )
}

