import { describe, expect, it } from 'vitest'
import { buildOrderSummary } from '../../src/lib/orderText'
import { itemKey } from '../../src/types/app'
import type { CountedItem } from '../../src/types/app'
import type { Order, Store } from '../../src/types/database'

const store: Store = {
  id: 'store-1',
  code: 'L1',
  name: 'Loja Central',
  is_active: true,
  created_at: '2026-01-01',
}

const order: Order = {
  id: 'o1',
  store_id: 'store-1',
  requester_name: 'Ana',
  status: 'Concluido',
  total_items: 5,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function makeItem(code: string, name: string, quantity: number): CountedItem {
  return {
    key: itemKey('p1', 'v1'),
    product: {
      id: 'p1',
      category_id: 'c1',
      code,
      name,
      unit_type: 'UN',
      is_active: true,
      display_order: 1,
      created_at: '2026-01-01',
    },
    variation: {
      id: 'v1',
      product_id: 'p1',
      name: '1L',
      weight_label: null,
      sku_code: null,
      price: 0,
      is_available: true,
      created_at: '2026-01-01',
    },
    quantity,
    isEnteredInLegacy: false,
  }
}

describe('orderText — resumo do pedido', () => {
  it('lista apenas itens com quantidade, ordenados por código', () => {
    const text = buildOrderSummary({
      store,
      order,
      requesterName: 'Ana',
      items: [makeItem('200', 'Arroz', 2), makeItem('100', 'Leite', 3), makeItem('300', 'Café', 0)],
    })

    const lines = text.split('\n')
    const itemLines = lines.filter((line) => /^\d+\. \[/.test(line))

    expect(itemLines).toHaveLength(2)
    expect(itemLines[0]).toContain('[100] Leite')
    expect(itemLines[1]).toContain('[200] Arroz')
  })

  it('inclui loja, solicitante e status', () => {
    const text = buildOrderSummary({
      store,
      order,
      requesterName: 'Ana',
      items: [makeItem('100', 'Leite', 3)],
    })

    expect(text).toContain('PEDIDO DE ABASTECIMENTO')
    expect(text).toContain('Loja: Loja Central (L1)')
    expect(text).toContain('Solicitante: Ana')
    expect(text).toContain('Status: Concluído')
    expect(text).toContain('TOTAL: 1 linha(s) / 5 unidade(s)')
  })

  it('avisa quando não há itens contados', () => {
    const text = buildOrderSummary({ store, order, requesterName: '', items: [] })

    expect(text).toContain('Solicitante: -')
    expect(text).toContain('Nenhum item contado.')
  })

  it('funciona sem loja informada', () => {
    const text = buildOrderSummary({
      store: undefined,
      order,
      requesterName: 'Ana',
      items: [makeItem('100', 'Leite', 3)],
    })

    expect(text).not.toContain('Loja:')
    expect(text).toContain('1. [100] Leite · 1L = 3')
  })
})
