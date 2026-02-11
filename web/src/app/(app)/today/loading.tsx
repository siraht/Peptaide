import { Skeleton } from '@/components/ui/skeleton'

export default function TodayLoading() {
  return (
    <div className="flex flex-col lg:flex-row h-full" data-e2e="today-loading">
      <section className="flex-1 min-w-0">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <Skeleton className="h-7 w-40" rounded="lg" />
              <Skeleton className="mt-2 h-4 w-72" rounded="lg" />
            </div>
            <Skeleton className="h-9 w-28" rounded="lg" />
          </div>

          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" rounded="lg" />
              <Skeleton className="h-8 w-24" rounded="lg" />
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-[70%]" rounded="xl" />
            </div>
          </div>

          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" rounded="lg" />
              <Skeleton className="h-4 w-24" rounded="lg" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
              <Skeleton className="h-4 w-28" rounded="lg" />
              <Skeleton className="mt-3 h-16 w-full" rounded="xl" />
              <Skeleton className="mt-3 h-2 w-full" rounded="xl" />
            </div>
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
              <Skeleton className="h-4 w-28" rounded="lg" />
              <Skeleton className="mt-3 h-16 w-full" rounded="xl" />
              <Skeleton className="mt-3 h-2 w-full" rounded="xl" />
            </div>
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
              <Skeleton className="h-4 w-40" rounded="lg" />
              <Skeleton className="mt-3 h-16 w-full" rounded="xl" />
              <Skeleton className="mt-3 h-2 w-full" rounded="xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="lg:w-2/5 w-full flex flex-col bg-gray-50 dark:bg-[#0c1017] lg:border-l border-gray-200 dark:border-gray-800">
        <div className="p-6 shrink-0 flex justify-between items-center">
          <div>
            <Skeleton className="h-6 w-40" rounded="lg" />
            <Skeleton className="mt-2 h-4 w-28" rounded="lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" rounded="lg" />
            <Skeleton className="h-8 w-8" rounded="lg" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3 min-w-0">
                <Skeleton className="h-10 w-10" rounded="lg" />
                <div className="min-w-0">
                  <Skeleton className="h-4 w-40" rounded="lg" />
                  <Skeleton className="mt-2 h-3 w-28" rounded="lg" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-3 w-16 ml-auto" rounded="lg" />
                <Skeleton className="mt-2 h-6 w-14 ml-auto" rounded="lg" />
              </div>
            </div>
            <Skeleton className="mt-4 h-2 w-full" rounded="xl" />
            <Skeleton className="mt-3 h-2 w-full" rounded="xl" />
            <Skeleton className="mt-3 h-2 w-[85%]" rounded="xl" />
          </div>

          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3 min-w-0">
                <Skeleton className="h-10 w-10" rounded="lg" />
                <div className="min-w-0">
                  <Skeleton className="h-4 w-40" rounded="lg" />
                  <Skeleton className="mt-2 h-3 w-28" rounded="lg" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-3 w-16 ml-auto" rounded="lg" />
                <Skeleton className="mt-2 h-6 w-14 ml-auto" rounded="lg" />
              </div>
            </div>
            <Skeleton className="mt-4 h-2 w-full" rounded="xl" />
            <Skeleton className="mt-3 h-2 w-full" rounded="xl" />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark">
          <Skeleton className="h-12 w-full" rounded="2xl" />
        </div>
      </section>
    </div>
  )
}

