import { signOut } from '@/app/actions/auth'

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Placeholder page for the keyboard-first Today Log.
        </p>
      </div>

      <form action={signOut}>
        <button className="rounded-md border px-3 py-2 text-sm" type="submit">
          Sign out
        </button>
      </form>
    </div>
  )
}

