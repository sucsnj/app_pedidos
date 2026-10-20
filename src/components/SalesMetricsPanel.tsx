import { AlertTriangle, Calculator, Save } from 'lucide-react'
import { formatCurrency, formatPercentage } from '../lib/utils'
import { inputClass } from './ui'
import type { SalesMetricsResult } from '../types/sales'
import type { ManagementError } from '../hooks/useSalesManagement'

interface SalesMetricsPanelProps {
  meta: string
  referenceDate: string
  result: SalesMetricsResult | null
  error: ManagementError | null
  saving: boolean
  onMetaChange: (value: string) => void
  onReferenceDateChange: (value: string) => void
  onRegister: () => Promise<boolean>
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-wine-700">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </section>
  )
}

export function SalesMetricsPanel({
  meta,
  referenceDate,
  result,
  error,
  saving,
  onMetaChange,
  onReferenceDateChange,
  onRegister,
}: SalesMetricsPanelProps) {
  const summary = result?.summary
  const salesReport = result?.salesReport ?? []

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-wine-600" />
          <div>
            <p className="text-sm font-bold text-gray-800">Cálculo de vendas</p>
            <p className="text-xs text-gray-500">
              Os indicadores são calculados em tempo real com os valores informados.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Data de referência
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => onReferenceDateChange(event.target.value)}
              aria-label="Data de referência"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Meta (base de cálculo)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={meta}
              onChange={(event) => onMetaChange(event.target.value)}
              placeholder="Ex.: 50000 (opcional)"
              aria-label="Meta de vendas"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-gray-400">
              Sem meta, a base do cálculo é a soma das vendas informadas.
            </span>
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error.status ? `Erro ${error.status} — ` : ''}
              {error.message}
            </p>
            {error.details.length > 0 ? (
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-red-600">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onRegister()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> Registrar vendas
          </button>
          <span className="text-xs text-gray-400">
            O registro grava a consolidação e as vendas no banco (histórico).
          </span>
        </div>
      </section>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <MetricCard label="Total vendido" value={formatCurrency(summary.totalSold)} />
            <MetricCard
              label="Base de cálculo"
              value={formatCurrency(summary.effectiveBaseTotal)}
              hint={
                summary.customTotalBase !== null && summary.customTotalBase > 0
                  ? 'Meta informada'
                  : 'Fallback: soma das vendas'
              }
            />
            <MetricCard
              label="Meta informada"
              value={
                summary.customTotalBase !== null ? formatCurrency(summary.customTotalBase) : '—'
              }
              hint={summary.customTotalBase !== null ? 'Usada como base' : 'Não informada'}
            />
            <MetricCard label="Ticket médio" value={formatCurrency(summary.averageTicket)} />
            <MetricCard label="Registros" value={String(summary.count)} />
            <MetricCard
              label="Atingimento da meta"
              value={formatPercentage(summary.targetAchievementPercentage)}
            />
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Maior venda
              </p>
              {summary.topSale ? (
                <>
                  <p className="mt-2 truncate text-lg font-extrabold text-gray-800">
                    {summary.topSale.name}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-wine-700">
                    {formatCurrency(summary.topSale.value)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Sem registros.</p>
              )}
            </section>
          </div>

          {salesReport.length > 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
                  Detalhamento por vendedor
                </h3>
                <span className="text-xs text-gray-500">{salesReport.length} registro(s)</span>
              </div>
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
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
