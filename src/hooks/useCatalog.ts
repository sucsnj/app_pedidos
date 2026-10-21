import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isOffline, isOfflineError } from '../lib/offlineQueue'
import { cacheCatalog, readCatalog } from '../lib/localCache'
import type { Catalog } from '../types/app'
import { getErrorMessage } from '../lib/utils'

const EMPTY_CATALOG: Catalog = {
  stores: [],
  categories: [],
  products: [],
  variations: [],
}

/** Cache em memória: evita refetch do catálogo a cada remontagem da tela. */
let memoryCatalog: Catalog | null = null

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(memoryCatalog ?? EMPTY_CATALOG)
  const [loading, setLoading] = useState(!memoryCatalog)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadCatalog = useCallback(async (): Promise<Catalog> => {
    const [storesResult, categoriesResult, productsResult, variationsResult] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('products').select('*').order('display_order').order('name'),
      supabase.from('product_variations').select('*').order('name'),
    ])
    const failed = [storesResult, categoriesResult, productsResult, variationsResult].find(
      (result) => result.error,
    )
    if (failed?.error) throw failed.error
    const next: Catalog = {
      stores: storesResult.data ?? [],
      categories: categoriesResult.data ?? [],
      products: productsResult.data ?? [],
      variations: variationsResult.data ?? [],
    }
    memoryCatalog = next
    void cacheCatalog(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadCatalog()
      .then((next) => {
        if (cancelled) return
        setCatalog(next)
      })
      .catch(async (err) => {
        if (cancelled) return
        // Sem rede o catálogo vem do espelho local (o cache do SW cobre o
        // ambiente de produção; o espelho cobre qualquer origem).
        if (isOffline() || isOfflineError(err)) {
          const cached = await readCatalog()
          if (!cancelled && cached) {
            setCatalog(cached)
            setError(null)
            return
          }
        }
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, loadCatalog])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setCatalog(await loadCatalog())
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [loadCatalog])

  return { catalog, loading, error, reload, refresh }
}
