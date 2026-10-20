import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Profile } from '../types/database'
import { APP_SECTIONS, DEFAULT_SECTION_PATH, MANAGEMENT_PATH, ORDERS_PATH } from '../lib/sections'
import type { AppSection } from '../lib/sections'
import { Dashboard } from './Dashboard'
import { ManagementScreen } from './ManagementScreen'
import { SectionPlaceholder } from './SectionPlaceholder'
import { TopNav } from './TopNav'
import { contentClass } from './ui'

interface AppShellProps {
  profile: Profile | null
  userName: string
  isAdmin: boolean
  currentUserId: string
  onSignOut: () => void
}

export function AppShell({
  profile,
  userName,
  isAdmin,
  currentUserId,
  onSignOut,
}: AppShellProps) {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const renderSection = (section: AppSection): ReactNode => {
    if (section.path === ORDERS_PATH) {
      return (
        <Dashboard profile={profile} isAdmin={isAdmin} currentUserId={currentUserId} />
      )
    }
    if (section.path === MANAGEMENT_PATH) {
      return (
        <ManagementScreen
          userId={currentUserId}
          isAdmin={isAdmin}
          preferredStoreId={profile?.store_id ?? null}
        />
      )
    }
    return (
      <main className={contentClass}>
        <SectionPlaceholder
          title="Em construção"
          description={section.description}
          badge={`${section.label} · em breve`}
        />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-shell text-gray-900">
      <TopNav userName={userName} isAdmin={isAdmin} onSignOut={onSignOut} />
      <Routes>
        {APP_SECTIONS.map((section) => (
          <Route key={section.path} path={section.path} element={renderSection(section)} />
        ))}
        <Route path="*" element={<Navigate to={DEFAULT_SECTION_PATH} replace />} />
      </Routes>
    </div>
  )
}
