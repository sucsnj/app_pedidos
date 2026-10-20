import { describe, expect, it } from 'vitest'
import {
  buildSalesPayloadFromForm,
  calculateSalesMetrics,
  normalizeSalesPayload,
  processSalesPayload,
  round2,
  SalesPayloadError,
} from './salesMetrics'

describe('salesMetrics — normalização do payload', () => {
  it('rejeita payload que não é objeto', () => {
    expect(() => normalizeSalesPayload('nao é json')).toThrow(SalesPayloadError)
    expect(() => normalizeSalesPayload([])).toThrow(SalesPayloadError)
  })

  it('rejeita lista de vendas ausente ou com item inválido', () => {
    expect(() => normalizeSalesPayload({})).toThrow(SalesPayloadError)
    expect(() => normalizeSalesPayload({ sales: [{ id: 1, name: 'Ana' }] })).toThrow(
      SalesPayloadError,
    )
    expect(() =>
      normalizeSalesPayload({ sales: [{ id: 1, name: 'Ana', value: -1 }] }),
    ).toThrow(SalesPayloadError)
  })

  it('rejeita base customizada negativa e normaliza base válida', () => {
    expect(() => normalizeSalesPayload({ customTotalBase: -5, sales: [] })).toThrow(
      SalesPayloadError,
    )
    expect(normalizeSalesPayload({ customTotalBase: 0, sales: [] }).customTotalBase).toBe(0)
    expect(
      normalizeSalesPayload({ customTotalBase: 100, sales: [] }).customTotalBase,
    ).toBe(100)
    expect(normalizeSalesPayload({ sales: [] }).customTotalBase).toBeNull()
  })

  it('acumula todos os detalhes de erro (status 400)', () => {
    try {
      normalizeSalesPayload({ customTotalBase: 'x', sales: [{ id: 1, name: '', value: 1 }] })
      throw new Error('deveria ter falhado')
    } catch (err) {
      expect(err).toBeInstanceOf(SalesPayloadError)
      const failure = err as SalesPayloadError
      expect(failure.status).toBe(400)
      expect(failure.details.length).toBeGreaterThan(1)
    }
  })
})

describe('salesMetrics — cálculo com base customizada informada', () => {
  const payload = {
    customTotalBase: 1000,
    sales: [
      { id: 1, name: 'Ana', value: 600 },
      { id: 2, name: 'Bruno', value: 400 },
    ],
  }

  it('usa a base informada como base de cálculo efetiva', () => {
    const { summary } = calculateSalesMetrics(normalizeSalesPayload(payload))
    expect(summary.totalSold).toBe(1000)
    expect(summary.effectiveBaseTotal).toBe(1000)
    expect(summary.customTotalBase).toBe(1000)
    expect(summary.count).toBe(2)
    expect(summary.averageTicket).toBe(500)
    expect(summary.targetAchievementPercentage).toBe(100)
  })

  it('calcula a porcentagem individual sobre a base informada', () => {
    const { salesReport } = calculateSalesMetrics(normalizeSalesPayload(payload))
    expect(salesReport.map((item) => item.percentage)).toEqual([60, 40])
  })

  it('calcula o atingimento da meta acima de 100%', () => {
    const { summary } = calculateSalesMetrics(
      normalizeSalesPayload({
        customTotalBase: 800,
        sales: [{ id: 1, name: 'Ana', value: 1000 }],
      }),
    )
    expect(summary.totalSold).toBe(1000)
    expect(summary.effectiveBaseTotal).toBe(800)
    expect(summary.targetAchievementPercentage).toBe(125)
  })
})

describe('salesMetrics — cálculo sem base customizada (fallback)', () => {
  it('usa a soma das vendas como base efetiva', () => {
    const { summary, salesReport } = calculateSalesMetrics(
      normalizeSalesPayload({
        sales: [
          { id: 1, name: 'Ana', value: 250 },
          { id: 2, name: 'Bruno', value: 750 },
        ],
      }),
    )
    expect(summary.totalSold).toBe(1000)
    expect(summary.effectiveBaseTotal).toBe(1000)
    expect(summary.customTotalBase).toBeNull()
    expect(summary.averageTicket).toBe(500)
    expect(summary.targetAchievementPercentage).toBe(100)
    expect(salesReport.map((item) => item.percentage)).toEqual([25, 75])
  })

  it('trata base customizada zero como fallback', () => {
    const { summary } = calculateSalesMetrics(
      normalizeSalesPayload({
        customTotalBase: 0,
        sales: [{ id: 1, name: 'Ana', value: 300 }],
      }),
    )
    expect(summary.effectiveBaseTotal).toBe(300)
    expect(summary.targetAchievementPercentage).toBe(100)
  })
})

