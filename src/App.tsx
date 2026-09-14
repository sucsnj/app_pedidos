import { useAuth } from './hooks/useAuth'
import { LoadingScreen } from './components/AppScreen'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'

export default function App() {
  const { user, profile, loading, isAdmin, signIn, signOut } = useAuth()

  if (loading) {
    return <LoadingScreen message="Verificando sessão..." />
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} />
  }

  return (
    <Dashboard
      profile={profile}
      userName={profile?.full_name || user.email || 'Usuário'}
      isAdmin={isAdmin}
      onSignOut={signOut}
    />
  )
}