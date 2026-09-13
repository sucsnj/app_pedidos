import type { Order, Store } from '../types/database'
import type { CountedItem } from '../types/app'
import { compareByEntryCode } from '../types/app'
import { formatDate } from './utils'

/**
 * Gera um resumo limpo do pedido para colagem rápida
 * (WhatsApp, e-mail ou digitação no sistema legado).
 */
export function buildOrderSummary(params: {
  store: Store | undefined
  order: Order
  items: CountedItem[]
  requesterName: string
}): string {
  const { store, order, items, requesterName } = params
  const pending = items
    .filter((item) => item.quantity > 0)
    .slice()
    .sort(compareByEntryCode)

  const lines: string[] = []
  lines.push('PEDIDO DE ABASTECIMENTO')
  if (store) {
    lines.push(`Loja: ${store.name}${store.code ? ` (${store.code})` : ''}`)
  }
  lines.push(`Solicitante: ${requesterName.trim() || '-'}`)
  lines.push(`Data: ${formatDate(new Date())}`)
  lines.push(`Status: ${order.status === 'Concluido' ? 'Concluído' : 'Rascunho'}`)
  lines.push(`Total de itens: ${order.total_items}`)
  lines.push('')
  lines.push('--------------------------------------------------')

  if (pending.length === 0) {
    lines.push('Nenhum item contado.')
  } else {
    pending.forEach((item, index) => {
      const code = item.product.code ?? item.variation.sku_code ?? '---'
      const variation = item.variation.name
        ? ` · ${item.variation.name}`
        : ''
      lines.push(`${index + 1}. [${code}] ${item.product.name}${variation} = ${item.quantity}`)
    })
  }

  lines.push('')
  lines.push(`TOTAL: ${pending.length} linha(s) / ${order.total_items} unidade(s)`)
  lines.push('')
  lines.push('— Enviado pelo App de Pedidos & Abastecimento')
  return lines.join('\n')
}

/** Copia texto para a área de transferência com fallback para navegadores antigos. */
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fallback para contextos sem Permissions API
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}