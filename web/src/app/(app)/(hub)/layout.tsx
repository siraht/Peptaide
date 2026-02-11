import { SettingsHubSidebar } from '@/components/settings-hub/sidebar'

export default function SettingsHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden sm:flex-row">
      <SettingsHubSidebar />
      {/* Children own their internal scroll containers. */}
      <div className="min-w-0 flex-1 overflow-hidden bg-background-light dark:bg-background-dark">
        {children}
      </div>
    </div>
  )
}
