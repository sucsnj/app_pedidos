import type { CountedItem, Catalog } from '../types/app'
import { itemKey, defaultVariationForProduct } from '../types/app'
import type { Order, OrderItem } from '../types/database'

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