import { useState } from 'react'
import { BarChart3, Banknote } from 'lucide-react'
import { useFlash } from '../hooks/useFlash'
import { useSalesManagement } from '../hooks/useSalesManagement'
import { useStoreSelection } from '../hooks/useStoreSelection'
import { barClass, contentClass } from './ui'
import { FlashToast } from './FlashToast'
import { SalesHistoryPanel } from './SalesHistoryPanel'
import { SalesMetricsPanel } from './SalesMetricsPanel'
import { SalesResultCard } from './SalesResultCard'
import { SalesSellersCard } from './SalesSellersCard'
import { SectionPlaceholder } from './SectionPlaceholder'
import { StoreSelect } from './StoreSelect'
import { TabsBar } from './TabsBar'
import type { TabItem } from './TabsBar'

type ManagementTabId = 'vendas' | 'comparacao'

const tabs: TabItem<ManagementTabId>[] = [
  { id: 'vendas', label: 'Vendas', short: 'Vendas', icon: Banknote },
  { id: 'comparacao', label: 'Comparação', short: 'Comparação', icon: BarChart3 },
]

interface ManagementScreenProps {
  userId?: string | null
  isAdmin?: boolean
  preferredStoreId?: string | null
}

export function ManagementScreen({
  userId = null,
  isAdmin = false,
  preferredStoreId = null,
}: ManagementScreenProps) {
  const [tab, setTab] = useState<ManagementTabId>('vendas')
  const { flash, notify } = useFlash()
  const selection = useStoreSelection({ userId, isAdmin, preferredStoreId })
  const sales = useSalesManagement({ storeId: selection.storeId || null, notify })

  return (
    <>
      <header className="bg-wine-800 text-white shadow-sm">
        <div className={`${barClass} flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center`}>
          <StoreSelect
            stores={selection.stores}
            activeStoreId={selection.storeId}
            showStoreSelector={selection.isAdmin}
            onSelectStore={selection.selectStore}
          />
        </div>
      </header>

      <TabsBar tabs={tabs} active={tab} onChange={setTab} />

      <main className={contentClass}>
        {tab === 'comparacao' ? (
          <div className="pt-4">
            <SectionPlaceholder
              title="Em construção"
              description="Comparações entre períodos, evolução das metas e rankings de vendedores."
              badge="Comparação · em breve"
            />
          </div>
        ) : (
          <div className="grid gap-4 pt-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="min-w-0">
              <SalesMetricsPanel
                meta={sales.meta}
                referenceDate={sales.referenceDate}
                error={sales.error}
                saving={sales.saving}
                onMetaChange={sales.setMeta}
                onReferenceDateChange={sales.setReferenceDate}
                onRegister={sales.register}
              />
            </div>

            <div className="min-w-0">
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
            </div>

            <div className="min-w-0 xl:col-span-2">
              <SalesResultCard result={sales.result} />
            </div>

            <div className="min-w-0 xl:col-span-2">
              <SalesHistoryPanel
                history={sales.history}
                loading={sales.loading}
                onLoad={sales.loadHistory}
                onDelete={sales.removeHistory}
              />
            </div>
          </div>
        )}
      </main>

      <FlashToast flash={flash} />
    </>
  )
}
