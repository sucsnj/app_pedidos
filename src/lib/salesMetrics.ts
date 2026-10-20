import type {
  SalesItemInput,
  SalesMetricsResult,
  SalesPayload,
  SalesReportItem,
  SalesSummary,
  SalesTopSale,
  SalesValidationError,
} from '../types/sales'
import { parseNumberOrNull } from './utils'

export class SalesPayloadError extends Error implements SalesValidationError {
  readonly status = 400
  readonly details: string[]

  constructor(details: string[], message = 'Payload inválido.') {
    super(message)
    this.name = 'SalesPayloadError'
    this.details = details
  }
}

/** Arredonda para 2 casas decimais, evitando o erro de ponto flutuante clássico. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeItem(raw: unknown, index: number): { item?: SalesItemInput; error?: string } {
  if (!isPlainObject(raw)) {
    return { error: `sales[${index}] deve ser um objeto.` }
  }
  const id = raw.id
  if (typeof id !== 'string' && typeof id !== 'number') {
    return { error: `sales[${index}].id deve ser um texto ou número.` }
  }
  if (typeof id === 'number' && !Number.isFinite(id)) {
    return { error: `sales[${index}].id deve ser um número finito.` }
  }
  const name = raw.name
  if (typeof name !== 'string' || name.trim() === '') {
    return { error: `sales[${index}].name deve ser um texto não vazio.` }
  }
  const value = raw.value
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: `sales[${index}].value deve ser um número.` }
  }
  if (value < 0) {
    return { error: `sales[${index}].value deve ser maior ou igual a zero.` }
  }
  return { item: { id, name: name.trim(), value } }
}

/**
 * Valida e normaliza o payload recebido.
 * Lança `SalesPayloadError` (status 400) quando o formato é inválido.
 */
export function normalizeSalesPayload(input: unknown): SalesPayload {
  if (!isPlainObject(input)) {
    throw new SalesPayloadError(['O payload deve ser um objeto JSON.'])
  }

  const details: string[] = []
  let customTotalBase: number | null = null

  const rawBase = input.customTotalBase
  if (rawBase !== undefined && rawBase !== null) {
    if (typeof rawBase !== 'number' || !Number.isFinite(rawBase)) {
      details.push('"customTotalBase" deve ser um número.')
    } else if (rawBase < 0) {
      details.push('"customTotalBase" deve ser maior ou igual a zero.')
    } else {
      customTotalBase = rawBase
    }
  }

  const rawSales = input.sales
  if (!Array.isArray(rawSales)) {
    throw new SalesPayloadError([...details, '"sales" deve ser uma lista.'])
  }

  const sales: SalesItemInput[] = []
  rawSales.forEach((raw, index) => {
    const { item, error } = normalizeItem(raw, index)
    if (error) {
      details.push(error)
      return
    }
    if (item) sales.push(item)
  })

  if (details.length > 0) {
    throw new SalesPayloadError(details)
  }

  return { customTotalBase, sales }
}

function findTopSale(items: SalesItemInput[]): SalesTopSale | null {
  if (items.length === 0) return null
  let top = items[0]
  for (const item of items.slice(1)) {
    if (item.value > top.value) top = item
  }
  return { id: top.id, name: top.name, value: round2(top.value) }
}

/**
 * Regras de negócio: total vendido, base efetiva, porcentagem individual,
 * ticket médio, maior venda e atingimento da meta.
 */
export function calculateSalesMetrics(payload: SalesPayload): SalesMetricsResult {
  const items = payload.sales
  const totalSold = round2(items.reduce((sum, item) => sum + item.value, 0))
  const customBase = payload.customTotalBase
  const hasCustomBase = customBase !== null && customBase > 0
  const effectiveBaseTotal = hasCustomBase ? round2(customBase) : totalSold

  const salesReport: SalesReportItem[] = items.map((item) => ({
    ...item,
    percentage:
      effectiveBaseTotal === 0 ? 0 : round2((item.value / effectiveBaseTotal) * 100),
  }))

  const count = items.length
  const averageTicket = count === 0 ? 0 : round2(totalSold / count)
  const targetAchievementPercentage = hasCustomBase
    ? round2((totalSold / customBase) * 100)
    : totalSold === 0
      ? 0
      : 100

  const summary: SalesSummary = {
    totalSold,
    effectiveBaseTotal,
    customTotalBase: customBase,
    averageTicket,
    count,
    targetAchievementPercentage,
    topSale: findTopSale(items),
  }

  return { summary, salesReport }
}

/** Entrada (JSON) → resposta (resumo + detalhamento) em um único passo. */
export function processSalesPayload(input: unknown): SalesMetricsResult {
  return calculateSalesMetrics(normalizeSalesPayload(input))
}

export interface SalesFormRow {
  name: string
  value: string
}

export interface SalesFormInput {
  meta: string
  rows: SalesFormRow[]
}

export interface SalesFormResult {
  payload: SalesPayload | null
  error: SalesValidationError | null
}

/**
 * Converte o formulário (meta + linhas de vendedor) no payload do contrato.
 * Linha em branco ou **valor não informado** ficam de fora do cálculo (sem erro);
 * valores preenchidos e inválidos viram erro 400 (acumulados).
 */
export function buildSalesPayloadFromForm(input: SalesFormInput): SalesFormResult {
  const details: string[] = []
  const sales: SalesItemInput[] = []

  input.rows.forEach((row, index) => {
    const name = row.name.trim()
    const raw = row.value.trim()
    if (name === '' && raw === '') return

    const label = name !== '' ? name : `Vendedor ${index + 1}`
    const value = parseNumberOrNull(row.value)

    if (name === '') {
      details.push(`${label}: informe o nome.`)
    }
    if (raw === '') return

    if (value === null) {
      details.push(`${label}: informe um valor numérico.`)
    } else if (value < 0) {
      details.push(`${label}: o valor não pode ser negativo.`)
    }
    if (name !== '' && value !== null && value >= 0) {
      sales.push({ id: sales.length + 1, name, value })
    }
  })

  let customTotalBase: number | null = null
  const parsedMeta = parseNumberOrNull(input.meta)
  if (input.meta.trim() !== '') {
    if (parsedMeta === null) {
      details.push('Meta: informe um valor numérico.')
    } else if (parsedMeta < 0) {
      details.push('Meta: o valor não pode ser negativo.')
    } else {
      customTotalBase = parsedMeta
    }
  }

  if (details.length > 0) {
    return {
      payload: { customTotalBase, sales },
      error: { status: 400, message: 'Dados inválidos.', details },
    }
  }

  return { payload: { customTotalBase, sales }, error: null }
}
