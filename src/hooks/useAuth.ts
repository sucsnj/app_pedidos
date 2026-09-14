import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'
import { getErrorMessage } from '../lib/utils'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) return
    setProfile(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) void loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return null
      if (/invalid login credentials|invalid_credentials/i.test(error.message)) {
        return 'Email ou senha inválidos.'
      }
      return getErrorMessage(error)
    },
    [],
  )

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut()
  }, [])

  const role: UserRole = profile?.role ?? 'gerente'
  const isAdmin = role === 'admin'

  return { user, profile, loading, role, isAdmin, signIn, signOut }
}