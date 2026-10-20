import { formatCurrency, formatPercentage } from '../lib/utils'
import type { SalesMetricsResult } from '../types/sales'

interface SalesResultCardProps {
  result: SalesMetricsResult | null
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-wine-700">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  )
}

export function SalesResultCard({ result }: SalesResultCardProps) {
  const summary = result?.summary
  const salesReport = result?.salesReport ?? []
  if (!summary) return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800">Resultado do cálculo</p>
        <span className="text-xs text-gray-500">
          {salesReport.length} registro(s) · atualizado a cada digitação
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MetricTile label="Total vendido" value={formatCurrency(summary.totalSold)} />
        <MetricTile
          label="Base de cálculo"
          value={formatCurrency(summary.effectiveBaseTotal)}
          hint={
            summary.customTotalBase !== null && summary.customTotalBase > 0
              ? 'Meta informada'
              : 'Fallback: soma das vendas'
          }
        />
        <MetricTile
          label="Meta informada"
          value={summary.customTotalBase !== null ? formatCurrency(summary.customTotalBase) : '—'}
          hint={summary.customTotalBase !== null ? 'Usada como base' : 'Não informada'}
        />
        <MetricTile label="Ticket médio" value={formatCurrency(summary.averageTicket)} />
        <MetricTile label="Registros" value={String(summary.count)} />
        <MetricTile
          label="Atingimento da meta"
          value={formatPercentage(summary.targetAchievementPercentage)}
        />
        <MetricTile
          label="Maior venda"
          value={summary.topSale ? summary.topSale.name : '—'}
          hint={summary.topSale ? formatCurrency(summary.topSale.value) : 'Sem registros'}
        />
      </div>

      {salesReport.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Detalhamento por vendedor
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {salesReport.map((item) => (
              <li
                key={`${item.id}-${item.name}`}
                className="rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
                    <p className="font-mono text-[11px] text-gray-400">#{item.id}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-wine-700">
                      {formatCurrency(item.value)}
                    </p>
                    <p className="text-xs tabular-nums text-gray-500">
                      {formatPercentage(item.percentage)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-wine-600 to-gold-400 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
