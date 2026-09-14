import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Profile, UserRole } from './types/database'
import { useAuth } from './hooks/useAuth'
import { LoadingScreen } from './components/AppScreen'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'

export default function App() {
  const { user, loading, signIn, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('gerente')

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setUserRole('gerente')
      return
    }
    let cancelled = false
    void (async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      console.log('Dados do Perfil no Supabase:', profile, 'Erro:', error)
      const role: UserRole = profile?.role || 'gerente'
      const isActive = profile?.is_active ?? true
      setProfile(profile ?? null)
      setUserRole(role)
      if (!isActive) void signOut()
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, signOut])

  if (loading) {
    return <LoadingScreen message="Verificando sessão..." />
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} />
  }

  const baseName = profile?.full_name || user.email || 'Usuário'
  const userName = profile?.username ? `${baseName} (@${profile.username})` : baseName

  return (
    <Dashboard
      profile={profile}
      userName={userName}
      isAdmin={userRole === 'admin'}
      currentUserId={user.id}
      onSignOut={signOut}
    />
  )
}