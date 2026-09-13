import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Catalog, LastOrderData, Report, TopProductRow } from '../types/app'
import { itemKey } from '../types/app'
import type { OrderItem } from '../types/database'
import { mapOrderItems } from '../lib/orders'

export function useStoreReports(activeStoreId: string, catalog: Catalog) {
  const [lastOrder, setLastOrder] = useState<LastOrderData | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [reportReloadKey, setReportReloadKey] = useState(0)

  const catalogRef = useRef(catalog)
  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  const reportToken = useRef(0)

  useEffect(() => {
    if (!activeStoreId) return
    const token = ++reportToken.current
    let cancelled = false

    setLastOrder(null)
    setReport(null)

    void (async () => {
      try {
        const far = (days: number) => {
          const date = new Date(Date.now() - days * 86_400_000)
          return date.toISOString()
        }
        const startOfMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1,
        ).toISOString()

        const lastResult = await supabase
          .from('orders')
          .select('*')
          .eq('store_id', activeStoreId)
          .eq('status', 'Concluido')
          .order('updated_at', { ascending: false })
          .limit(1)
        if (lastResult.error) throw lastResult.error

        let nextLastOrder: LastOrderData | null = null
        const lastRow = lastResult.data?.[0] ?? null
        if (lastRow) {
          const itemsResult = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', lastRow.id)
          if (itemsResult.error) throw itemsResult.error
          nextLastOrder = {
            items: mapOrderItems(itemsResult.data, catalogRef.current),
            totalItems: lastRow.total_items,
          }
        }
        if (cancelled || token !== reportToken.current) return
        setLastOrder(nextLastOrder)

        const [ordersCurWeek, ordersPrevWeek, orders30, ordersMonth] = await Promise.all([
          supabase
            .from('orders')
            .select('id')
            .eq('store_id', activeStoreId)
            .gte('created_at', far(7)),
          supabase
            .from('orders')
            .select('id')
            .eq('store_id', activeStoreId)
            .gte('created_at', far(14))
            .lt('created_at', far(7)),
          supabase
            .from('orders')
            .select('id')
            .eq('store_id', activeStoreId)
            .gte('created_at', far(30)),
          supabase
            .from('orders')
            .select('id')
            .eq('store_id', activeStoreId)
            .gte('created_at', startOfMonth),
        ])
        for (const result of [ordersCurWeek, ordersPrevWeek, orders30, ordersMonth]) {
          if (result.error) throw result.error
        }

        const fetchItems = async (ids: string[]): Promise<OrderItem[]> => {
          if (ids.length === 0) return []
          const result = await supabase.from('order_items').select('*').in('order_id', ids)
          if (result.error) throw result.error
          return result.data
        }

        const idsCur = (ordersCurWeek.data ?? []).map((order) => order.id)
        const idsPrev = (ordersPrevWeek.data ?? []).map((order) => order.id)
        const ids30 = (orders30.data ?? []).map((order) => order.id)

        const [itemsCur, itemsPrev, items30] = await Promise.all([
          fetchItems(idsCur),
          fetchItems(idsPrev),
          fetchItems(ids30),
        ])
        if (cancelled || token !== reportToken.current) return

        const sumQty = (rows: OrderItem[]) =>
          rows.reduce((acc, row) => acc + row.quantity, 0)
        const volumeCur = sumQty(itemsCur)
        const volumePrev = sumQty(itemsPrev)
        const weekVariationPct =
          volumePrev > 0 ? Math.round(((volumeCur - volumePrev) / volumePrev) * 100) : null

        const aggregate = new Map<string, TopProductRow>()
        for (const row of items30) {
          if (!row.product_id) continue
          const key = itemKey(row.product_id, row.product_variation_id ?? '')
          const existing = aggregate.get(key)
          const label = [
            row.product_name,
            row.variation_name ? `(${row.variation_name})` : null,
          ]
            .filter(Boolean)
            .join(' ')
          if (existing) {
            existing.quantity += row.quantity
          } else {
            aggregate.set(key, { key, label, quantity: row.quantity })
          }
        }
        const topProducts = [...aggregate.values()]
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10)

        setReport({
          monthOrders: (ordersMonth.data ?? []).length,
          topProduct: topProducts[0]?.label ?? '—',
          weekVariationPct,
          topProducts,
        })
      } catch {
        // Relatórios são auxiliares: falhas não bloqueiam a contagem.
        if (cancelled) return
        setLastOrder(null)
        setReport(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeStoreId, reportReloadKey])

  const bumpReport = (): void => setReportReloadKey((value) => value + 1)

  return { lastOrder, report, bumpReport }
}