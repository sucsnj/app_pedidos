import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Catalog } from '../types/app'
import { getErrorMessage } from '../lib/utils'

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>({
    stores: [],
    categories: [],
    products: [],
    variations: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadCatalog = useCallback(async () => {
    const [storesResult, categoriesResult, productsResult, variationsResult] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('products').select('*').order('display_order').order('name'),
      supabase.from('product_variations').select('*').order('name'),
    ])
    if (storesResult.error) throw storesResult.error
    if (categoriesResult.error) throw categoriesResult.error
    if (productsResult.error) throw productsResult.error
    if (variationsResult.error) throw variationsResult.error
    setCatalog({
      stores: storesResult.data,
      categories: categoriesResult.data,
      products: productsResult.data,
      variations: variationsResult.data,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadCatalog()
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  return { catalog, loading, error, reload, refresh: loadCatalog }
}
