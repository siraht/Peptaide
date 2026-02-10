import { SettingsHubSidebar } from '@/components/settings-hub/sidebar'

export default function SettingsHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden relative">
      <SettingsHubSidebar />
      {/* Children own their scroll container so pages like /settings can keep a fixed right-side editor. */}
      <div className="flex-1 min-w-0 bg-background-light dark:bg-background-dark overflow-hidden">
        {children}
      </div>
    </div>
  )
}