describe('salesMetrics — lista de vendas vazia', () => {
  it('retorna zeros e nenhuma maior venda', () => {
    const { summary, salesReport } = calculateSalesMetrics(
      normalizeSalesPayload({ sales: [] }),
    )
    expect(summary.totalSold).toBe(0)
    expect(summary.effectiveBaseTotal).toBe(0)
    expect(summary.averageTicket).toBe(0)
    expect(summary.count).toBe(0)
    expect(summary.targetAchievementPercentage).toBe(0)
    expect(summary.topSale).toBeNull()
    expect(salesReport).toEqual([])
  })
})

describe('salesMetrics — prevenção de divisão por zero', () => {
  it('mantém percentuais em zero quando a base efetiva é zero', () => {
    const { summary, salesReport } = calculateSalesMetrics(
      normalizeSalesPayload({
        customTotalBase: 0,
        sales: [
          { id: 1, name: 'Ana', value: 0 },
          { id: 2, name: 'Bruno', value: 0 },
        ],
      }),
    )
    expect(summary.effectiveBaseTotal).toBe(0)
    expect(summary.averageTicket).toBe(0)
    expect(summary.targetAchievementPercentage).toBe(0)
    expect(salesReport.every((item) => item.percentage === 0)).toBe(true)
  })
})

describe('salesMetrics — maior venda e arredondamento', () => {
  it('mantém o primeiro registro em caso de empate', () => {
    const { summary } = calculateSalesMetrics(
      normalizeSalesPayload({
        sales: [
          { id: 1, name: 'Ana', value: 100 },
          { id: 2, name: 'Bruno', value: 100 },
        ],
      }),
    )
    expect(summary.topSale).toEqual({ id: 1, name: 'Ana', value: 100 })
  })

  it('arredonda valores e porcentagens para 2 casas', () => {
    const { summary, salesReport } = calculateSalesMetrics(
      normalizeSalesPayload({
        customTotalBase: 3,
        sales: [{ id: 1, name: 'Ana', value: 1 }],
      }),
    )
    expect(summary.totalSold).toBe(1)
    expect(summary.effectiveBaseTotal).toBe(3)
    expect(summary.targetAchievementPercentage).toBe(33.33)
    expect(salesReport[0].percentage).toBe(33.33)
    expect(round2(1.005)).toBe(1.01)
  })
})

describe('salesMetrics — formulário (meta + vendedores)', () => {
  it('converte o formulário no payload do contrato', () => {
    const { payload, error } = buildSalesPayloadFromForm({
      meta: '50000',
      rows: [
        { name: 'Ana Souza', value: '18500,50' },
        { name: ' Bruno Lima ', value: '12750' },
      ],
    })
    expect(error).toBeNull()
    expect(payload?.customTotalBase).toBe(50000)
    expect(payload?.sales).toEqual([
      { id: 1, name: 'Ana Souza', value: 18500.5 },
      { id: 2, name: 'Bruno Lima', value: 12750 },
    ])
  })

  it('aceita meta vazia (fallback para a soma)', () => {
    const { payload, error } = buildSalesPayloadFromForm({
      meta: '',
      rows: [{ name: 'Ana', value: '100' }],
    })
    expect(error).toBeNull()
    expect(payload?.customTotalBase).toBeNull()
  })

  it('acumula erros de digitação com status 400', () => {
    const { payload, error } = buildSalesPayloadFromForm({
      meta: 'abc',
      rows: [
        { name: '', value: '10' },
        { name: 'Bruno', value: 'xyz' },
        { name: 'Carla', value: '-5' },
      ],
    })
    expect(payload).toBeNull()
    expect(error?.status).toBe(400)
    expect(error?.details).toContain('Meta: informe um valor numérico.')
    expect(error?.details).toContain('Vendedor 1: informe o nome.')
    expect(error?.details).toContain('Vendedor 2: informe um valor numérico.')
    expect(error?.details).toContain('Vendedor 3: o valor não pode ser negativo.')
  })

  it('processa o formulário válido de ponta a ponta', () => {
    const { payload } = buildSalesPayloadFromForm({
      meta: '200',
      rows: [{ name: 'Ana', value: '50' }],
    })
    const { summary } = calculateSalesMetrics(normalizeSalesPayload(payload))
    expect(summary.totalSold).toBe(50)
    expect(summary.effectiveBaseTotal).toBe(200)
    expect(summary.targetAchievementPercentage).toBe(25)
  })
})

describe('salesMetrics — processSalesPayload (entrada → saída)', () => {
  it('devolve o contrato summary + salesReport', () => {
    const result = processSalesPayload({
      customTotalBase: 200,
      sales: [{ id: 'a', name: 'Ana', value: 50 }],
    })
    expect(Object.keys(result)).toEqual(['summary', 'salesReport'])
    expect(result.summary.totalSold).toBe(50)
    expect(result.summary.effectiveBaseTotal).toBe(200)
    expect(result.summary.topSale).toEqual({ id: 'a', name: 'Ana', value: 50 })
    expect(result.salesReport[0].percentage).toBe(25)
  })
})
