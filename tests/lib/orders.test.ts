import { describe, expect, it } from 'vitest'
import {
  adjustCountedItems,
  mapOrderItems,
  mergeOrderRow,
  mergeOrdersList,
  orderDisplayEquals,
  orderLabel,
  resolveItemForCount,
  sameCountedList,
  setCountedQuantity,
  toOrderItemRows,
} from '../../src/lib/orders'
import { itemKey } from '../../src/types/app'
import type { Catalog, CountedItem } from '../../src/types/app'
import type { Order, OrderItem } from '../../src/types/database'

const catalog: Catalog = {
  stores: [],
  categories: [],
  products: [
    {
      id: 'p1',
      category_id: 'c1',
      code: '100',
      name: 'Leite',
      unit_type: 'UN',
      is_active: true,
      display_order: 1,
      created_at: '2026-01-01',
    },
  ],
  variations: [
    {
      id: 'v1',
      product_id: 'p1',
      name: '1L',
      weight_label: '1L',
      sku_code: '100-1L',
      price: 5,
      is_available: true,
      created_at: '2026-01-01',
    },
  ],
}

function makeItem(key: string, quantity: number, entered = false): CountedItem {
  const [productId, variationId] = key.split('::')
  const product = catalog.products.find((entry) => entry.id === productId)!
  const variation =
    catalog.variations.find((entry) => entry.id === variationId) ?? {
      id: variationId,
      product_id: productId,
      name: 'Unidade',
      weight_label: null,
      sku_code: null,
      price: 0,
      is_available: true,
      created_at: '',
    }
  return { key, product, variation, quantity, isEnteredInLegacy: entered }
}

describe('orders — mapeamento de itens', () => {
  it('mapeia linhas do banco para itens contados', () => {
    const rows: OrderItem[] = [
      {
        id: 'i1',
        order_id: 'o1',
        product_id: 'p1',
        product_variation_id: 'v1',
        product_code: '100',
        product_name: 'Leite',
        variation_name: '1L',
        quantity: 2,
        is_entered_in_legacy: true,
        created_at: '2026-01-01',
      },
    ]

    const items = mapOrderItems(rows, catalog)

    expect(items).toHaveLength(1)
    expect(items[0].key).toBe(itemKey('p1', 'v1'))
    expect(items[0].quantity).toBe(2)
    expect(items[0].isEnteredInLegacy).toBe(true)
  })

  it('ignora linhas sem produto ou de produto desconhecido', () => {
    const rows = [
      { product_id: null },
      { product_id: 'inexistente' },
    ] as unknown as OrderItem[]

    expect(mapOrderItems(rows, catalog)).toEqual([])
  })

  it('usa a variação sintética quando a linha não tem variação', () => {
    const rows = [
      {
        id: 'i1',
        order_id: 'o1',
        product_id: 'p1',
        product_variation_id: null,
        product_code: '100',
        product_name: 'Leite',
        variation_name: null,
        quantity: 1,
        is_entered_in_legacy: false,
        created_at: '2026-01-01',
      },
    ] as OrderItem[]

    const items = mapOrderItems(rows, catalog)

    expect(items[0].variation.id).toBe('')
    expect(items[0].variation.name).toBe('Unidade')
  })
})

describe('orders — contagem', () => {
  const key = itemKey('p1', 'v1')
  const match = resolveItemForCount(catalog, key)!

  it('resolve produto e variação pela chave', () => {
    expect(match.product.id).toBe('p1')
    expect(match.variation.id).toBe('v1')
  })

  it('cria o item no primeiro incremento e soma nos seguintes', () => {
    const created = adjustCountedItems([], key, 1, match)
    expect(created).toHaveLength(1)
    expect(created[0].quantity).toBe(1)

    const incremented = adjustCountedItems(created, key, 2, match)
    expect(incremented[0].quantity).toBe(3)
  })

  it('nunca fica negativo', () => {
    const items = [makeItem(key, 1)]
    const result = adjustCountedItems(items, key, -5, match)
    expect(result[0].quantity).toBe(0)
  })

  it('setCountedQuantity define o valor exato', () => {
    const items = [makeItem(key, 1)]
    expect(setCountedQuantity(items, key, 7, match)[0].quantity).toBe(7)
  })

  it('toOrderItemRows descarta itens zerados', () => {
    const items = [makeItem(key, 0), makeItem(key, 4)]
    const rows = toOrderItemRows(items, 'o1')
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(4)
    expect(rows[0].order_id).toBe('o1')
  })
})

describe('orders — comparação e merge', () => {
  const base: Order = {
    id: 'o1',
    store_id: 'store-1',
    requester_name: 'Ana',
    status: 'Rascunho',
    total_items: 2,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  it('orderDisplayEquals compara status, total, solicitante e notas', () => {
    expect(orderDisplayEquals(base, { ...base })).toBe(true)
    expect(orderDisplayEquals(base, { ...base, total_items: 3 })).toBe(false)
  })

  it('mergeOrderRow atualiza os campos e o updated_at', () => {
    const merged = mergeOrderRow(base, 5, 'Bruno', 'obs', '2026-02-02T00:00:00.000Z')
    expect(merged.total_items).toBe(5)
    expect(merged.requester_name).toBe('Bruno')
    expect(merged.notes).toBe('obs')
    expect(merged.updated_at).toBe('2026-02-02T00:00:00.000Z')
  })

  it('mergeOrdersList preserva a identidade quando nada muda', () => {
    const list = [base]
    const merged = mergeOrdersList(list, { ...base })
    expect(merged).toBe(list)
  })

  it('sameCountedList compara chave, quantidade e marcação', () => {
    const key = itemKey('p1', 'v1')
    expect(sameCountedList([makeItem(key, 1)], [makeItem(key, 1)])).toBe(true)
    expect(sameCountedList([makeItem(key, 1)], [makeItem(key, 2)])).toBe(false)
    expect(sameCountedList([makeItem(key, 1, true)], [makeItem(key, 1, false)])).toBe(false)
  })
})

describe('orders — rótulo', () => {
  // Data montada no fuso local para o rótulo não depender do timezone da CI.
  const localDate = new Date(2026, 2, 5, 12, 0, 0).toISOString()
  const order: Order = {
    id: 'o1',
    store_id: 'store-1',
    requester_name: 'Ana',
    status: 'Rascunho',
    total_items: 0,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: localDate,
  }

  it('identifica um rascunho vazio', () => {
    expect(orderLabel(order)).toBe('Novo rascunho · 05/03')
  })

  it('mostra status, total e data de um pedido concluído', () => {
    expect(orderLabel({ ...order, status: 'Concluido', total_items: 4 })).toBe(
      'Concluído · 4 itens · 05/03',
    )
  })
})
