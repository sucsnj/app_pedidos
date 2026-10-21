import { useCallback, useState } from 'react'
import { BarChart3, Banknote } from 'lucide-react'
import { useFlash } from '../hooks/useFlash'
import { useSalesManagement } from '../hooks/useSalesManagement'
import { useStoreSelection } from '../hooks/useStoreSelection'
import { barClass, contentClass } from './ui'
import { FlashToast } from './FlashToast'
import { OfflineBanner } from './OfflineBanner'
import { SalesHistoryPanel } from './SalesHistoryPanel'
import { SalesMetricsPanel } from './SalesMetricsPanel'
import { SalesResultCard } from './SalesResultCard'
import { SalesSellersCard } from './SalesSellersCard'
import { SectionPlaceholder } from './SectionPlaceholder'
import { SalesActions } from './SalesActions'
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
  const [reveal, setReveal] = useState({ history: 0, sellers: 0 })
  const { flash, notify } = useFlash()
  const selection = useStoreSelection({ userId, isAdmin, preferredStoreId })
  const sales = useSalesManagement({
    storeId: selection.storeId || null,
    ready: selection.resolved,
    notify,
  })

  const handleRegister = useCallback(async () => {
    const ok = await sales.register()
    if (ok) {
      setReveal((previous) => ({ ...previous, history: previous.history + 1 }))
    }
  }, [sales])

  const handleClearValues = useCallback(() => {
    sales.clearValues()
    setReveal((previous) => ({ ...previous, sellers: previous.sellers + 1 }))
  }, [sales])

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
          <SalesActions
            tone="dark"
            className="sm:ml-auto"
            canRegister={sales.canRegister}
            hasAnyValue={sales.hasAnyValue}
            saving={sales.saving}
            onRegister={handleRegister}
            onClear={handleClearValues}
          />
        </div>
      </header>

      <OfflineBanner message="Sem conexão — o cadastro de vendedores, o histórico e o lançamento de vendas dependem do banco." />

      <TabsBar tabs={tabs} active={tab} onChange={setTab} />

      <main className={`${contentClass} pb-12 lg:pb-16`}>
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
                registered={sales.registered}
                zeroedCount={
                  sales.result?.salesReport.filter((item) => item.value === 0).length ?? 0
                }
                onMetaChange={sales.setMeta}
                onReferenceDateChange={sales.setReferenceDate}
              />
            </div>

            <div className="min-w-0">
              <SalesSellersCard
                sellers={sales.sellers}
                values={sales.values}
                saving={sales.saving}
                revealSignal={reveal.sellers}
                onAdd={sales.addSeller}
                onRename={sales.renameSeller}
                onBind={sales.bindSeller}
                onRemove={sales.removeSeller}
                onValueChange={sales.setValue}
                onClearValues={sales.clearValues}
              />
            </div>

            <div className="min-w-0 xl:col-span-2">
              <SalesResultCard
                result={sales.result}
                actions={
                  <SalesActions
                    tone="light"
                    canRegister={sales.canRegister}
                    hasAnyValue={sales.hasAnyValue}
                    saving={sales.saving}
                    onRegister={handleRegister}
                    onClear={handleClearValues}
                  />
                }
              />
            </div>

            <div className="min-w-0 xl:col-span-2">
              <SalesHistoryPanel
                history={sales.history}
                stores={selection.stores}
                loading={sales.loading}
                revealSignal={reveal.history}
                onLoad={sales.loadHistory}
                onDelete={sales.removeHistory}
              />
            </div>
          </div>
        )}

        <footer className="mt-8 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
          {selection.activeStore?.name ?? 'Sem loja'} · {sales.history.length} lançamento(s) no
          histórico
        </footer>
      </main>

      <FlashToast flash={flash} />
    </>
  )
}
