// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../../src/types/database'
import type { CountedItem } from '../../src/types/app'
import { useDraftPersistence } from '../../src/hooks/useDraftPersistence'

const updateOrder = vi.fn(async () => ({ error: null }))
const deleteItems = vi.fn(async () => ({ error: null }))
const insertItems = vi.fn(async () => ({ error: null }))
const persistOrderDraftRpc = vi.fn(async (_args?: unknown) => ({ error: null }))
const enqueuePersistDraft = vi.fn(async () => undefined)
const removeDraftForOrder = vi.fn(async () => undefined)
const state = vi.hoisted(() => ({ offline: false }))

vi.mock('../../src/lib/supabase', () => ({
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

vi.mock('../../src/lib/offlineQueue', () => ({
  enqueuePersistDraft: (...args: unknown[]) => enqueuePersistDraft(...(args as [])),
  removeDraftForOrder: (...args: unknown[]) => removeDraftForOrder(...(args as [])),
  isOffline: () => state.offline,
  isOfflineError: () => false,
}))

vi.mock('../../src/lib/localCache', () => ({
  updateOrderInStore: vi.fn(async () => undefined),
  cacheCountedItems: vi.fn(async () => undefined),
}))

const order: Order = {
  id: 'order-1',
  store_id: 'store-1',
  requester_name: 'Ana',
  status: 'Rascunho',
  total_items: 3,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const items: CountedItem[] = [
  {
    key: 'p1::',
    product: {
      id: 'p1',
      category_id: 'c1',
      code: '100',
      name: 'Leite',
      unit_type: 'UN',
      is_active: true,
      display_order: 1,
      created_at: '2026-01-01',
    },
    variation: {
      id: '',
      product_id: 'p1',
      name: 'Unidade',
      weight_label: null,
      sku_code: '100',
      price: 0,
      is_available: true,
      created_at: '',
    },
    quantity: 3,
    isEnteredInLegacy: false,
  },
]

type HookApi = ReturnType<typeof useDraftPersistence>

let api: HookApi | null = null

function Harness(props: {
  currentOrder: Order
  items: CountedItem[]
  onReady: (value: HookApi) => void
}) {
  const value = useDraftPersistence({
    currentOrder: props.currentOrder,
    items: props.items,
    requesterName: 'Ana',
    notes: '',
    loading: false,
    notify: vi.fn(),
    setCurrentOrder: vi.fn(),
    setOrders: vi.fn(),
  })
  props.onReady(value)
  return null
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  state.offline = false
  updateOrder.mockClear()
  deleteItems.mockClear()
  insertItems.mockClear()
  enqueuePersistDraft.mockClear()
  removeDraftForOrder.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api = null
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function mount() {
  await act(async () => {
    root.render(
      <Harness
        currentOrder={order}
        items={items}
        onReady={(value) => {
          api = value
        }}
      />,
    )
  })
  if (!api) throw new Error('hook não inicializado')
  return api
}

describe('useDraftPersistence — rascunho pendente x persist online', () => {
  it('remove da fila o rascunho pendente quando o persist online conclui', async () => {
    const hook = await mount()

    await act(async () => {
      hook.saveNow()
    })

    expect(persistOrderDraftRpc).toHaveBeenCalled()
    expect(removeDraftForOrder).toHaveBeenCalledWith('order-1')
  })

  it('flushDraft grava o rascunho sem exibir erro (desmontagem da tela)', async () => {
    const hook = await mount()

    await act(async () => {
      hook.flushDraft()
    })

    expect(persistOrderDraftRpc).toHaveBeenCalled()
    expect(enqueuePersistDraft).not.toHaveBeenCalled()
  })

  it('offline: enfileira o rascunho sem tentar o servidor', async () => {    const hook = await mount()
    state.offline = true

    await act(async () => {
      hook.saveNow()
    })

    expect(enqueuePersistDraft).toHaveBeenCalled()
    expect(persistOrderDraftRpc).not.toHaveBeenCalled()
    expect(removeDraftForOrder).not.toHaveBeenCalled()
  })

  it('usa o caminho legado quando a RPC ainda não existe no banco', async () => {
    persistOrderDraftRpc.mockRejectedValueOnce(
      Object.assign(new Error('function persist_order_draft does not exist'), {
        code: '42883',
      }),
    )
    const hook = await mount()

    await act(async () => {
      hook.saveNow()
    })

    expect(persistOrderDraftRpc).toHaveBeenCalled()
    expect(updateOrder).toHaveBeenCalled()
    expect(insertItems).toHaveBeenCalled()
  })
})
