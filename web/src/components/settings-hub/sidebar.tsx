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

function navItemClass(active: boolean): string {
  return `group flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
    active
      ? 'bg-primary/10 text-primary font-medium'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`
}

function navIconClass(active: boolean): string {
  return `text-xl transition-colors ${active ? 'text-primary' : 'group-hover:text-primary'}`
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

  return (
    <nav
      className="w-16 sm:w-64 flex-none bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col justify-between py-4"
      data-e2e="hub-sidebar"
    >
      <div className="space-y-1 px-2 sm:px-3">
        <div className="px-3 mb-2 hidden sm:block">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference Data</p>
        </div>

        <Link className={navItemClass(active === 'substances')} href={substancesHref} aria-label="Substances">
          <span className={`material-icons-outlined ${navIconClass(active === 'substances')}`}>biotech</span>
          <span className="sr-only sm:not-sr-only">Substances</span>
        </Link>

        <Link className={navItemClass(active === 'routes')} href="/routes" aria-label="Routes">
          <span className={`material-icons-outlined ${navIconClass(active === 'routes')}`}>alt_route</span>
          <span className="sr-only sm:not-sr-only">Routes</span>
        </Link>
        <Link className={navItemClass(active === 'formulations')} href="/formulations" aria-label="Formulations">
          <span className={`material-icons-outlined ${navIconClass(active === 'formulations')}`}>medication</span>
          <span className="sr-only sm:not-sr-only">Formulations</span>
        </Link>
        <Link className={navItemClass(active === 'devices')} href="/devices" aria-label="Devices">
          <span className={`material-icons-outlined ${navIconClass(active === 'devices')}`}>vaccines</span>
          <span className="sr-only sm:not-sr-only">Devices</span>
        </Link>

        <div className="h-px bg-border-light dark:bg-border-dark my-3 mx-3 hidden sm:block"></div>

        <div className="px-3 mb-2 hidden sm:block">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operations</p>
        </div>
        <Link className={navItemClass(active === 'inventory')} href="/inventory" aria-label="Inventory">
          <span className={`material-icons-outlined ${navIconClass(active === 'inventory')}`}>inventory_2</span>
          <span className="sr-only sm:not-sr-only">Inventory</span>
        </Link>
        <Link className={navItemClass(active === 'orders')} href="/orders" aria-label="Orders">
          <span className={`material-icons-outlined ${navIconClass(active === 'orders')}`}>shopping_cart</span>
          <span className="sr-only sm:not-sr-only">Orders</span>
        </Link>
        <Link className={navItemClass(active === 'cycles')} href="/cycles" aria-label="Cycles">
          <span className={`material-icons-outlined ${navIconClass(active === 'cycles')}`}>timeline</span>
          <span className="sr-only sm:not-sr-only">Cycles</span>
        </Link>

        <div className="h-px bg-border-light dark:bg-border-dark my-3 mx-3 hidden sm:block"></div>

        <div className="px-3 mb-2 hidden sm:block">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System</p>
        </div>
        <Link className={navItemClass(active === 'distributions')} href="/distributions" aria-label="Distributions">
          <span className={`material-icons-outlined ${navIconClass(active === 'distributions')}`}>functions</span>
          <span className="sr-only sm:not-sr-only">Distributions</span>
        </Link>
        <Link className={navItemClass(active === 'evidence')} href="/evidence-sources" aria-label="Evidence">
          <span className={`material-icons-outlined ${navIconClass(active === 'evidence')}`}>link</span>
          <span className="sr-only sm:not-sr-only">Evidence</span>
        </Link>
        <Link className={navItemClass(active === 'app')} href={appSettingsHref} aria-label="App Settings">
          <span className={`material-icons-outlined ${navIconClass(active === 'app')}`}>settings</span>
          <span className="sr-only sm:not-sr-only">App Settings</span>
        </Link>
      </div>

      <div className="px-2 sm:px-4">
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-600 dark:text-slate-300">
              System Status: Stable
            </span>
          </div>
          <div className="hidden sm:block text-[10px] text-slate-400">MVP (local Supabase)</div>
        </div>
      </div>
    </nav>
  )
}
