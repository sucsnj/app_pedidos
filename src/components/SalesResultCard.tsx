import type { ReactNode } from 'react'
import {
  Award,
  Banknote,
  BarChart3,
  ChartColumn,
  Gauge,
  ListChecks,
  Receipt,
  Target,
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '../lib/utils'
import { percentageOf } from '../lib/salesMetrics'
import { CollapsibleCard } from './CollapsibleCard'
import type { SalesMetricsResult } from '../types/sales'

interface SalesResultCardProps {
  result: SalesMetricsResult | null
  actions?: ReactNode
}

function MetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <span className="shrink-0 text-wine-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-wine-700">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  )
}

export function SalesResultCard({ result, actions }: SalesResultCardProps) {
  const summary = result?.summary
  const salesReport = result?.salesReport ?? []
  return (
    <CollapsibleCard
      storageKey="management-resultado"
      title="Resultado do cálculo"
      subtitle="Indicadores consolidados e detalhamento por vendedor."
      icon={<BarChart3 className="h-5 w-5" />}
      badge={
        <span className="text-xs text-gray-500">
          {summary ? `${salesReport.length} registro(s)` : 'sem dados'}
        </span>
      }
    >
      {!summary ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Informe o valor de ao menos um vendedor para ver o cálculo.
          </p>
          {actions}
        </div>
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MetricTile
          label="Total vendido"
          value={formatCurrency(summary.totalSold)}
          icon={<Banknote className="h-4 w-4" />}
        />
        <MetricTile
          label="Base de cálculo"
          value={formatCurrency(summary.effectiveBaseTotal)}
          hint={
            summary.customTotalBase !== null && summary.customTotalBase > 0
              ? 'Meta informada'
              : 'Fallback: soma das vendas'
          }
          icon={<ChartColumn className="h-4 w-4" />}
        />
        <MetricTile
          label="Meta informada"
          value={summary.customTotalBase !== null ? formatCurrency(summary.customTotalBase) : '—'}
          hint={summary.customTotalBase !== null ? 'Usada como base' : 'Não informada'}
          icon={<Target className="h-4 w-4" />}
        />
        <MetricTile
          label="Ticket médio"
          value={formatCurrency(summary.averageTicket)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <MetricTile
          label="Registros"
          value={String(summary.count)}
          icon={<ListChecks className="h-4 w-4" />}
        />
        <MetricTile
          label="Atingimento da meta"
          value={formatPercentage(summary.targetAchievementPercentage)}
          icon={<Gauge className="h-4 w-4" />}
        />
        <MetricTile
          label="Maior venda"
          value={summary.topSale ? summary.topSale.name : '—'}
          hint={
            summary.topSale
              ? `${formatCurrency(summary.topSale.value)} · ${formatPercentage(
                  percentageOf(summary.topSale.value, summary.effectiveBaseTotal),
                )}`
              : 'Sem registros'
          }
          icon={<Award className="h-4 w-4" />}
        />
      </div>

      {salesReport.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Detalhamento por vendedor
            </h3>
            {actions}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {salesReport.map((item) => (
              <li
                key={`${item.id}-${item.name}`}
                className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
                    <p className="font-mono text-[11px] text-gray-400">#{item.id}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-wine-700">
                    {formatCurrency(item.value)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-wine-600 to-gold-400 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                    />
                  </div>
                  <span className="shrink-0 rounded-lg bg-wine-100 px-2 py-0.5 text-sm font-extrabold tabular-nums text-wine-700">
                    {formatPercentage(item.percentage)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Detalhamento por vendedor
            </h3>
            {actions}
          </div>
          <p className="text-sm text-gray-400">
            Nenhum vendedor com valor informado. Preencha os valores no card de vendedores.
          </p>
        </div>
      )}
        </>
      )}
    </CollapsibleCard>
  )
}
