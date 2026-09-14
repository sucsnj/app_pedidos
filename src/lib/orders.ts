import type { CountedItem, Catalog, ItemKey } from '../types/app'
import { itemKey, defaultVariationForProduct, SYNTHETIC_VARIATION_ID } from '../types/app'
import type {
  Order,
  OrderItem,
  OrderItemInsert,
  Product,
  ProductVariation,
} from '../types/database'

export function mapOrderItems(rows: OrderItem[], catalog: Catalog): CountedItem[] {
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

export function sameCountedList(a: CountedItem[], b: CountedItem[]): boolean {
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

export interface CountItemMatch {
  product: Product
  variation: ProductVariation
}

/** Resolve produto e variação a partir da chave única `${productId}::${variationId}`. */
export function resolveItemForCount(
  catalog: Catalog,
  key: ItemKey,
): CountItemMatch | null {
  const separator = key.indexOf('::')
  const productId = key.slice(0, separator)
  const variationId = key.slice(separator + 2)
  const product = catalog.products.find((entry) => entry.id === productId)
  if (!product) return null
  const variation =
    variationId === SYNTHETIC_VARIATION_ID
      ? defaultVariationForProduct(product)
      : catalog.variations.find((entry) => entry.id === variationId)
  if (!variation) return null
  return { product, variation }
}

export function adjustCountedItems(
  items: CountedItem[],
  key: ItemKey,
  delta: number,
  match: CountItemMatch,
): CountedItem[] {
  const { product, variation } = match
  const index = items.findIndex((item) => item.key === key)
  if (index === -1) {
    if (delta <= 0) return items
    return [
      ...items,
      { key, product, variation, quantity: delta, isEnteredInLegacy: false },
    ]
  }
  return items.map((item, itemIndex) =>
    itemIndex === index
      ? { ...item, quantity: Math.max(0, item.quantity + delta) }
      : item,
  )
}

export function setCountedQuantity(
  items: CountedItem[],
  key: ItemKey,
  next: number,
  match: CountItemMatch,
): CountedItem[] {
  const { product, variation } = match
  const index = items.findIndex((item) => item.key === key)
  if (index === -1) {
    if (next === 0) return items
    return [
      ...items,
      { key, product, variation, quantity: next, isEnteredInLegacy: false },
    ]
  }
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, quantity: next } : item,
  )
}

export function orderDisplayEquals(a: Order, b: Order): boolean {
  return (
    a.status === b.status &&
    a.total_items === b.total_items &&
    a.requester_name === b.requester_name &&
    a.notes === b.notes
  )
}

export function mergeOrderRow(
  base: Order,
  totalItems: number,
  requesterName: string,
  notes: string | null,
): Order {
  return { ...base, total_items: totalItems, requester_name: requesterName, notes }
}

/** Linhas de `order_items` compatíveis com o generic do supabase-js (requer index signature). */
type OrderItemRow = OrderItemInsert & Record<string, unknown>

export function toOrderItemRows(items: CountedItem[], orderId: string): OrderItemRow[] {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      order_id: orderId,
      product_id: item.product.id,
      product_variation_id: item.variation.id || null,
      product_code: item.product.code,
      product_name: item.product.name,
      variation_name: item.variation.name,
      quantity: item.quantity,
      is_entered_in_legacy: item.isEnteredInLegacy,
    }))
}

/** Mescla uma versão sincronizada na lista de pedidos, preservando identidade quando inalterada. */
export function mergeOrdersList(previous: Order[], synced: Order): Order[] {
  let changed = false
  const next = previous.map((entry) => {
    if (entry.id !== synced.id) return entry
    if (orderDisplayEquals(entry, synced)) return entry
    changed = true
    return { ...entry, ...synced }
  })
  return changed ? next : previous
}

export function orderLabel(order: Order): string {
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
