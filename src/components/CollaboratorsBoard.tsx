import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { RefreshCw, ShieldBan, ShieldCheck, UserPlus, Users, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile, ProfileUpdate, Store as StoreRow, UserRole } from '../types/database'
import type { FlashKind } from '../types/app'
import { getErrorMessage, emptyText } from '../lib/utils'
import { Field, Spinner, inputClass, selectClass } from './ui'

interface CollaboratorsBoardProps {
  stores: StoreRow[]
  currentUserId: string
  onFlash: (message: string, kind?: FlashKind) => void
}

const roleLabel: Record<UserRole, string> = {
  gerente: 'Gerente',
  admin: 'Admin',
}

export function CollaboratorsBoard({ stores, currentUserId, onFlash }: CollaboratorsBoardProps) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeId, setStoreId] = useState(() => stores[0]?.id ?? '')
  const [role, setRole] = useState<UserRole>('gerente')
  const [submitting, setSubmitting] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)

  const [users, setUsers] = useState<Profile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    if (error) {
      onFlash(getErrorMessage(error), 'error')
      setUsers([])
    } else {
      setUsers((data ?? []).filter((user) => user.id !== currentUserId))
    }
    setUsersLoading(false)
  }, [onFlash, currentUserId])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const usernameValue = username.trim().toLowerCase()
    const finalEmail = email.trim() || `${usernameValue}@sistema.local`
    if (!usernameValue) {
      onFlash('Informe um nome de usuário.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const adminSession = sessionData.session

      const { data, error } = await supabase.auth.signUp({
        email: finalEmail,
        password,
        options: {
          data: {
            username: usernameValue,
            full_name: fullName.trim(),
            store_id: storeId || null,
            role,
          },
        },
      })
      if (error) throw error

      if (adminSession) {
        const { data: afterSignUp } = await supabase.auth.getSession()
        if (afterSignUp.session?.user.id !== adminSession.user.id) {
          const { error: restoreError } = await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          })
          if (restoreError) throw restoreError
        }
      }

      if (data.user) {
        await supabase
          .from('profiles')
          .update({
            email: data.user.email ?? finalEmail,
            username: usernameValue,
            full_name: fullName.trim(),
            store_id: storeId || null,
            role,
          })
          .eq('id', data.user.id)
      }

      onFlash('Usuário cadastrado com sucesso!', 'success')
      setFullName('')
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('gerente')
      void loadUsers()
    } catch (err) {
      onFlash(getErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const updateUser = useCallback(
    async (id: string, patch: ProfileUpdate) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      if (error) {
        onFlash(getErrorMessage(error), 'error')
        return
      }
      onFlash('Acesso atualizado.', 'success')
      void loadUsers()
    },
    [loadUsers, onFlash],
  )

  const storeName = (id: string | null) =>
    stores.find((store) => store.id === id)?.name ?? 'Sem loja'

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => setFormCollapsed((previous) => !previous)}
          className="mb-4 flex w-full items-center gap-2.5 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wine-100">
            <UserPlus className="h-5 w-5 text-wine-700" />
          </span>
          <span className="min-w-0 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">
              👥 Cadastrar Novo Colaborador / Gerente
            </h2>
            <p className="text-xs text-gray-500">Cria o acesso corporativo e vincula loja/cargo</p>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
              formCollapsed ? '-rotate-90' : ''
            }`}
          />
        </button>

        {formCollapsed ? null : (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome Completo">
              <input
                className={inputClass}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ex.: Maria Souza"
                autoComplete="off"
                required
              />
            </Field>
            <Field
              label="Nome de Usuário (Username)"
              hint="Sem espaços, em minúsculas. Usado no login."
            >
              <input
                className={inputClass}
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9_.]/g, ''))
                }
                placeholder="ex.: maria_souza"
                autoComplete="off"
                minLength={3}
                maxLength={30}
                required
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="E-mail Corporativo (opcional)"
              hint={
                username.trim()
                  ? `Se vazio, usará ${username.trim().toLowerCase()}@sistema.local`
                  : 'Se vazio, gera um e-mail interno automático'
              }
            >
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="maria@empresa.com"
                autoComplete="off"
              />
            </Field>
            <Field label="Senha Provisória" hint="O gerente deverá usá-la no primeiro acesso">
              <input
                className={inputClass}
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loja Atribuída">
              <select
                className={selectClass}
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <select
                className={selectClass}
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="gerente">Gerente</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <button
            type="submit"
            disabled={submitting || !emptyText(fullName) || !emptyText(username) || password.length < 6}
            className="inline-flex items-center gap-2 rounded-xl bg-wine-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-wine-800 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            Cadastrar Usuário
          </button>
        </form>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setListCollapsed((previous) => !previous)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wine-100">
              <Users className="h-5 w-5 text-wine-700" />
            </span>
            <span className="min-w-0 flex-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">
                Colaboradores Cadastrados
              </h2>
              <p className="text-xs text-gray-500">Lojas atribuídas e acessos</p>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                listCollapsed ? '-rotate-90' : ''
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50 active:scale-95"
            title="Recarregar lista"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {listCollapsed ? null : usersLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-wine-700">
            <Spinner className="h-5 w-5" />
            <span className="text-sm font-semibold">Carregando usuários...</span>
          </div>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Nenhum outro colaborador cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-800">
                    <span className="truncate">{user.full_name ?? 'Sem nome'}</span>
                    {user.is_active ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                        Ativo
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                        Revogado
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {user.username ? `@${user.username}` : '—'} · {user.email ?? '—'} ·{' '}
                    {roleLabel[user.role]} · {storeName(user.store_id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass}
                    value={user.store_id ?? ''}
                    onChange={(event) =>
                      void updateUser(user.id, { store_id: event.target.value || null })
                    }
                    title="Loja atribuída"
                  >
                    <option value="">Sem loja</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={user.role}
                    onChange={(event) =>
                      void updateUser(user.id, { role: event.target.value as UserRole })
                    }
                    title="Cargo"
                  >
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                      user.is_active
                        ? 'bg-wine-100 text-wine-700 hover:bg-wine-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {user.is_active ? (
                      <ShieldBan className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {user.is_active ? 'Revogar acesso' : 'Restaurar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}