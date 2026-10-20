import { Settings } from 'lucide-react'
import { useFlash } from '../hooks/useFlash'
import { useSalesManagement } from '../hooks/useSalesManagement'
import { contentClass } from './ui'
import { FlashToast } from './FlashToast'
import { SalesHistoryPanel } from './SalesHistoryPanel'
import { SalesMetricsPanel } from './SalesMetricsPanel'
import { SalesResultCard } from './SalesResultCard'
import { SalesSellersCard } from './SalesSellersCard'

interface ManagementScreenProps {
  storeId?: string | null
}

export function ManagementScreen({ storeId = null }: ManagementScreenProps) {
  const { flash, notify } = useFlash()
  const sales = useSalesManagement({ storeId, notify })

  return (
    <main className={contentClass}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wine-100">
          <Settings className="h-5 w-5 text-wine-700" />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">Gestão</h2>
          <p className="text-xs text-gray-500">
            Vendedores, lançamento de vendas e histórico para análise.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <SalesMetricsPanel
          meta={sales.meta}
          referenceDate={sales.referenceDate}
          error={sales.error}
          saving={sales.saving}
          onMetaChange={sales.setMeta}
          onReferenceDateChange={sales.setReferenceDate}
          onRegister={sales.register}
        />

        <SalesResultCard result={sales.result} />

        <SalesSellersCard
          sellers={sales.sellers}
          values={sales.values}
          saving={sales.saving}
          onAdd={sales.addSeller}
          onRename={sales.renameSeller}
          onRemove={sales.removeSeller}
          onValueChange={sales.setValue}
          onClearValues={sales.clearValues}
        />

        <SalesHistoryPanel
          history={sales.history}
          loading={sales.loading}
          onLoad={sales.loadHistory}
          onDelete={sales.removeHistory}
        />
      </div>

      <FlashToast flash={flash} />
    </main>
  )
}
