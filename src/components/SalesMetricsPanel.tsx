import { AlertTriangle, Calculator } from 'lucide-react'
import { inputClass } from './ui'
import { CollapsibleCard } from './CollapsibleCard'
import type { ManagementError } from '../hooks/useSalesManagement'

interface SalesMetricsPanelProps {
  meta: string
  referenceDate: string
  error: ManagementError | null
  registered: boolean
  zeroedCount: number
  onMetaChange: (value: string) => void
  onReferenceDateChange: (value: string) => void
}

export function SalesMetricsPanel({
  meta,
  referenceDate,
  error,
  registered,
  zeroedCount,
  onMetaChange,
  onReferenceDateChange,
}: SalesMetricsPanelProps) {
  return (
    <CollapsibleCard
      storageKey="management-calculo"
      title="Cálculo de vendas"
      subtitle="Data de referência e meta — os indicadores são calculados em tempo real."
      icon={<Calculator className="h-5 w-5" />}
      accent="wine"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:max-w-3xl">
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
        <span className="text-xs text-gray-400">
          {registered
            ? 'Vendas enviadas ao histórico — use “Novas vendas” para limpar os valores e começar outro lançamento.'
            : 'O registro grava a consolidação e as vendas no banco (histórico). Sem meta informada, o app pede confirmação antes de registrar.'}
        </span>
      </div>
      {zeroedCount > 0 ? (
        <p className="mt-2 text-xs font-medium text-amber-600">
          {zeroedCount} vendedor(es) com R$ 0,00 — serão registrados como “sem vendas no período”.
        </p>
      ) : null}
    </CollapsibleCard>
  )
}
