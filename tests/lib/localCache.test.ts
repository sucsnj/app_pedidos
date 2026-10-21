import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { withDB } from '../../src/lib/localCache'
import { cacheOrders, readOrders, updateOrderInStore } from '../../src/lib/localCache'
import type { Order } from '../../src/types/database'

function makeOrder(id: string, name: string, updatedAt: string): Order {
  return {
    id,
    store_id: 'store-1',
    requester_name: name,
    status: 'Rascunho',
    total_items: 1,
    notes: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

beforeEach(async () => {
  await withDB(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('mirror', 'readwrite')
      tx.objectStore('mirror').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('falha ao limpar o espelho'))
    })
  })
})

describe('localCache — espelho de pedidos', () => {
  it('updateOrderInStore mescla o pedido sem apagar os demais', async () => {
    await cacheOrders('store-1', [makeOrder('o1', 'Ana', '2026-01-01T10:00:00Z')])

    await updateOrderInStore(makeOrder('o2', 'Bruno', '2026-01-01T11:00:00Z'))

    const orders = await readOrders('store-1')
    expect(orders?.map((order) => order.id).sort()).toEqual(['o1', 'o2'])
  })

  it('updateOrderInStore atualiza o pedido existente sem duplicar', async () => {
    await cacheOrders('store-1', [makeOrder('o1', 'Ana', '2026-01-01T10:00:00Z')])

    await updateOrderInStore(
      makeOrder('o1', 'Ana Souza', '2026-01-02T10:00:00Z'),
    )

    const orders = await readOrders('store-1')
    expect(orders).toHaveLength(1)
    expect(orders?.[0].requester_name).toBe('Ana Souza')
  })

  it('updateOrderInStore cria a lista quando a loja ainda não foi espelhada', async () => {
    await updateOrderInStore(makeOrder('o1', 'Ana', '2026-01-01T10:00:00Z'))

    const orders = await readOrders('store-1')
    expect(orders?.map((order) => order.id)).toEqual(['o1'])
  })
})
