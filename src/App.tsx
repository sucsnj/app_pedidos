import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Profile, UserRole } from './types/database'
import { useAuth } from './hooks/useAuth'
import { isOffline, isOfflineError } from './lib/offlineQueue'
import { cacheProfile, readProfile } from './lib/localCache'
import { LoadingScreen } from './components/AppScreen'
import { LoginScreen } from './components/LoginScreen'
import { AppShell } from './components/AppShell'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'

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
      if (error) {
        // O espelho só é usado em falha de rede — um erro real do banco não
        // pode ser mascarado por um perfil velho.
        if (isOffline() || isOfflineError(error)) {
          const cached = await readProfile(user.id)
          if (cancelled) return
          if (cached) {
            setProfile(cached)
            setUserRole(cached.role)
            if (!cached.is_active) void signOut()
            return
          }
        }
        console.log('Dados do Perfil no Supabase:', profile, 'Erro:', error)
        setProfile(null)
        setUserRole('gerente')
        return
      }
      console.log('Dados do Perfil no Supabase:', profile, 'Erro:', error)
      const role: UserRole = profile?.role || 'gerente'
      const isActive = profile?.is_active ?? true
      void cacheProfile(user.id, profile)
      setProfile(profile ?? null)
      setUserRole(role)
      if (!isActive) void signOut()
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, signOut])

  if (loading) {
    return (
      <>
        <PwaUpdatePrompt />
        <LoadingScreen message="Verificando sessão..." />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <PwaUpdatePrompt />
        <LoginScreen onSignIn={signIn} />
      </>
    )
  }

  const baseName = profile?.full_name || user.email || 'Usuário'
  const userName = profile?.username ? `${baseName} (@${profile.username})` : baseName

  return (
    <>
      <PwaUpdatePrompt />
      <AppShell
        profile={profile}
        userName={userName}
        isAdmin={userRole === 'admin'}
        currentUserId={user.id}
        onSignOut={signOut}
      />
    </>
  )
}
