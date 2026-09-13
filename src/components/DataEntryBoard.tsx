import { useMemo, useState } from 'react'
import { Check, Copy, ListChecks, MonitorCheck } from 'lucide-react'
import type { Order, Store } from '../types/database'
import type { CountedItem, ItemKey } from '../types/app'
import { compareByEntryCode } from '../types/app'
import { buildOrderSummary, copyTextToClipboard } from '../lib/orderText'
import { EmptyState } from './ui'

interface DataEntryBoardProps {
  store: Store | undefined
  order: Order | null
  items: CountedItem[]
  requesterName: string
  onToggleEntered: (key: ItemKey) => void
}

export function DataEntryBoard({
  store,
  order,
  items,
  requesterName,
  onToggleEntered,
}: DataEntryBoardProps) {
  const [copied, setCopied] = useState(false)

  const pending = useMemo(
    () => items.filter((item) => item.quantity > 0).sort(compareByEntryCode),
    [items],
  )
  const enteredCount = pending.filter((item) => item.isEnteredInLegacy).length

  const handleCopy = async () => {
    if (!order) return
    const text = buildOrderSummary({
      store,
      order,
      items: pending,
      requesterName,
    })
    await copyTextToClipboard(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MonitorCheck className="h-5 w-5 text-wine-600" />
            <div>
              <p className="text-sm font-bold text-gray-800">Modo Digitação</p>
              <p className="text-xs text-gray-500">
                Marque o que já foi digitado no sistema legado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Resumo em Texto'}
          </button>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Progresso da digitação</span>
            <span>
              {enteredCount}/{pending.length} digitados
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{
                width: pending.length === 0 ? '0%' : `${(enteredCount / pending.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </section>

      {pending.length === 0 ? (
        <EmptyState>
          <p className="font-semibold">Nenhum item com quantidade.</p>
          <p className="mt-1">Realize a contagem na aba Prancheta primeiro.</p>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {pending.map((item) => {
              const code = item.product.code ?? item.variation.sku_code ?? '---'
              const entered = item.isEnteredInLegacy
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onToggleEntered(item.key)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-green-50 ${
                      entered
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                        entered
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {entered ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                    </span>
                    <span className="w-16 shrink-0 font-mono text-xs font-semibold text-wine-700">
                      {code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          entered
                            ? 'text-gray-400 line-through decoration-green-400'
                            : 'text-gray-800'
                        }`}
                      >
                        {item.product.name}
                        {item.variation.name
                          ? ` (${item.variation.name})`
                          : ''}
                      </span>
                      <span className="block truncate text-xs text-gray-400">
                        {item.product.unit_type || '—'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                        entered
                          ? 'bg-green-100 text-green-700'
                          : 'bg-wine-100 text-wine-700'
                      }`}
                    >
                      {item.quantity}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 px-1 text-xs text-gray-400">
        <ListChecks className="h-4 w-4" />
        Dica: itens verdes/riscados já foram digitados. O resumo respeita a ordem do código PLU/SKU.
      </div>
    </div>
  )
}