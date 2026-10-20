import { History } from 'lucide-react'
import { formatCurrency, formatDate, formatPercentage } from '../lib/utils'
import type { SalesCalculation } from '../types/database'

interface SalesHistoryPanelProps {
  history: SalesCalculation[]
  loading: boolean
}

export function SalesHistoryPanel({ history, loading }: SalesHistoryPanelProps) {
  const total = history.reduce((sum, entry) => sum + Number(entry.total_sold), 0)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-wine-600" />
          <div>
            <p className="text-sm font-bold text-gray-800">Histórico</p>
            <p className="text-xs text-gray-500">
              Consolidações registradas — base para análises futuras.
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
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">
                  {formatDate(new Date(`${entry.reference_date}T12:00:00`))}
                </p>
                <p className="text-xs text-gray-500">
                  {entry.record_count} vendedor(es) · base {formatCurrency(entry.effective_base_total)}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
