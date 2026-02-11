import { Skeleton } from '@/components/ui/skeleton'

export default function SetupLoading() {
  return (
    <div className="min-h-full bg-background-light dark:bg-background-dark" data-e2e="setup-loading">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Skeleton className="h-6 w-40" rounded="xl" />
            <Skeleton className="mt-3 h-8 w-32" rounded="xl" />
            <Skeleton className="mt-2 h-4 w-[28rem]" rounded="xl" />
          </div>
          <Skeleton className="hidden sm:block h-10 w-32" rounded="xl" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
              <Skeleton className="h-4 w-20" rounded="xl" />
              <Skeleton className="mt-2 h-4 w-40" rounded="xl" />
              <Skeleton className="mt-4 h-2 w-full" rounded="xl" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-14 w-full" rounded="2xl" />
                <Skeleton className="h-14 w-full" rounded="2xl" />
                <Skeleton className="h-14 w-full" rounded="2xl" />
                <Skeleton className="h-14 w-full" rounded="2xl" />
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 shadow-sm">
              <Skeleton className="h-6 w-48" rounded="xl" />
              <Skeleton className="mt-2 h-4 w-[32rem]" rounded="xl" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-10 w-full" rounded="xl" />
                <Skeleton className="h-10 w-full" rounded="xl" />
                <Skeleton className="h-10 w-[70%]" rounded="xl" />
              </div>
              <div className="mt-8 flex justify-between gap-4 border-t border-border-light dark:border-border-dark pt-4">
                <Skeleton className="h-10 w-28" rounded="xl" />
                <Skeleton className="h-10 w-28" rounded="xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

