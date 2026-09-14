import { useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardList, Lock, LogIn, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/utils'
import { Spinner } from './ui'

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<string | null>
}

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const rawLogin = login.trim().toLowerCase()
    if (!rawLogin || !password) {
      setError('Preencha usuário e senha.')
      return
    }
    setSubmitting(true)
    try {
      let userEmail = rawLogin
      if (!userEmail.includes('@')) {
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', userEmail)
          .maybeSingle()
        if (lookupError) throw lookupError
        if (!profile?.email) {
          setError('Nome de usuário não encontrado.')
          return
        }
        userEmail = profile.email
      }
      const message = await onSignIn(userEmail, password)
      if (message) setError(message)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-shell px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b-2 border-gold-400 bg-wine-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold-400 shadow-md">
            <ClipboardList className="h-6 w-6 text-wine-800" />
          </span>
          <h1 className="mt-3 text-lg font-extrabold text-white">
            Pedidos & Abastecimento
          </h1>
          <p className="text-xs font-medium text-gold-300">Contagem física · Prancheta digital</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div className="text-center">
            <h2 className="text-sm font-bold text-gray-800">Acesse sua conta</h2>
            <p className="text-xs text-gray-500">Entre para iniciar a contagem</p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-wine-200 bg-wine-100 px-3 py-2 text-xs font-semibold text-wine-700"
            >
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Usuário ou E-mail
            </span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="usuario ou email"
                autoComplete="username"
                required
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-wine-600 focus:ring-2 focus:ring-wine-600/20"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Senha
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="• • • • • • • •"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-wine-600 focus:ring-2 focus:ring-wine-600/20"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-wine-700 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-wine-800 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70"
          >
            <span className="absolute inset-x-0 bottom-0 h-1 bg-gold-400" />
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {submitting ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}