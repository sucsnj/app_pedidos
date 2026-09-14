import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { CountedItem } from '../types/app'
import type { Order } from '../types/database'
import { orderDisplayEquals, sameCountedList } from '../lib/orders'

export interface RealtimeOrderParams {
  currentOrder: Order | null
  fetchOrderItems: (orderId: string) => Promise<CountedItem[]>
  shouldSkipSync: () => boolean
  setCurrentOrder: Dispatch<SetStateAction<Order | null>>
  setItems: Dispatch<SetStateAction<CountedItem[]>>
}

export function useRealtimeOrder({
  currentOrder,
  fetchOrderItems,
  shouldSkipSync,
  setCurrentOrder,
  setItems,
}: RealtimeOrderParams) {
  const reloadFromServer = useCallback(
    async (orderId: string) => {
      if (shouldSkipSync()) return
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
    [fetchOrderItems, shouldSkipSync],
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
}
