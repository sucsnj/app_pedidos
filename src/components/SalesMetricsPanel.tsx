import { AlertTriangle, Calculator, Eraser, Play, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { useSalesMetrics } from '../hooks/useSalesMetrics'
import { formatCurrency, formatPercentage } from '../lib/utils'
import { inputClass } from './ui'

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-wine-700">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </section>
  )
}

export function SalesMetricsPanel() {
  const {
    meta,
    setMeta,
    sellers,
    addSeller,
    updateSeller,
    removeSeller,
    result,
    error,
    process,
    clear,
    loadExample,
  } = useSalesMetrics()
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
              Informe a meta e os vendedores para consolidar os indicadores.
            </p>
          </div>
        </div>

        <label className="block max-w-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Meta (base de cálculo)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={meta}
            onChange={(event) => setMeta(event.target.value)}
            placeholder="Ex.: 50000 (opcional)"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-gray-400">
            Sem meta, a base do cálculo é a soma das vendas informadas.
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-800">Vendedores</p>
            <p className="text-xs text-gray-500">
              {sellers.length} linha(s) · o valor de cada um entra no cálculo.
            </p>
          </div>
          <button
            type="button"
            onClick={addSeller}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:scale-95"
          >
            <UserPlus className="h-4 w-4" /> Adicionar vendedor
          </button>
        </div>

        <ul className="space-y-2">
          {sellers.map((row, index) => (
            <li
              key={row.uid}
              className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_160px_40px]"
            >
              <input
                type="text"
                value={row.name}
                onChange={(event) => updateSeller(row.uid, { name: event.target.value })}
                placeholder={`Nome do vendedor ${index + 1}`}
                aria-label={`Nome do vendedor ${index + 1}`}
                className={inputClass}
              />
              <input
                type="text"
                inputMode="decimal"
                value={row.value}
                onChange={(event) => updateSeller(row.uid, { value: event.target.value })}
                placeholder="Valor (0,00)"
                aria-label={`Valor do vendedor ${index + 1}`}
                className={`${inputClass} text-right tabular-nums`}
              />
              <button
                type="button"
                onClick={() => removeSeller(row.uid)}
                disabled={sellers.length <= 1}
                aria-label={`Remover vendedor ${index + 1}`}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={process}
            className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-wine-600 active:scale-95"
          >
            <Play className="h-4 w-4" /> Calcular
          </button>
          <button
            type="button"
            onClick={loadExample}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> Carregar exemplo
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:scale-95"
          >
            <Eraser className="h-4 w-4" /> Limpar
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Erro {error.status} — {error.message}
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-red-600">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {result && summary ? (
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

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
                Detalhamento por vendedor
              </h3>
              <span className="text-xs text-gray-500">{salesReport.length} registro(s)</span>
            </div>
            {salesReport.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma venda informada.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {salesReport.map((item) => (
                  <li key={`${item.id}-${item.name}`} className="rounded-xl border border-gray-200 bg-white p-3">
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
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
