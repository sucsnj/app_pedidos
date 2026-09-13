import { useCallback, useState } from 'react'
import type { TabId } from './types/app'
import type { Store as StoreRow } from './types/database'
import { useCatalog } from './hooks/useCatalog'
import { useFlash } from './hooks/useFlash'
import { useStoreReports } from './hooks/useStoreReports'
import { useStoreSession } from './hooks/useStoreSession'
import { AppHeader } from './components/AppHeader'
import { AppNav } from './components/AppNav'
import { FlashToast } from './components/FlashToast'
import { MobileStatusBar } from './components/MobileStatusBar'
import { LoadingScreen, ErrorScreen } from './components/AppScreen'
import { CountingBoard } from './components/CountingBoard'
import { DataEntryBoard } from './components/DataEntryBoard'
import { CatalogBoard } from './components/CatalogBoard'
import { ComparisonBoard } from './components/ComparisonBoard'

export default function App() {
  const [tab, setTab] = useState<TabId>('count')
  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
    refresh: refreshCatalog,
  } = useCatalog()
  const { flash, notify } = useFlash()

  const session = useStoreSession({ catalog, notify, onNavigate: setTab })
  const {
    activeStoreId,
    orders,
    currentOrder,
    items,
    suggestions,
    requesterName,
    notes,
    loading,
    error,
    saving,
    finishing,
    savedAt,
    setRequesterName,
    setNotes,
    adjust,
    setQuantity,
    toggleEntered,
    selectStore,
    selectOrder,
    newCount,
    finishOrder,
    saveNow,
    clearError,
  } = session

  const { lastOrder, report, bumpReport } = useStoreReports(activeStoreId, catalog)

  const handleFinishOrder = useCallback(async () => {
    const ok = await finishOrder()
    if (ok) bumpReport()
  }, [finishOrder, bumpReport])

  /* ------------------------------- Render ---------------------------- */

  const activeStore: StoreRow | undefined = catalog.stores.find(
    (store) => store.id === activeStoreId,
  )
  const totalCounted = items.reduce((sum, item) => sum + item.quantity, 0)
  const locksOrder = currentOrder !== null && currentOrder.status !== 'Rascunho'

  const isLoading = catalogLoading || loading
  const errorMessage = error ?? catalogError

  if (isLoading) {
    return <LoadingScreen />
  }

  if (errorMessage) {
    return (
      <ErrorScreen
        message={errorMessage}
        onRetry={() => {
          clearError()
          reloadCatalog()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-shell pb-24 text-gray-900">
      <AppHeader
        stores={catalog.stores}
        orders={orders}
        activeStoreId={activeStoreId}
        currentOrderId={currentOrder?.id ?? null}
        saving={saving}
        onSelectStore={selectStore}
        onSelectOrder={(orderId) => void selectOrder(orderId)}
        onNewCount={() => void newCount()}
      />

      <AppNav
        tab={tab}
        canFinish={tab === 'count' && !locksOrder}
        finishing={finishing}
        totalCounted={totalCounted}
        onTabChange={setTab}
        onFinish={() => void handleFinishOrder()}
      />

      <main className="mx-auto max-w-3xl px-3 pt-4">
        {tab === 'count' && (
          <CountingBoard
            storeName={activeStore?.name ?? 'Nenhuma loja selecionada'}
            categories={catalog.categories}
            products={catalog.products}
            variations={catalog.variations}
            items={items}
            suggestions={suggestions}
            requesterName={requesterName}
            notes={notes}
            orderStatus={currentOrder?.status ?? null}
            saving={saving}
            savedAt={savedAt}
            lastOrder={lastOrder}
            onRequesterNameChange={setRequesterName}
            onNotesChange={setNotes}
            onAdjust={adjust}
            onSetQuantity={setQuantity}
            onSaveNow={saveNow}
          />
        )}

        {tab === 'entry' && (
          <DataEntryBoard
            store={activeStore}
            order={currentOrder}
            items={items}
            requesterName={requesterName}
            onToggleEntered={toggleEntered}
          />
        )}

        {tab === 'catalog' && (
          <CatalogBoard
            catalog={catalog}
            onRefresh={refreshCatalog}
            onFlash={notify}
          />
        )}

        {tab === 'comparativo' && (
          <ComparisonBoard
            storeName={activeStore?.name ?? 'Nenhuma loja selecionada'}
            currentItems={items}
            lastOrder={lastOrder}
            monthOrders={report?.monthOrders ?? 0}
            topProduct={report?.topProduct ?? '—'}
            weekVariationPct={report?.weekVariationPct ?? null}
            topProducts={report?.topProducts ?? []}
          />
        )}
      </main>

      <FlashToast flash={flash} />

      <MobileStatusBar
        storeName={activeStore?.name ?? null}
        totalCounted={totalCounted}
        currentOrder={currentOrder}
        locksOrder={locksOrder}
      />
    </div>
  )
}