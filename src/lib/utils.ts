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

/** Converte texto em número aceitando vírgula decimal; `null` quando inválido/vazio. */
export function parseNumberOrNull(value: string): number | null {
  const raw = value.trim().replace(',', '.')
  if (raw === '') return null
  const parsed = Number(raw)
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