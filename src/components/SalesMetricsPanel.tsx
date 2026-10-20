import { AlertTriangle, Calculator, Save } from 'lucide-react'
import { inputClass } from './ui'
import type { ManagementError } from '../hooks/useSalesManagement'

interface SalesMetricsPanelProps {
  meta: string
  referenceDate: string
  error: ManagementError | null
  saving: boolean
  onMetaChange: (value: string) => void
  onReferenceDateChange: (value: string) => void
  onRegister: () => Promise<boolean>
}

export function SalesMetricsPanel({
  meta,
  referenceDate,
  error,
  saving,
  onMetaChange,
  onReferenceDateChange,
  onRegister,
}: SalesMetricsPanelProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-wine-600" />
        <div>
          <p className="text-sm font-bold text-gray-800">Cálculo de vendas</p>
          <p className="text-xs text-gray-500">
            Data de referência e meta. Os indicadores são calculados em tempo real.
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
  )
}
