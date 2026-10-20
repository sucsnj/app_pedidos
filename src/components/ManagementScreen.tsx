import { useState } from 'react'
import { BarChart3, Banknote, Settings, Store as StoreIcon } from 'lucide-react'
import { useFlash } from '../hooks/useFlash'
import { useSalesManagement } from '../hooks/useSalesManagement'
import { useStoreSelection } from '../hooks/useStoreSelection'
import { contentClass, selectClass } from './ui'
import { FlashToast } from './FlashToast'
import { SalesHistoryPanel } from './SalesHistoryPanel'
import { SalesMetricsPanel } from './SalesMetricsPanel'
import { SalesResultCard } from './SalesResultCard'
import { SalesSellersCard } from './SalesSellersCard'
import { SectionPlaceholder } from './SectionPlaceholder'
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
    <main className={contentClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wine-100">
            <Settings className="h-5 w-5 text-wine-700" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">Gestão</h2>
        </div>

        <div className="w-full sm:w-72">
          {selection.isAdmin ? (
            <select
              value={selection.storeId}
              onChange={(event) => selection.selectStore(event.target.value)}
              disabled={selection.stores.length === 0}
              aria-label="Selecionar loja"
              className={`${selectClass} font-bold`}
            >
              <option value="">Selecione a loja</option>
              {selection.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {store.code ? ' (' + store.code + ')' : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
              <StoreIcon className="h-4 w-4 shrink-0 text-wine-600" />
              <span className="truncate text-sm font-bold text-gray-800">
                {selection.activeStore?.name ?? 'Nenhuma loja'}
              </span>
            </div>
          )}
        </div>
      </div>

      <TabsBar tabs={tabs} active={tab} onChange={setTab} />

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

      <FlashToast flash={flash} />
    </main>
  )
}
