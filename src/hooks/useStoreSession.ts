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
import { itemKey, defaultVariationForProduct, SYNTHETIC_VARIATION_ID } from '../types/app'
import type { Order } from '../types/database'
import { getErrorMessage } from '../lib/utils'
import {
  mapOrderItems,
  sameCountedList,
  orderDisplayEquals,
  mergeOrderRow,
} from '../lib/orders'

export interface StoreSessionParams {
  catalog: Catalog
  notify: (message: string, kind?: FlashKind) => void
  onNavigate: (tab: TabId) => void
}

export function useStoreSession({ catalog, notify, onNavigate }: StoreSessionParams) {
  const [activeStoreId, setActiveStoreId] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<CountedItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionsMap>(new Map())
  const [requesterName, setRequesterName] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const catalogRef = useRef(catalog)
  const saveTimer = useRef<number | null>(null)
  const lastSavedAt = useRef(0)
  const storeEffectToken = useRef(0)

  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  useEffect(() => {
    if (activeStoreId || catalog.stores.length === 0) return
    const defaultStore =
      catalog.stores.find((store) => store.is_active) ?? catalog.stores[0]
    if (defaultStore) setActiveStoreId(defaultStore.id)
  }, [catalog.stores, activeStoreId])

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
    setSavedAt(null)

    void (async () => {
      try {
        const [ordersResult, suggestionsResult] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('store_id', activeStoreId)
            .order('updated_at', { ascending: false })
            .limit(25),
          supabase
            .from('vw_product_suggestions')
            .select('store_id, product_id, product_variation_id, suggested_quantity')
            .eq('store_id', activeStoreId),
        ])
        if (cancelled || token !== storeEffectToken.current) return
        if (ordersResult.error) throw ordersResult.error
        if (suggestionsResult.error) throw suggestionsResult.error

        const loadedOrders = ordersResult.data
        setOrders(loadedOrders)

        const nextSuggestions: SuggestionsMap = new Map()
        for (const row of suggestionsResult.data) {
          nextSuggestions.set(itemKey(row.product_id, row.product_variation_id ?? ''), row.suggested_quantity)
        }
        setSuggestions(nextSuggestions)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId, fetchOrderItems])

  /* ------------------------------ Salvamento -------------------------- */

  const orderRef = useRef<Order | null>(null)
  const itemsRef = useRef<CountedItem[]>([])
  const requesterRef = useRef('')
  const notesRef = useRef('')
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const persistChainRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    orderRef.current = currentOrder
  }, [currentOrder])
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => {
    requesterRef.current = requesterName
  }, [requesterName])
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const persistOrder = useCallback(async (): Promise<void> => {
    const order = orderRef.current
    if (!order) return
    const snapshot = {
      order,
      items: itemsRef.current,
      requesterName: requesterRef.current,
      notes: notesRef.current,
    }
    setSaving(true)
    savingRef.current = true
    try {
      const totalItems = snapshot.items.reduce((sum, item) => sum + item.quantity, 0)
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          requester_name: snapshot.requesterName,
          notes: snapshot.notes || null,
          total_items: totalItems,
        })
        .eq('id', snapshot.order.id)
      if (orderError) throw orderError

      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', snapshot.order.id)
      if (deleteError) throw deleteError

      const rows = snapshot.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          order_id: snapshot.order.id,
          product_id: item.product.id,
          product_variation_id: item.variation.id || null,
          product_code: item.product.code,
          product_name: item.product.name,
          variation_name: item.variation.name,
          quantity: item.quantity,
          is_entered_in_legacy: item.isEnteredInLegacy,
        }))
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('order_items').insert(rows)
        if (insertError) throw insertError
      }

      lastSavedAt.current = Date.now()
      const synced = mergeOrderRow(
        snapshot.order,
        totalItems,
        snapshot.requesterName,
        snapshot.notes || null,
      )
      setCurrentOrder((previous) => {
        if (!previous || previous.id !== synced.id) return previous
        return orderDisplayEquals(previous, synced) ? previous : synced
      })
      setOrders((previous) => {
        let changed = false
        const next = previous.map((entry) => {
          if (entry.id !== synced.id) return entry
          if (orderDisplayEquals(entry, synced)) return entry
          changed = true
          return { ...entry, ...synced }
        })
        return changed ? next : previous
      })
      setSavedAt(new Date())
      dirtyRef.current = false
    } catch (err) {
      dirtyRef.current = true
      throw err
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  const enqueuePersist = useCallback((): Promise<void> => {
    const task = persistChainRef.current.then(() => persistOrder())
    persistChainRef.current = task.catch(() => undefined)
    return task
  }, [persistOrder])

  useEffect(() => {
    if (!currentOrder || loading) return
    dirtyRef.current = true
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      enqueuePersist().catch((err) => notify(getErrorMessage(err), 'error'))
    }, 700)
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, requesterName, notes, currentOrder?.id, loading, enqueuePersist])

  /* ------------------------------ Realtime --------------------------- */

  const reloadFromServer = useCallback(
    async (orderId: string) => {
      if (
        savingRef.current ||
        dirtyRef.current ||
        Date.now() - lastSavedAt.current < 1500
      )
        return
      try {
        const [orderResult, rows] = await Promise.all([
          supabase.from('orders').select('*').eq('id', orderId).single(),
          fetchOrderItems(orderId),
        ])
        if (orderResult.error) throw orderResult.error
        if (orderResult.data) {
          const incoming = orderResult.data
          setCurrentOrder((previous) => {
            if (!previous || previous.id !== incoming.id) return previous
            if (orderDisplayEquals(previous, incoming)) return previous
            return {
              ...previous,
              status: incoming.status,
              total_items: incoming.total_items,
              requester_name: incoming.requester_name,
              notes: incoming.notes,
            }
          })
        }
        setItems((previous) => (sameCountedList(previous, rows) ? previous : rows))
      } catch {
        // Realtime é apenas sincronização auxiliar; falhas não bloqueiam o app.
      }
    },
    [fetchOrderItems],
  )

  useEffect(() => {
    if (!currentOrder) return
    const orderId = currentOrder.id
    const channel = supabase
      .channel('order:' + orderId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: 'order_id=eq.' + orderId,
        },
        () => void reloadFromServer(orderId),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'id=eq.' + orderId,
        },
        () => void reloadFromServer(orderId),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentOrder, reloadFromServer])

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
        const separator = key.indexOf('::')
        const productId = key.slice(0, separator)
        const variationId = key.slice(separator + 2)
        const product = catalog.products.find((entry) => entry.id === productId)
        if (!product) return previous
        const variation =
          variationId === SYNTHETIC_VARIATION_ID
            ? defaultVariationForProduct(product)
            : catalog.variations.find((entry) => entry.id === variationId)
        if (!variation) return previous

        const index = previous.findIndex((item) => item.key === key)
        if (index === -1) {
          if (delta <= 0) return previous
          return [
            ...previous,
            { key, product, variation, quantity: delta, isEnteredInLegacy: false },
          ]
        }
        return previous.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
      })
    },
    [catalog.products, catalog.variations],
  )

  const setQuantity = useCallback(
    (key: ItemKey, value: number) => {
      const next = Math.max(0, Math.trunc(value) || 0)
      setItems((previous) => {
        const separator = key.indexOf('::')
        const productId = key.slice(0, separator)
        const variationId = key.slice(separator + 2)
        const product = catalog.products.find((entry) => entry.id === productId)
        if (!product) return previous
        const variation =
          variationId === SYNTHETIC_VARIATION_ID
            ? defaultVariationForProduct(product)
            : catalog.variations.find((entry) => entry.id === variationId)
        if (!variation) return previous

        const index = previous.findIndex((item) => item.key === key)
        if (index === -1) {
          if (next === 0) return previous
          return [
            ...previous,
            { key, product, variation, quantity: next, isEnteredInLegacy: false },
          ]
        }
        return previous.map((item, itemIndex) =>
          itemIndex === index ? { ...item, quantity: next } : item,
        )
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
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      dirtyRef.current = true
      await enqueuePersist()

      const totalItems = itemsRef.current.reduce((sum, item) => sum + item.quantity, 0)
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Concluido' })
        .eq('id', order.id)
      if (error) throw error
      lastSavedAt.current = Date.now()
      dirtyRef.current = false

      const completed = mergeOrderRow(
        order,
        totalItems,
        requesterRef.current,
        notesRef.current || null,
      )
      setCurrentOrder((previous) =>
        previous && previous.id === completed.id && orderDisplayEquals(previous, completed)
          ? previous
          : completed,
      )
      setOrders((previous) => {
        let changed = false
        const next = previous.map((entry) => {
          if (entry.id !== completed.id) return entry
          if (orderDisplayEquals(entry, completed)) return entry
          changed = true
          return { ...entry, ...completed }
        })
        return changed ? next : previous
      })
      setSavedAt(new Date())
      notify('Pedido concluído! Disponíveis no Modo Digitação.', 'success')
      onNavigate('entry')
      return true
    } catch (err) {
      notify(getErrorMessage(err), 'error')
      return false
    } finally {
      setFinishing(false)
    }
  }, [currentOrder, enqueuePersist, notify, onNavigate])

  const newCount = useCallback(async (): Promise<void> => {
    if (!activeStoreId) return
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (currentOrder && currentOrder.status === 'Rascunho') {
        dirtyRef.current = true
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

      setCurrentOrder(created.data)
      setOrders((previous) => [created.data, ...previous].slice(0, 25))
      setItems([])
      setRequesterName('')
      setNotes('')
      setSavedAt(null)
      onNavigate('count')
      notify('Nova contagem iniciada.', 'success')
    } catch (err) {
      notify(getErrorMessage(err), 'error')
    }
  }, [activeStoreId, currentOrder, enqueuePersist, notify, onNavigate])

  const selectStore = useCallback(
    (storeId: string) => {
      if (!storeId || storeId === activeStoreId) return
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (currentOrder && currentOrder.status === 'Rascunho') {
        dirtyRef.current = true
        void enqueuePersist().catch(() => undefined)
      }
      setActiveStoreId(storeId)
    },
    [activeStoreId, currentOrder, enqueuePersist],
  )

  const selectOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const order = orders.find((entry) => entry.id === orderId)
      if (!order || order.id === currentOrder?.id) return
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (currentOrder && currentOrder.status === 'Rascunho') {
        dirtyRef.current = true
        await enqueuePersist().catch(() => undefined)
      }
      try {
        const rows = await fetchOrderItems(order.id)
        setCurrentOrder(order)
        setRequesterName(order.requester_name)
        setNotes(order.notes ?? '')
        setItems(rows)
        setSavedAt(null)
      } catch (err) {
        notify(getErrorMessage(err), 'error')
      }
    },
    [orders, currentOrder, enqueuePersist, fetchOrderItems, notify],
  )

  const saveNow = useCallback((): void => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    dirtyRef.current = true
    void enqueuePersist().catch((err) => notify(getErrorMessage(err), 'error'))
  }, [enqueuePersist, notify])

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