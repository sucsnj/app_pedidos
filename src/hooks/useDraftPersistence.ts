import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { CountedItem, FlashKind } from '../types/app'
import type { Order } from '../types/database'
import { getErrorMessage } from '../lib/utils'
import {
  mergeOrderRow,
  mergeOrdersList,
  orderDisplayEquals,
  toOrderItemRows,
} from '../lib/orders'

export interface DraftPersistenceParams {
  currentOrder: Order | null
  items: CountedItem[]
  requesterName: string
  notes: string
  loading: boolean
  notify: (message: string, kind?: FlashKind) => void
  setCurrentOrder: Dispatch<SetStateAction<Order | null>>
  setOrders: Dispatch<SetStateAction<Order[]>>
}

export function useDraftPersistence({
  currentOrder,
  items,
  requesterName,
  notes,
  loading,
  notify,
  setCurrentOrder,
  setOrders,
}: DraftPersistenceParams) {
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAtLocal] = useState<Date | null>(null)

  const orderRef = useRef<Order | null>(null)
  const itemsRef = useRef<CountedItem[]>([])
  const requesterRef = useRef('')
  const notesRef = useRef('')
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const lastSavedAt = useRef(0)
  const saveTimer = useRef<number | null>(null)
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

  const commitSyncedOrder = useCallback((synced: Order): void => {
    lastSavedAt.current = Date.now()
    dirtyRef.current = false
    setCurrentOrder((previous) => {
      if (!previous || previous.id !== synced.id) return previous
      return orderDisplayEquals(previous, synced) ? previous : synced
    })
    setOrders((previous) => mergeOrdersList(previous, synced))
    setSavedAtLocal(new Date())
  }, [setCurrentOrder, setOrders])

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

      const rows = toOrderItemRows(snapshot.items, snapshot.order.id)
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('order_items').insert(rows)
        if (insertError) throw insertError
      }

      const synced = mergeOrderRow(
        snapshot.order,
        totalItems,
        snapshot.requesterName,
        snapshot.notes || null,
      )
      commitSyncedOrder(synced)
    } catch (err) {
      dirtyRef.current = true
      throw err
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [setSaving, commitSyncedOrder])

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

  const saveNow = useCallback((): void => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    dirtyRef.current = true
    void enqueuePersist().catch((err) => notify(getErrorMessage(err), 'error'))
  }, [enqueuePersist, notify])

  const clearDebounce = useCallback((): void => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [])

  const markDirty = useCallback((): void => {
    dirtyRef.current = true
  }, [])

  const snapshotRefs = useCallback(
    () => ({
      items: itemsRef.current,
      requesterName: requesterRef.current,
      notes: notesRef.current,
    }),
    [],
  )

  const shouldSkipSync = useCallback((): boolean => {
    return (
      savingRef.current ||
      dirtyRef.current ||
      Date.now() - lastSavedAt.current < 1500
    )
  }, [])

  const resetSavedAt = useCallback((): void => {
    setSavedAtLocal(null)
  }, [])

  return {
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
  }
}
