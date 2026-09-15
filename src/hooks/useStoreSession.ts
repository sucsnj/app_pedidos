import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Catalog,
  CountedItem,
  FlashKind,
  ItemKey,
  SuggestionsMap,
  TabId,
} from '../types/app'
import { itemKey } from '../types/app'
import type { Order } from '../types/database'
import { getErrorMessage } from '../lib/utils'
import {
  mapOrderItems,
  mergeOrderRow,
  resolveItemForCount,
  adjustCountedItems,
  setCountedQuantity,
} from '../lib/orders'
import { useDraftPersistence } from './useDraftPersistence'
import { useRealtimeOrder } from './useRealtimeOrder'

export interface StoreSessionParams {
  catalog: Catalog
  notify: (message: string, kind?: FlashKind) => void
  onNavigate: (tab: TabId) => void
  preferredStoreId?: string | null
  userId?: string | null
}

const STORE_PREFERENCE_KEY = 'pedidos:selectedStore:'

function persistStorePreference(userId: string, storeId: string): void {
  try {
    localStorage.setItem(STORE_PREFERENCE_KEY + userId, storeId)
  } catch {}
}

export function useStoreSession({
  catalog,
  notify,
  onNavigate,
  preferredStoreId = null,
  userId = null,
}: StoreSessionParams) {
  const [activeStoreId, setActiveStoreId] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<CountedItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionsMap>(new Map())
  const [requesterName, setRequesterName] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const persist = useDraftPersistence({
    currentOrder,
    items,
    requesterName,
    notes,
    loading,
    notify,
    setCurrentOrder,
    setOrders,
  })
  const {
    saving,
    savedAt,
    enqueuePersist,
    saveNow,
    clearDebounce,
    markDirty,
    commitSyncedOrder,
    snapshotRefs,
    shouldSkipSync,
    resetSavedAt,
  } = persist

  const catalogRef = useRef(catalog)
  const storeEffectToken = useRef(0)

  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  useEffect(() => {
    if (activeStoreId || catalog.stores.length === 0) return
    const persistedStoreId = userId
      ? localStorage.getItem(STORE_PREFERENCE_KEY + userId)
      : null
    const defaultStore =
      (persistedStoreId
        ? catalog.stores.find((store) => store.id === persistedStoreId)
        : undefined) ??
      (preferredStoreId
        ? catalog.stores.find((store) => store.id === preferredStoreId)
        : undefined) ??
      catalog.stores.find((store) => store.is_active) ??
      catalog.stores[0]
    if (defaultStore) setActiveStoreId(defaultStore.id)
  }, [catalog.stores, activeStoreId, preferredStoreId, userId])

  /* --------------------- Carga do contexto da loja ------------------- */

  const fetchOrderItems = useCallback(
    async (orderId: string): Promise<CountedItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
      if (error) throw error
      return mapOrderItems(data, catalogRef.current)
    },
    [],
  )

  const fetchSuggestions = useCallback(
    async (storeId: string): Promise<SuggestionsMap> => {
      const { data, error } = await supabase
        .from('vw_product_suggestions')
        .select('store_id, product_id, product_variation_id, suggested_quantity')
        .eq('store_id', storeId)
      if (error) throw error
      const nextSuggestions: SuggestionsMap = new Map()
      for (const row of data) {
        nextSuggestions.set(
          itemKey(row.product_id, row.product_variation_id ?? ''),
          row.suggested_quantity,
        )
      }
      return nextSuggestions
    },
    [],
  )

  useEffect(() => {
    if (!activeStoreId) return
    const token = ++storeEffectToken.current
    let cancelled = false
    setLoading(true)
    setError(null)
    setCurrentOrder(null)
    setOrders([])
    setItems([])
    setRequesterName('')
    setNotes('')
    resetSavedAt()

    void (async () => {
      try {
        const [ordersResult, suggestedMap] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('store_id', activeStoreId)
            .order('updated_at', { ascending: false })
            .limit(25),
          fetchSuggestions(activeStoreId),
        ])
        if (cancelled || token !== storeEffectToken.current) return
        if (ordersResult.error) throw ordersResult.error

        const loadedOrders = ordersResult.data
        setOrders(loadedOrders)
        setSuggestions(suggestedMap)

        let order =
          loadedOrders.find((entry) => entry.status === 'Rascunho') ??
          loadedOrders[0] ??
          null

        if (!order) {
          const created = await supabase
            .from('orders')
            .insert({
              store_id: activeStoreId,
              requester_name: '',
              status: 'Rascunho',
              total_items: 0,
              notes: null,
            })
            .select()
            .single()
          if (cancelled || token !== storeEffectToken.current) return
          if (created.error) throw created.error
          order = created.data
          setOrders([created.data])
        }

        setCurrentOrder(order)
        setRequesterName(order.requester_name)
        setNotes(order.notes ?? '')
        const rows = await fetchOrderItems(order.id)
        if (cancelled || token !== storeEffectToken.current) return
        setItems(rows)
      } catch (err) {
        if (!cancelled && token === storeEffectToken.current) {
          setError(getErrorMessage(err))
        }
      } finally {
        if (!cancelled && token === storeEffectToken.current) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeStoreId, fetchOrderItems, fetchSuggestions, resetSavedAt])

  /* ------------------------------ Realtime --------------------------- */

  useRealtimeOrder({
    currentOrder,
    fetchOrderItems,
    shouldSkipSync,
    setCurrentOrder,
    setItems,
  })

  /* ----------------------- Reconciliar catálogo ---------------------- */

  useEffect(() => {
    setItems((previous) =>
      previous.map((item) => {
        const product = catalog.products.find((entry) => entry.id === item.product.id)
        const variation = catalog.variations.find((entry) => entry.id === item.variation.id)
        if (!product || !variation) return item
        return { ...item, product, variation }
      }),
    )
  }, [catalog.products, catalog.variations])

  /* ------------------------------ Ações ------------------------------ */

  const adjust = useCallback(
    (key: ItemKey, delta: number) => {
      setItems((previous) => {
        const match = resolveItemForCount(catalog, key)
        if (!match) return previous
        return adjustCountedItems(previous, key, delta, match)
      })
    },
    [catalog.products, catalog.variations],
  )

  const setQuantity = useCallback(
    (key: ItemKey, value: number) => {
      const next = Math.max(0, Math.trunc(value) || 0)
      setItems((previous) => {
        const match = resolveItemForCount(catalog, key)
        if (!match) return previous
        return setCountedQuantity(previous, key, next, match)
      })
    },
    [catalog.products, catalog.variations],
  )

  const toggleEntered = useCallback((key: ItemKey) => {
    setItems((previous) =>
      previous.map((item) =>
        item.key === key ? { ...item, isEnteredInLegacy: !item.isEnteredInLegacy } : item,
      ),
    )
  }, [])

  const finishOrder = useCallback(async (): Promise<boolean> => {
    const order = currentOrder
    if (!order || order.status !== 'Rascunho') return false
    setFinishing(true)
    try {
      clearDebounce()
      markDirty()
      await enqueuePersist()

      const snapshot = snapshotRefs()
      const totalItems = snapshot.items.reduce((sum, item) => sum + item.quantity, 0)
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Concluido' })
        .eq('id', order.id)
      if (error) throw error

      const completed = mergeOrderRow(
        order,
        totalItems,
        snapshot.requesterName,
        snapshot.notes || null,
      )
      commitSyncedOrder(completed)
      notify('Pedido concluído! Disponíveis no Modo Digitação.', 'success')
      onNavigate('entry')
      return true
    } catch (err) {
      notify(getErrorMessage(err), 'error')
      return false
    } finally {
      setFinishing(false)
    }
  }, [
    currentOrder,
    enqueuePersist,
    clearDebounce,
    markDirty,
    snapshotRefs,
    commitSyncedOrder,
    notify,
    onNavigate,
  ])

  const newCount = useCallback(async (): Promise<void> => {
    if (!activeStoreId) return
    try {
      clearDebounce()
      if (currentOrder && currentOrder.status === 'Rascunho') {
        markDirty()
        await enqueuePersist().catch(() => undefined)
      }
      const created = await supabase
        .from('orders')
        .insert({
          store_id: activeStoreId,
          requester_name: '',
          status: 'Rascunho',
          total_items: 0,
          notes: null,
        })
        .select()
        .single()
      if (created.error) throw created.error

      const nextSuggestions = await fetchSuggestions(activeStoreId)
      setSuggestions(nextSuggestions)

      setCurrentOrder(created.data)
      setOrders((previous) => [created.data, ...previous].slice(0, 25))
      setItems([])
      setRequesterName('')
      setNotes('')
      resetSavedAt()
      onNavigate('count')
      notify('Nova contagem iniciada.', 'success')
    } catch (err) {
      notify(getErrorMessage(err), 'error')
    }
  }, [
    activeStoreId,
    currentOrder,
    enqueuePersist,
    clearDebounce,
    markDirty,
    resetSavedAt,
    fetchSuggestions,
    notify,
    onNavigate,
  ])

  const selectStore = useCallback(
    (storeId: string) => {
      if (!storeId || storeId === activeStoreId) return
      clearDebounce()
      if (currentOrder && currentOrder.status === 'Rascunho') {
        markDirty()
        void enqueuePersist().catch(() => undefined)
      }
      if (userId) persistStorePreference(userId, storeId)
      setActiveStoreId(storeId)
    },
    [activeStoreId, currentOrder, enqueuePersist, clearDebounce, markDirty, userId],
  )

  const selectOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const order = orders.find((entry) => entry.id === orderId)
      if (!order || order.id === currentOrder?.id) return
      clearDebounce()
      if (currentOrder && currentOrder.status === 'Rascunho') {
        markDirty()
        await enqueuePersist().catch(() => undefined)
      }
      try {
        const rows = await fetchOrderItems(order.id)
        setCurrentOrder(order)
        setRequesterName(order.requester_name)
        setNotes(order.notes ?? '')
        setItems(rows)
        resetSavedAt()
      } catch (err) {
        notify(getErrorMessage(err), 'error')
      }
    },
    [
      orders,
      currentOrder,
      enqueuePersist,
      fetchOrderItems,
      clearDebounce,
      markDirty,
      resetSavedAt,
      notify,
    ],
  )

  const clearError = useCallback((): void => setError(null), [])

  return {
    activeStoreId,
    orders,
    currentOrder,
    items,
    suggestions,
    requesterName,
    notes,
    loading,
    error,
    saving,
    finishing,
    savedAt,
    setRequesterName,
    setNotes,
    adjust,
    setQuantity,
    toggleEntered,
    selectStore,
    selectOrder,
    newCount,
    finishOrder,
    saveNow,
    clearError,
  }
}
