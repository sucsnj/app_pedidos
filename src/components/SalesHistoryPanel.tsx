import { History, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, formatPercentage } from '../lib/utils'
import { percentageOf } from '../lib/salesMetrics'
import { CollapsibleCard } from './CollapsibleCard'
import type { SalesCalculation, Store } from '../types/database'

interface SalesHistoryPanelProps {
  history: SalesCalculation[]
  stores: Store[]
  loading: boolean
  onLoad: (entry: SalesCalculation) => Promise<boolean>
  onDelete: (id: string) => Promise<void>
}

interface TopSaleInfo {
  name: string
  value: number
}

function topSaleInfo(entry: SalesCalculation): TopSaleInfo | null {
  const top = entry.top_sale
  if (!top || typeof top !== 'object' || Array.isArray(top)) return null
  const name = (top as { name?: unknown }).name
  const value = (top as { value?: unknown }).value
  if (typeof name !== 'string' || name === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return { name, value }
}

export function SalesHistoryPanel({ history, stores, loading, onLoad, onDelete }: SalesHistoryPanelProps) {
  const total = history.reduce((sum, entry) => sum + Number(entry.total_sold), 0)

  return (
    <CollapsibleCard
      storageKey="management-historico"
      title="Histórico"
      subtitle="Clique em um lançamento para carregá-lo no formulário."
      icon={<History className="h-5 w-5" />}
      badge={
        history.length > 0 ? (
          <span className="text-xs text-gray-500">
            Acumulado: <strong className="text-wine-700">{formatCurrency(total)}</strong>
          </span>
        ) : null
      }
    >
      {loading ? (
        <p className="text-sm text-gray-400">Carregando histórico...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum registro ainda. Lance as vendas para começar o histórico.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {history.map((entry) => {
            const top = topSaleInfo(entry)
            const base = Number(entry.effective_base_total)
            const topPercentage = top ? percentageOf(top.value, base) : null
            const storeName = stores.find((store) => store.id === entry.store_id)?.name
            const metaPercentage =
              entry.target_achievement_percentage === null
                ? null
                : Number(entry.target_achievement_percentage)
            return (
              <li
                key={entry.id}
                className="flex min-w-0 items-stretch gap-1 rounded-xl border border-gray-200 bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => void onLoad(entry)}
                  aria-label={`Carregar lançamento de ${entry.reference_date}`}
                  className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-wine-50/50 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(new Date(`${entry.reference_date}T12:00:00`))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.record_count} vendedor(es) · base {formatCurrency(base)}
                      {storeName ? ` · ${storeName}` : ''}
                    </p>
                    {top ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Melhor: <span className="font-semibold text-wine-700">{top.name}</span> ·{' '}
                        {formatCurrency(top.value)}
                        {topPercentage !== null ? ` (${formatPercentage(topPercentage)})` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-wine-700">
                      {formatCurrency(Number(entry.total_sold))}
                    </p>
                    {metaPercentage !== null ? (
                      <p className="text-xs font-semibold tabular-nums text-gray-500">
                        {formatPercentage(metaPercentage)} da meta
                      </p>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      'Excluir este lançamento do histórico? As vendas vinculadas também serão removidas.',
                    )
                    if (confirmed) void onDelete(entry.id)
                  }}
                  aria-label={`Excluir lançamento de ${entry.reference_date}`}
                  className="my-1 mr-1 inline-flex w-9 shrink-0 items-center justify-center self-stretch rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </CollapsibleCard>
  )
}
