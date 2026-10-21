import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withDB } from './localCache'
import {
  discardPending,
  enqueuePersistDraft,
  flushQueue,
  listPending,
  removeDraftForOrder,
} from './offlineQueue'

const updateOrder = vi.fn(async () => ({ error: null }))
const deleteItems = vi.fn(async () => ({ error: null }))
const insertItems = vi.fn(async () => ({ error: null }))
const persistOrderDraftRpc = vi.fn(async (_args?: unknown) => ({ error: null }))

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'orders') {
        return { update: () => ({ eq: () => updateOrder() }) }
      }
      if (table === 'order_items') {
        return {
          delete: () => ({ eq: () => deleteItems() }),
          insert: () => insertItems(),
        }
      }
      throw new Error(`tabela inesperada: ${table}`)
    },
    rpc: (name: string, args: unknown) => {
      if (name !== 'persist_order_draft') throw new Error(`rpc inesperada: ${name}`)
      return persistOrderDraftRpc(args)
    },
  },
}))

const draft = {
  orderId: 'order-1',
  requesterName: 'Ana',
  notes: '',
  totalItems: 3,
  items: [
    {
      product_id: 'p1',
      product_variation_id: null,
      product_code: '100',
      product_name: 'Leite',
      variation_name: 'Unidade',
      quantity: 3,
      is_entered_in_legacy: false,
    },
  ],
}

beforeEach(async () => {
  updateOrder.mockClear()
  deleteItems.mockClear()
  insertItems.mockClear()
  persistOrderDraftRpc.mockClear()
  await withDB(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite')
      tx.objectStore('queue').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('falha ao limpar a fila'))
    })
  })
})

describe('offlineQueue — rascunho pendente x persist online', () => {
  it('removeDraftForOrder apaga o rascunho enfileirado do pedido', async () => {
    await enqueuePersistDraft(draft)
    expect((await listPending()).length).toBe(1)

    await removeDraftForOrder('order-1')

    expect((await listPending()).length).toBe(0)
  })

  it('não remove rascunhos de outros pedidos', async () => {
    await enqueuePersistDraft(draft)
    await enqueuePersistDraft({ ...draft, orderId: 'order-2' })

    await removeDraftForOrder('order-1')

    const pending = await listPending()
    expect(pending.length).toBe(1)
    expect(pending[0].action).toMatchObject({ type: 'persist-draft', orderId: 'order-2' })
  })

  it('flushQueue não reaplica um rascunho já removido (evita sobrescrever estado novo)', async () => {
    await enqueuePersistDraft(draft)
    await removeDraftForOrder('order-1')

    const result = await flushQueue(true)

    expect(result.flushed).toBe(0)
    expect(result.remaining).toBe(0)
    expect(persistOrderDraftRpc).not.toHaveBeenCalled()
    expect(updateOrder).not.toHaveBeenCalled()
    expect(deleteItems).not.toHaveBeenCalled()
    expect(insertItems).not.toHaveBeenCalled()
  })

  it('descarta a ação com erro permanente e segue para as próximas', async () => {
    await enqueuePersistDraft(draft)
    await enqueuePersistDraft({ ...draft, orderId: 'order-2' })
    persistOrderDraftRpc.mockRejectedValueOnce(
      Object.assign(new Error('violates row-level security policy'), { code: '42501' }),
    )

    const result = await flushQueue(true)

    expect(result.discarded).toBe(1)
    expect(result.flushed).toBe(1)
    expect(result.remaining).toBe(0)
  })

  it('preserva a fila quando a falha é de rede', async () => {
    await enqueuePersistDraft(draft)
    persistOrderDraftRpc.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await flushQueue(true)

    expect(result.flushed).toBe(0)
    expect(result.discarded).toBe(0)
    expect(result.remaining).toBe(1)
  })

  it('discardPending limpa a fila', async () => {
    await enqueuePersistDraft(draft)
    await enqueuePersistDraft({ ...draft, orderId: 'order-2' })

    const discarded = await discardPending()

    expect(discarded).toBe(2)
    expect((await listPending()).length).toBe(0)
  })
})
