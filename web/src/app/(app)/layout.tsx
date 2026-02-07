import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <Link className="font-semibold" href="/today">
            Peptaide
          </Link>
          <div className="text-sm text-zinc-700">{data.user.email}</div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  )
}

