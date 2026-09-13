import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  MonitorCheck,
  Package,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Catalog, CountedItem, ItemKey, SuggestionsMap, TabId } from './types/app'
import type { Order, OrderItem, Store as StoreRow } from './types/database'
import { itemKey, defaultVariationForProduct, SYNTHETIC_VARIATION_ID } from './types/app'
import { getErrorMessage } from './lib/utils'
import { CountingBoard } from './components/CountingBoard'
import { DataEntryBoard } from './components/DataEntryBoard'
import { CatalogBoard, type FlashKind } from './components/CatalogBoard'
import { Spinner } from './components/ui'

interface FlashState {
  kind: FlashKind
  message: string
}

function mapOrderItems(rows: OrderItem[], catalog: Catalog): CountedItem[] {
  const result: CountedItem[] = []
  for (const row of rows) {
    if (!row.product_id) continue
    const product = catalog.products.find((entry) => entry.id === row.product_id)
    if (!product) continue
    const variation = row.product_variation_id
      ? catalog.variations.find((entry) => entry.id === row.product_variation_id)
      : defaultVariationForProduct(product)
    if (!variation) continue
    result.push({
      key: itemKey(product.id, variation.id),
      product,
      variation,
      quantity: row.quantity,
      isEnteredInLegacy: row.is_entered_in_legacy,
    })
  }
  return result
}

function sameCountedList(a: CountedItem[], b: CountedItem[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (
      !right ||
      left.key !== right.key ||
      left.quantity !== right.quantity ||
      left.isEnteredInLegacy !== right.isEnteredInLegacy
    )
      return false
  }
  return true
}

function orderDisplayEquals(a: Order, b: Order): boolean {
  return (
    a.status === b.status &&
    a.total_items === b.total_items &&
    a.requester_name === b.requester_name &&
    a.notes === b.notes
  )
}

function mergeOrderRow(
  base: Order,
  totalItems: number,
  requesterName: string,
  notes: string | null,
): Order {
  return { ...base, total_items: totalItems, requester_name: requesterName, notes }
}

function orderLabel(order: Order): string {
  const date = new Date(order.updated_at)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const status =
    order.status === 'Concluido'
      ? 'Concluído'
      : order.status === 'Lancado'
        ? 'Lançado'
        : 'Rascunho'
  if (order.status === 'Rascunho' && order.total_items === 0) {
    return 'Novo rascunho · ' + day + '/' + month
  }
  return status + ' · ' + order.total_items + ' itens · ' + day + '/' + month
}

