// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Catalog } from '../../src/types/app'
import type { Order } from '../../src/types/database'
import { useStoreSession } from '../../src/hooks/useStoreSession'

const catalog: Catalog = {
  stores: [
    {
      id: 'store-1',
      code: 'L1',
      name: 'Loja Central',
      is_active: true,
      created_at: '2026-01-01',
    },
    {
      id: 'store-2',
      code: 'L2',
      name: 'Loja Norte',
      is_active: true,
      created_at: '2026-01-01',
    },
  ],
  categories: [],
  products: [],
  variations: [],
}

const order: Order = {
  id: 'o1',
  store_id: 'store-1',
  requester_name: 'Ana',
  status: 'Rascunho',
  total_items: 2,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

const state = vi.hoisted(() => ({
  offline: false,
  failWithNetworkError: false,
  rows: {
    orders: [] as unknown[],
    vw_product_suggestions: [] as unknown[],
    order_items: [] as unknown[],
  },
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.eq = () => builder
      builder.insert = () => builder
      builder.update = () => builder
      builder.delete = () => builder
      builder.single = () =>
        Promise.resolve({
          data: (state.rows as Record<string, unknown[]>)[table]?.[0] ?? null,
          error: null,
        })
      builder.then = (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => {
        if (state.failWithNetworkError) {
          return Promise.reject(new TypeError('Failed to fetch')).then(resolve, reject)
        }
        return Promise.resolve({
          data: (state.rows as Record<string, unknown[]>)[table] ?? [],
          error: null,
        }).then(resolve, reject)
      }
      return builder
    },
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
  },
}))

const localCache = vi.hoisted(() => ({
  readOrders: vi.fn(async (): Promise<unknown[] | null> => null),
  readSuggestions: vi.fn(async (): Promise<Map<string, number> | null> => null),
  readCountedItems: vi.fn(async (): Promise<unknown[] | null> => null),
  cacheOrders: vi.fn(async () => undefined),
  cacheSuggestions: vi.fn(async () => undefined),
  cacheCountedItems: vi.fn(async () => undefined),
  updateOrderInStore: vi.fn(async () => undefined),
}))

vi.mock('../../src/lib/localCache', () => localCache)

vi.mock('../../src/hooks/useRealtimeOrder', () => ({
  useRealtimeOrder: () => undefined,
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let api: ReturnType<typeof useStoreSession> | null = null

function Harness(props: { isAdmin: boolean; preferredStoreId: string | null }) {
  api = useStoreSession({
    catalog,
    notify: vi.fn(),
    onNavigate: vi.fn(),
    preferredStoreId: props.preferredStoreId,
    userId: 'user-1',
    isAdmin: props.isAdmin,
  })
  return null
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  state.offline = false
  state.failWithNetworkError = false
  state.rows = { orders: [], vw_product_suggestions: [], order_items: [] }
  localCache.readOrders.mockReset().mockResolvedValue(null)
  localCache.readSuggestions.mockReset().mockResolvedValue(null)
  localCache.readCountedItems.mockReset().mockResolvedValue(null)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api = null
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function mount(isAdmin: boolean, preferredStoreId: string | null) {
  await act(async () => {
    root.render(<Harness isAdmin={isAdmin} preferredStoreId={preferredStoreId} />)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  if (!api) throw new Error('hook não inicializado')
  return api
}

describe('useStoreSession — carga e loja', () => {
  it('admin: usa a loja preferida do navegador', async () => {
    window.localStorage.setItem('pedidos:selectedStore:user-1', 'store-2')

    const session = await mount(true, null)

    expect(session.activeStoreId).toBe('store-2')
  })

  it('gerente: fica preso à loja do perfil, ignorando a preferência', async () => {
    window.localStorage.setItem('pedidos:selectedStore:user-1', 'store-2')

    const session = await mount(false, 'store-1')

    expect(session.activeStoreId).toBe('store-1')
  })

  it('carrega os pedidos do servidor e os espelha', async () => {
    state.rows.orders = [order]

    const session = await mount(true, 'store-1')

    expect(session.orders.map((entry) => entry.id)).toEqual(['o1'])
    expect(session.error).toBeNull()
    expect(localCache.cacheOrders).toHaveBeenCalled()
  })

  it('offline: usa o espelho local quando a rede falha', async () => {
    state.failWithNetworkError = true
    localCache.readOrders.mockResolvedValue([order])

    const session = await mount(true, 'store-1')

    expect(session.orders.map((entry) => entry.id)).toEqual(['o1'])
    expect(session.error).toBeNull()
  })

  it('offline sem espelho: expõe o erro (tela de erro do app)', async () => {
    state.failWithNetworkError = true

    const session = await mount(true, 'store-1')

    expect(session.error).not.toBeNull()
  })
})
