import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readStorePreference, writeStorePreference } from '../lib/storePreference'
import { getErrorMessage } from '../lib/utils'
import type { Store } from '../types/database'

export interface StoreSelectionParams {
  userId?: string | null
  isAdmin?: boolean
  preferredStoreId?: string | null
}

/**
 * Seleção de loja para telas que não usam a sessão de pedidos
 * (mesma preferência do `/orders`: `localStorage` → loja do perfil → primeira ativa).
 */
export function useStoreSelection({
  userId = null,
  isAdmin = false,
  preferredStoreId = null,
}: StoreSelectionParams) {
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('stores')
          .select('*')
          .order('name')
        if (cancelled) return
        if (fetchError) {
          setError(getErrorMessage(fetchError))
          return
        }
        setStores(data)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (storeId || stores.length === 0) return
    const persisted = readStorePreference(userId)
    const profileStore = preferredStoreId
      ? stores.find((store) => store.id === preferredStoreId)
      : undefined
    // Admin pode escolher qualquer loja (a preferência vale); gerente fica
    // preso à loja do perfil.
    const defaultStore = isAdmin
      ? (persisted ? stores.find((store) => store.id === persisted) : undefined) ??
        profileStore ??
        stores.find((store) => store.is_active) ??
        stores[0]
      : profileStore ?? stores.find((store) => store.is_active) ?? stores[0]
    if (defaultStore) setStoreId(defaultStore.id)
  }, [stores, storeId, userId, preferredStoreId, isAdmin])

  const selectStore = useCallback(
    (nextStoreId: string): void => {
      if (!isAdmin) return
      if (!nextStoreId || nextStoreId === storeId) return
      setStoreId(nextStoreId)
      writeStorePreference(userId, nextStoreId)
    },
    [storeId, userId, isAdmin],
  )

  const activeStore = stores.find((store) => store.id === storeId)
  const resolved = !loading && (storeId !== '' || stores.length === 0)

  return { stores, storeId, activeStore, selectStore, loading, error, isAdmin, resolved }
}
