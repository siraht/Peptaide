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

  // Ensure a profile row exists for the signed-in user. This is idempotent and relies on DB defaults
  // so it will not overwrite user preferences once a profile is configured.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ user_id: data.user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

  if (profileError) {
    console.error('Failed to ensure profile row exists', profileError)
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
