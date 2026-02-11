'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Command } from 'cmdk'

export type CommandPaletteItem = {
  label: string
  href: string
  keywords?: string[]
}

type PaletteItem = CommandPaletteItem

function isOpenShortcut(e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== 'k') return false
  return e.metaKey || e.ctrlKey
}

export function CommandPalette(props: { logItems?: CommandPaletteItem[] } = {}) {
  const logItems = props.logItems ?? []
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const actionItems: PaletteItem[] = useMemo(
    () => [
      { label: 'Setup wizard', href: '/setup', keywords: ['onboarding', 'setup'] },
      { label: 'Log event', href: '/today?focus=log', keywords: ['quick', 'dose'] },
      { label: 'Add substance', href: '/substances?focus=new', keywords: ['create', 'new'] },
      { label: 'Add formulation', href: '/formulations?focus=new', keywords: ['create', 'new'] },
    ],
    [],
  )

  const navItems: PaletteItem[] = useMemo(
    () => [
      { label: 'Today', href: '/today', keywords: ['log', 'events'] },
      { label: 'Analytics', href: '/analytics', keywords: ['charts', 'totals', 'spend'] },
      { label: 'Substances', href: '/substances', keywords: ['peptide'] },
      { label: 'Routes', href: '/routes', keywords: ['im', 'sc', 'iv'] },
      { label: 'Devices', href: '/devices', keywords: ['syringe', 'dropper'] },
      { label: 'Formulations', href: '/formulations', keywords: ['compound'] },
      { label: 'Inventory', href: '/inventory', keywords: ['vials'] },
      { label: 'Orders', href: '/orders', keywords: ['vendors'] },
      { label: 'Cycles', href: '/cycles', keywords: ['breaks'] },
      { label: 'Distributions', href: '/distributions', keywords: ['uncertainty', 'monte carlo'] },
      { label: 'Evidence sources', href: '/evidence-sources', keywords: ['citations', 'papers'] },
      { label: 'Settings', href: '/settings', keywords: ['profile', 'export', 'import'] },
    ],
    [],
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isOpenShortcut(e)) {
        e.preventDefault()
        setOpen((v) => {
          const next = !v
          setQuery('')
          return next
        })
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  function runNav(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 text-sm text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
        type="button"
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
        aria-label="Open command palette"
        data-e2e="cmdk-open"
      >
        <span className="material-icons-outlined text-[18px]" aria-hidden="true">
          search
        </span>
        <span className="hidden sm:inline">Search</span>
        <span className="inline text-xs sm:hidden">Find</span>
        <span className="hidden md:inline font-mono text-[11px] text-slate-500">Ctrl/Cmd+K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-16 backdrop-blur-sm sm:pt-24"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) {
              setOpen(false)
              setQuery('')
            }
          }}
          data-e2e="cmdk-overlay"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border-light/70 bg-surface-light shadow-2xl dark:border-border-dark/70 dark:bg-surface-dark focus-within:ring-2 focus-within:ring-primary/40">
            <Command label="Command palette">
              <div className="border-b border-border-light dark:border-border-dark px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="material-icons-outlined text-[14px]" aria-hidden="true">
                    keyboard_command_key
                  </span>
                  Jump anywhere
                </div>
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  className="mt-2 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  placeholder="Search pages and actions..."
                  data-e2e="cmdk-input"
                />
              </div>
              <Command.List className="max-h-[65vh] overflow-y-auto p-3">
                <Command.Empty className="rounded-xl border border-dashed border-border-light p-6 text-center text-sm text-slate-600 dark:border-border-dark dark:text-slate-400">
                  No results.
                </Command.Empty>

                <Command.Group heading="Actions" className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {actionItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      keywords={item.keywords}
                      className="mt-1 flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors aria-selected:bg-primary/10 aria-selected:text-primary dark:text-slate-100"
                      onSelect={() => runNav(item.href)}
                      data-e2e={`cmdk-item-${item.href}`}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>

                {logItems.length > 0 ? (
                  <Command.Group heading="Log" className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {logItems.map((item) => (
                      <Command.Item
                        key={item.href}
                        value={item.label}
                        keywords={item.keywords}
                        className="mt-1 flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors aria-selected:bg-primary/10 aria-selected:text-primary dark:text-slate-100"
                        onSelect={() => runNav(item.href)}
                        data-e2e={`cmdk-item-${item.href}`}
                      >
                        {item.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading="Navigate" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {navItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      keywords={item.keywords}
                      className="mt-1 flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors aria-selected:bg-primary/10 aria-selected:text-primary dark:text-slate-100"
                      onSelect={() => runNav(item.href)}
                      data-e2e={`cmdk-item-${item.href}`}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  )
}
