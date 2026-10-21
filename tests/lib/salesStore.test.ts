import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSeller,
  deactivateSeller,
  fetchHistory,
  fetchSalesRecords,
  fetchSellers,
  recordSales,
} from '../../src/lib/salesStore'

const state = vi.hoisted(() => ({
  table: '' as string,
  orFilter: '' as string,
  eqFilter: '' as string,
  inserted: [] as unknown[],
  updated: [] as unknown[],
  data: null as unknown,
  error: null as { code?: string; message: string } | null,
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      state.table = table
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.eq = (column: string, value: string) => {
        state.eqFilter = `${column}=${value}`
        return builder
      }
      builder.or = (filter: string) => {
        state.orFilter = filter
        return builder
      }
      builder.insert = (values: unknown) => {
        state.inserted.push(values)
        return builder
      }
      builder.update = (values: unknown) => {
        state.updated.push(values)
        return builder
      }
      builder.limit = () => builder
      builder.single = () =>
        Promise.resolve({
          data: state.data ?? { id: 'generated-id' },
          error: state.error,
        })
      builder.then = (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) =>
        Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject)
      return builder
    },
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
  },
}))

beforeEach(() => {
  state.table = ''
  state.orFilter = ''
  state.eqFilter = ''
  state.inserted = []
  state.updated = []
  state.data = null
  state.error = null
})

describe('salesStore — camada de persistência', () => {
  it('filtra os vendedores por loja (e os globais) e apenas os ativos', async () => {
    await fetchSellers('store-1')

    expect(state.table).toBe('sellers')
    expect(state.orFilter).toBe('store_id.eq.store-1,store_id.is.null')
  })

  it('não filtra por loja quando ela não é informada', async () => {
    await fetchSellers(null)

    expect(state.orFilter).toBe('')
  })

  it('traduz violação de nome único em mensagem amigável', async () => {
    state.error = { code: '23505', message: 'duplicate key' }

    await expect(createSeller('Ana', 'store-1')).rejects.toThrow(
      'Já existe um vendedor com esse nome.',
    )
  })

  it('cria o vendedor vinculado à loja', async () => {
    await createSeller('Ana', 'store-1')

    expect(state.inserted).toContainEqual({ name: 'Ana', store_id: 'store-1' })
  })

  it('desativa o vendedor em vez de excluir (soft delete, preserva o histórico)', async () => {
    await deactivateSeller('seller-1')

    expect(state.updated).toContainEqual({ is_active: false })
    expect(state.inserted).toEqual([])
  })

  it('busca o histórico filtrando pela loja', async () => {
    await fetchHistory(20, 'store-1')

    expect(state.table).toBe('sales_calculations')
    expect(state.orFilter).toBe('store_id.eq.store-1,store_id.is.null')
  })

  it('busca as vendas de uma consolidação pelo id', async () => {
    await fetchSalesRecords('calc-1')

    expect(state.table).toBe('sales_records')
    expect(state.eqFilter).toBe('calculation_id=calc-1')
  })

  it('grava a consolidação e as vendas por vendedor', async () => {
    await recordSales({
      storeId: 'store-1',
      referenceDate: '2026-10-01',
      summary: {
        totalSold: 100,
        effectiveBaseTotal: 100,
        customTotalBase: null,
        averageTicket: 50,
        count: 2,
        targetAchievementPercentage: 100,
        topSale: { id: 's1', name: 'Ana', value: 60 },
      },
      items: [
        { sellerId: 's1', sellerName: 'Ana', amount: 60, percentage: 60 },
        { sellerId: 's2', sellerName: 'Bruno', amount: 40, percentage: 40 },
      ],
    })

    expect(state.table).toBe('sales_records')
    expect(state.inserted).toHaveLength(2)
    const inserted = state.inserted[1] as { amount: number; percentage: number }[]
    expect(inserted[0].amount).toBe(60)
    expect(inserted[1].percentage).toBe(40)
  })
})
