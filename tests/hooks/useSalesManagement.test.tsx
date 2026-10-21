// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSalesManagement } from '../../src/hooks/useSalesManagement'

const sellersByStore: Record<string, { id: string; name: string; store_id: string }[]> = {
  'store-1': [{ id: 'seller-1', name: 'Ana Souza', store_id: 'store-1' }],
  'store-2': [{ id: 'seller-2', name: 'Bruno Lima', store_id: 'store-2' }],
}

const fetchSellers = vi.fn(async (storeId?: string | null) =>
  storeId ? (sellersByStore[storeId] ?? []) : [],
)
const fetchHistory = vi.fn(async () => [])
const deactivateSeller = vi.fn(async () => undefined)

vi.mock('../../src/lib/salesStore', () => ({
  fetchSellers: (...args: unknown[]) => fetchSellers(...(args as [])),
  fetchHistory: (...args: unknown[]) => fetchHistory(...(args as [])),
  fetchSalesRecords: vi.fn(async () => []),
  createSeller: vi.fn(),
  updateSeller: vi.fn(),
  deactivateSeller: (...args: unknown[]) => deactivateSeller(...(args as [])),
  deleteCalculation: vi.fn(),
  recordSales: vi.fn(),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let api: ReturnType<typeof useSalesManagement> | null = null

function Harness(props: { storeId: string }) {
  api = useSalesManagement({ storeId: props.storeId, ready: true, notify: vi.fn() })
  return null
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  fetchSellers.mockClear()
  fetchHistory.mockClear()
  deactivateSeller.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api = null
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(storeId: string) {
  await act(async () => {
    root.render(<Harness storeId={storeId} />)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  if (!api) throw new Error('hook não inicializado')
  return api
}

describe('useSalesManagement — escopo por loja', () => {
  it('carrega vendedores e histórico da loja selecionada', async () => {
    await render('store-1')

    expect(fetchSellers).toHaveBeenCalledWith('store-1')
    expect(fetchHistory).toHaveBeenCalledWith(20, 'store-1')
    expect(api?.sellers).toHaveLength(1)
  })

  it('limpa valores, meta e registro ao trocar de loja', async () => {
    await render('store-1')
    act(() => api?.setValue('seller-1', '100'))
    act(() => api?.setMeta('5000'))
    expect(api?.hasValues).toBe(true)

    await render('store-2')

    expect(api?.values).toEqual({})
    expect(api?.meta).toBe('')
    expect(api?.registered).toBe(false)
    expect(api?.sellers.map((seller) => seller.id)).toEqual(['seller-2'])
  })

  it('desativa o vendedor (soft delete) em vez de excluir', async () => {
    await render('store-1')

    await act(async () => {
      await api?.removeSeller('seller-1')
    })

    expect(deactivateSeller).toHaveBeenCalledWith('seller-1')
    expect(api?.sellers).toHaveLength(0)
  })
})
