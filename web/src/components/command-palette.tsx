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
    // Wait a tick so the input exists in the DOM.
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
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm text-zinc-700 hover:text-zinc-900"
        type="button"
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
        aria-label="Open command palette"
      >
        <span className="hidden sm:inline">Search</span>
        <span className="font-mono text-xs text-zinc-500">Ctrl/Cmd+K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) {
              setOpen(false)
              setQuery('')
            }
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-white shadow-2xl">
            <Command label="Command palette">
              <div className="border-b p-3">
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                  placeholder="Type to search..."
                />
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-zinc-600">
                  No results.
                </Command.Empty>

                <Command.Group heading="Actions" className="text-xs text-zinc-500">
                  {actionItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      keywords={item.keywords}
                      className="flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-zinc-900 outline-none aria-selected:bg-zinc-100"
                      onSelect={() => runNav(item.href)}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>

                {logItems.length > 0 ? (
                  <Command.Group heading="Log" className="mt-2 text-xs text-zinc-500">
                    {logItems.map((item) => (
                      <Command.Item
                        key={item.href}
                        value={item.label}
                        keywords={item.keywords}
                        className="flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-zinc-900 outline-none aria-selected:bg-zinc-100"
                        onSelect={() => runNav(item.href)}
                      >
                        {item.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading="Navigate" className="mt-2 text-xs text-zinc-500">
                  {navItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      keywords={item.keywords}
                      className="flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-zinc-900 outline-none aria-selected:bg-zinc-100"
                      onSelect={() => runNav(item.href)}
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
