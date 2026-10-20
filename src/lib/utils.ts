export function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown; error_description?: unknown }
    if (typeof candidate.message === 'string' && candidate.message.length > 0) {
      return candidate.message
    }
    if (typeof candidate.error_description === 'string') {
      return candidate.error_description
    }
  }
  if (err instanceof Error) return err.message
  return 'Erro inesperado. Tente novamente.'
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value)
}

export function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Converte texto em número aceitando vírgula **ou** ponto decimal, separador de
 * milhar ("3.289,49"), espaços e símbolos de moeda ("R$ 3.289,49").
 * Retorna `null` quando o texto não representa um número.
 */
export function parseNumberOrNull(value: string): number | null {
  const raw = value
    .replace(/[\s\u00a0]/g, '')
    .replace(/[r$€£]/gi, '')
    .replace(/[^0-9,.\-]/g, '')
  if (raw === '' || raw === '-') return null

  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let normalized: string

  if (lastComma > -1 && lastDot > -1) {
    const decimalAt = Math.max(lastComma, lastDot)
    normalized = `${raw.slice(0, decimalAt).replace(/[.,]/g, '')}.${raw.slice(decimalAt + 1)}`
  } else {
    const sepAt = Math.max(lastComma, lastDot)
    if (sepAt === -1) {
      normalized = raw
    } else {
      const separator = raw[sepAt]
      const head = raw.slice(0, sepAt)
      const tail = raw.slice(sepAt + 1)
      const occurrences = raw.split(separator).length - 1
      const isThousands =
        occurrences > 1 ||
        (tail.length === 3 && /^\d{3}$/.test(tail) && head.replace(/\D/g, '').length <= 3)
      normalized = isThousands
        ? `${head.replace(/\D/g, '')}${tail.replace(/\D/g, '')}`
        : `${head.replace(/[.,]/g, '')}.${tail.replace(/[.,]/g, '')}`
    }
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** Identificador único (uuid do navegador, com fallback). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`
}

export const emptyText = (value: string | null | undefined): string =>
  (value ?? '').trim()