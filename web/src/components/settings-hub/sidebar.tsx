'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type ActiveKey =
  | 'substances'
  | 'routes'
  | 'formulations'
  | 'devices'
  | 'inventory'
  | 'orders'
  | 'cycles'
  | 'distributions'
  | 'evidence'
  | 'app'
  | null

type NavItem = {
  key: Exclude<ActiveKey, null>
  label: string
  icon: string
  href: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

function isTab(x: string | null): x is 'substances' | 'app' {
  return x === 'substances' || x === 'app'
}

function activeKeyForPath(pathname: string, searchParams: URLSearchParams): ActiveKey {
  if (pathname === '/settings') {
    const tabRaw = searchParams.get('tab')
    const tab = isTab(tabRaw) ? tabRaw : 'substances'
    return tab
  }
  if (pathname.startsWith('/routes')) return 'routes'
  if (pathname.startsWith('/formulations')) return 'formulations'
  if (pathname.startsWith('/devices')) return 'devices'
  if (pathname.startsWith('/inventory')) return 'inventory'
  if (pathname.startsWith('/orders')) return 'orders'
  if (pathname.startsWith('/cycles')) return 'cycles'
  if (pathname.startsWith('/distributions')) return 'distributions'
  if (pathname.startsWith('/evidence-sources')) return 'evidence'
  if (pathname.startsWith('/substances')) return 'substances'
  return null
}

function desktopItemClass(active: boolean): string {
  return `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
    active
      ? 'bg-primary/12 text-primary ring-1 ring-primary/25'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
  }`
}

function mobileChipClass(active: boolean): string {
  return `group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    active
      ? 'border-primary/40 bg-primary/12 text-primary'
      : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:border-primary/30 hover:text-primary'
  }`
}

function desktopIconClass(active: boolean): string {
  return `material-icons-outlined text-[20px] transition-colors ${active ? 'text-primary' : 'group-hover:text-primary'}`
}

function mobileIconClass(active: boolean): string {
  return `material-icons-outlined text-[16px] transition-colors ${active ? 'text-primary' : 'group-hover:text-primary'}`
}

export function SettingsHubSidebar() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()

  const active = activeKeyForPath(pathname, searchParams)
  const selectedSubstanceId = searchParams.get('substance_id')

  const substancesHref = (() => {
    const sp = new URLSearchParams()
    sp.set('tab', 'substances')
    if (selectedSubstanceId) sp.set('substance_id', selectedSubstanceId)
    return `/settings?${sp.toString()}`
  })()

  const appSettingsHref = (() => {
    const sp = new URLSearchParams()
    sp.set('tab', 'app')
    return `/settings?${sp.toString()}`
  })()

  const groups: NavGroup[] = [
    {
      title: 'Reference Data',
      items: [
        { key: 'substances', label: 'Substances', icon: 'biotech', href: substancesHref },
        { key: 'routes', label: 'Routes', icon: 'alt_route', href: '/routes' },
        { key: 'formulations', label: 'Formulations', icon: 'medication', href: '/formulations' },
        { key: 'devices', label: 'Devices', icon: 'vaccines', href: '/devices' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { key: 'inventory', label: 'Inventory', icon: 'inventory_2', href: '/inventory' },
        { key: 'orders', label: 'Orders', icon: 'shopping_cart', href: '/orders' },
        { key: 'cycles', label: 'Cycles', icon: 'timeline', href: '/cycles' },
      ],
    },
    {
      title: 'System',
      items: [
        { key: 'distributions', label: 'Distributions', icon: 'functions', href: '/distributions' },
        { key: 'evidence', label: 'Evidence', icon: 'link', href: '/evidence-sources' },
        { key: 'app', label: 'App Settings', icon: 'settings', href: appSettingsHref },
      ],
    },
  ]

  const flatItems = groups.flatMap((g) => g.items)
  const activeItem = flatItems.find((x) => x.key === active) ?? null

  return (
    <>
      <nav
        className="hidden sm:flex w-[17.5rem] flex-none flex-col justify-between border-r border-border-light dark:border-border-dark bg-surface-light/95 dark:bg-surface-dark/95 px-3 py-4"
        data-e2e="hub-sidebar"
      >
        <div className="space-y-2">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="px-2 pb-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.title}</p>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.key === active
                  return (
                    <Link key={item.key} href={item.href} className={desktopItemClass(isActive)} aria-label={item.label}>
                      <span className={desktopIconClass(isActive)}>{item.icon}</span>
                      <span className="truncate text-[15px]">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
              {group.title !== 'System' ? (
                <div className="mx-2 mt-3 h-px bg-gradient-to-r from-transparent via-border-light to-transparent dark:via-border-dark" />
              ) : null}
            </section>
          ))}
        </div>

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/30 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">System Status: Stable</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">MVP (local Supabase)</p>
        </div>
      </nav>

      <nav
        className="sm:hidden shrink-0 border-b border-border-light dark:border-border-dark bg-surface-light/95 dark:bg-surface-dark/95"
        data-e2e="hub-sidebar"
      >
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Control Hub</p>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{activeItem?.label ?? 'Navigation'}</p>
            </div>
            <Link
              href="/today"
              className="inline-flex items-center gap-1 rounded-full border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              <span className="material-icons-outlined text-[14px]" aria-hidden="true">
                dashboard
              </span>
              Hub
            </Link>
          </div>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" data-e2e="hub-mobile-nav">
            {flatItems.map((item) => {
              const isActive = item.key === active
              return (
                <Link key={item.key} href={item.href} aria-label={item.label} className={mobileChipClass(isActive)}>
                  <span className={mobileIconClass(isActive)}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
