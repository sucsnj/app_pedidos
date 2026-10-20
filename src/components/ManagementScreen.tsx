import { Settings } from 'lucide-react'
import { contentClass } from './ui'
import { SalesMetricsPanel } from './SalesMetricsPanel'

export function ManagementScreen() {
  return (
    <main className={contentClass}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wine-100">
          <Settings className="h-5 w-5 text-wine-700" />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">Gestão</h2>
          <p className="text-xs text-gray-500">
            Indicadores de vendas e metas. Novos módulos entram aqui.
          </p>
        </div>
      </div>

      <SalesMetricsPanel />
    </main>
  )
}
