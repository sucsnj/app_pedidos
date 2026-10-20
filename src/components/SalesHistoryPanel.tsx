import { History, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, formatPercentage } from '../lib/utils'
import type { SalesCalculation } from '../types/database'

interface SalesHistoryPanelProps {
  history: SalesCalculation[]
  loading: boolean
  onLoad: (entry: SalesCalculation) => Promise<boolean>
  onDelete: (id: string) => Promise<void>
}

function topSaleName(entry: SalesCalculation): string | null {
  const top = entry.top_sale
  if (!top || typeof top !== 'object' || Array.isArray(top)) return null
  const name = (top as { name?: unknown }).name
  return typeof name === 'string' ? name : null
}

export function SalesHistoryPanel({ history, loading, onLoad, onDelete }: SalesHistoryPanelProps) {
  const total = history.reduce((sum, entry) => sum + Number(entry.total_sold), 0)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-wine-600" />
          <div>
            <p className="text-sm font-bold text-gray-800">Histórico</p>
            <p className="text-xs text-gray-500">
              Clique em um lançamento para carregá-lo no formulário.
            </p>
          </div>
        </div>
        {history.length > 0 ? (
          <span className="text-xs text-gray-500">
            Acumulado: <strong className="text-wine-700">{formatCurrency(total)}</strong>
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando histórico...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum registro ainda. Lance as vendas para começar o histórico.
        </p>
      ) : (
        <ul className="space-y-2">
          {history.map((entry) => {
            const top = topSaleName(entry)
            return (
              <li key={entry.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => void onLoad(entry)}
                  aria-label={`Carregar lançamento de ${entry.reference_date}`}
                  className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-wine-300 hover:bg-wine-50/50 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(new Date(`${entry.reference_date}T12:00:00`))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.record_count} vendedor(es) · base{' '}
                      {formatCurrency(Number(entry.effective_base_total))}
                      {top ? ` · maior: ${top}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-wine-700">
                      {formatCurrency(Number(entry.total_sold))}
                    </p>
                    {entry.target_achievement_percentage !== null ? (
                      <p className="text-xs tabular-nums text-gray-500">
                        {formatPercentage(Number(entry.target_achievement_percentage))} da meta
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
                  className="inline-flex w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