export default function App() {
  const [tab, setTab] = useState<TabId>('count')
  const [catalog, setCatalog] = useState<Catalog>({
    stores: [],
    categories: [],
    products: [],
    variations: [],
  })
  const [activeStoreId, setActiveStoreId] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<CountedItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionsMap>(new Map())
  const [requesterName, setRequesterName] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [flash, setFlash] = useState<FlashState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const catalogRef = useRef(catalog)
  const saveTimer = useRef<number | null>(null)
  const lastSavedAt = useRef(0)
  const flashTimer = useRef<number | null>(null)
  const storeEffectToken = useRef(0)

  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  const notify = useCallback((message: string, kind: FlashKind = 'info') => {
    setFlash({ message, kind })
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 3500)
  }, [])

  /* -------------------------- Carga inicial -------------------------- */

  const loadCatalog = useCallback(async () => {
    const [storesResult, categoriesResult, productsResult, variationsResult] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('products').select('*').order('name'),
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

  const handleAdjust = useCallback(
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

  const handleSetQuantity = useCallback(
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

  const handleToggleEntered = useCallback((key: ItemKey) => {
    setItems((previous) =>
      previous.map((item) =>
        item.key === key ? { ...item, isEnteredInLegacy: !item.isEnteredInLegacy } : item,
      ),
    )
  }, [])

  const handleFinishOrder = useCallback(async () => {
    const order = currentOrder
    if (!order || order.status !== 'Rascunho') return
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
      setTab('entry')
    } catch (err) {
      notify(getErrorMessage(err), 'error')
    } finally {
      setFinishing(false)
    }
  }, [currentOrder, enqueuePersist, notify])

  const handleNewCount = useCallback(async () => {
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
      setTab('count')
      notify('Nova contagem iniciada.', 'success')
    } catch (err) {
      notify(getErrorMessage(err), 'error')
    }
  }, [activeStoreId, currentOrder, enqueuePersist, notify])

  const handleSelectStore = useCallback(
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

  const handleSelectOrder = useCallback(
    async (orderId: string) => {
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

  /* ------------------------------- Render ---------------------------- */

  const activeStore: StoreRow | undefined = catalog.stores.find(
    (store) => store.id === activeStoreId,
  )
  const totalCounted = items.reduce((sum, item) => sum + item.quantity, 0)
  const locksOrder = currentOrder !== null && currentOrder.status !== 'Rascunho'

  const tabs: Array<{ id: TabId; label: string; short: string; icon: typeof ClipboardList }> = [
    { id: 'count', label: 'Contagem (Prancheta)', short: 'Contagem', icon: ClipboardList },
    { id: 'entry', label: 'Modo Digitação', short: 'Digitação', icon: MonitorCheck },
    { id: 'catalog', label: 'Cadastro & Produtos', short: 'Cadastro', icon: Package },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-wine-700">
        <Spinner className="h-8 w-8" />
        <p className="text-sm font-semibold">Carregando catálogo...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold text-wine-700">Não foi possível carregar o app.</p>
        <p className="max-w-md text-xs text-gray-500">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-wine-600"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-shell pb-24 text-gray-900">
      <header className="bg-wine-700 text-white shadow-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wine-500">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-sm font-extrabold leading-tight">
                  Pedidos & Abastecimento
                </h1>
                <p className="text-[11px] text-wine-300">Contagem física · Prancheta digital</p>
              </div>
            </div>
            {saving ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                <Spinner className="h-3.5 w-3.5" /> Salvando
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Store className="hidden h-4 w-4 shrink-0 text-wine-300 sm:block" />
              <select
                value={activeStoreId}
                onChange={(event) => handleSelectStore(event.target.value)}
                className="w-full rounded-lg border border-wine-500/60 bg-wine-800/70 px-3 py-2 text-sm font-medium text-white outline-none focus:border-wine-300"
              >
                <option value="">Selecione a loja</option>
                {catalog.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.code ? ' (' + store.code + ')' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 gap-2">
              <select
                value={currentOrder?.id ?? ''}
                onChange={(event) => void handleSelectOrder(event.target.value)}
                disabled={orders.length === 0}
                className="min-w-0 flex-1 rounded-lg border border-wine-500/60 bg-wine-800/70 px-3 py-2 text-sm font-medium text-white outline-none focus:border-wine-300 disabled:opacity-50"
              >
                <option value="">Sem pedido</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {orderLabel(order)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleNewCount()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-wine-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-wine-600 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova contagem</span>
                <span className="sm:hidden">Novo</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-gray-200 bg-shell/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 py-2">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map((entry) => {
              const active = tab === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                    active
                      ? 'bg-wine-700 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-wine-700'
                  }`}
                >
                  <entry.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{entry.label}</span>
                  <span className="sm:hidden">{entry.short}</span>
                </button>
              )
            })}
          </div>
          {tab === 'count' && !locksOrder ? (
            <button
              type="button"
              onClick={() => void handleFinishOrder()}
              disabled={finishing || totalCounted === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {finishing ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Concluir Pedido</span>
              <span className="sm:hidden">Concluir</span>
            </button>
          ) : null}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-3 pt-4">
        {tab === 'count' && (
          <CountingBoard
            storeName={activeStore?.name ?? 'Nenhuma loja selecionada'}
            categories={catalog.categories}
            products={catalog.products}
            variations={catalog.variations}
            items={items}
            suggestions={suggestions}
            requesterName={requesterName}
            notes={notes}
            orderStatus={currentOrder?.status ?? null}
            saving={saving}
            savedAt={savedAt}
            onRequesterNameChange={setRequesterName}
            onNotesChange={setNotes}
            onAdjust={handleAdjust}
            onSetQuantity={handleSetQuantity}
            onSaveNow={() => {
              if (saveTimer.current) {
                window.clearTimeout(saveTimer.current)
                saveTimer.current = null
              }
              dirtyRef.current = true
              void enqueuePersist().catch((err) => notify(getErrorMessage(err), 'error'))
            }}
          />
        )}

        {tab === 'entry' && (
          <DataEntryBoard
            store={activeStore}
            order={currentOrder}
            items={items}
            requesterName={requesterName}
            onToggleEntered={handleToggleEntered}
          />
        )}

        {tab === 'catalog' && (
          <CatalogBoard
            catalog={catalog}
            onRefresh={loadCatalog}
            onFlash={notify}
          />
        )}
      </main>

      {flash ? (
        <div
          role="status"
          className={`fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            flash.kind === 'error'
              ? 'bg-red-600'
              : flash.kind === 'success'
                ? 'bg-green-600'
                : 'bg-wine-600'
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/90 px-4 py-2 backdrop-blur sm:hidden">
        <p className="text-center text-xs font-semibold text-gray-600">
          {activeStore?.name ?? 'Sem loja'} · {totalCounted} unidade(s)
          {currentOrder
            ? ' · ' + (locksOrder ? 'Concluído' : 'Rascunho salvo automaticamente')
            : ''}
        </p>
      </div>
    </div>
  )
}