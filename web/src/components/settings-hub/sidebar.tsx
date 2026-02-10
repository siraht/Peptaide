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
  return `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
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
    <nav className="w-64 flex-none bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col justify-between py-4">
      <div className="space-y-1 px-3">
        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference Data</p>
        </div>

        <Link className={navItemClass(active === 'substances')} href={substancesHref}>
          <span className={`material-icons-outlined ${navIconClass(active === 'substances')}`}>biotech</span>
          Substances
        </Link>

        <Link className={`${navItemClass(active === 'routes')} group`} href="/routes">
          <span className={`material-icons-outlined ${navIconClass(active === 'routes')}`}>alt_route</span>
          Routes
        </Link>
        <Link className={`${navItemClass(active === 'formulations')} group`} href="/formulations">
          <span className={`material-icons-outlined ${navIconClass(active === 'formulations')}`}>medication</span>
          Formulations
        </Link>
        <Link className={`${navItemClass(active === 'devices')} group`} href="/devices">
          <span className={`material-icons-outlined ${navIconClass(active === 'devices')}`}>vaccines</span>
          Devices
        </Link>

        <div className="h-px bg-border-light dark:bg-border-dark my-3 mx-3"></div>

        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operations</p>
        </div>
        <Link className={`${navItemClass(active === 'inventory')} group`} href="/inventory">
          <span className={`material-icons-outlined ${navIconClass(active === 'inventory')}`}>inventory_2</span>
          Inventory
        </Link>
        <Link className={`${navItemClass(active === 'orders')} group`} href="/orders">
          <span className={`material-icons-outlined ${navIconClass(active === 'orders')}`}>shopping_cart</span>
          Orders
        </Link>
        <Link className={`${navItemClass(active === 'cycles')} group`} href="/cycles">
          <span className={`material-icons-outlined ${navIconClass(active === 'cycles')}`}>timeline</span>
          Cycles
        </Link>

        <div className="h-px bg-border-light dark:bg-border-dark my-3 mx-3"></div>

        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System</p>
        </div>
        <Link className={`${navItemClass(active === 'distributions')} group`} href="/distributions">
          <span className={`material-icons-outlined ${navIconClass(active === 'distributions')}`}>functions</span>
          Distributions
        </Link>
        <Link className={`${navItemClass(active === 'evidence')} group`} href="/evidence-sources">
          <span className={`material-icons-outlined ${navIconClass(active === 'evidence')}`}>link</span>
          Evidence
        </Link>
        <Link className={navItemClass(active === 'app')} href={appSettingsHref}>
          <span className={`material-icons-outlined ${navIconClass(active === 'app')}`}>settings</span>
          App Settings
        </Link>
      </div>

      <div className="px-4">
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">System Status: Stable</span>
          </div>
          <div className="text-[10px] text-slate-400">MVP (local Supabase)</div>
        </div>
      </div>
    </nav>
  )
}

