'use client'

import { useContext } from 'react'

import { ToastContext, type ToastKind } from './toast-provider'

export type ToastInput = {
  kind: ToastKind
  title: string
  message?: string
  durationMs?: number
}

export function useToast(): { pushToast: (t: ToastInput) => void } {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>.')
  }
  return ctx
}

