import { useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from '../types/app'
import type { Profile, Store as StoreRow } from '../types/database'
import { useCatalog } from '../hooks/useCatalog'
import { useFlash } from '../hooks/useFlash'
import { useOnline } from '../hooks/useOnline'
import { useStoreReports } from '../hooks/useStoreReports'
import { useStoreSession } from '../hooks/useStoreSession'
import { flushQueue } from '../lib/offlineQueue'
import { AppHeader } from './AppHeader'
import { AppNav } from './AppNav'
import { FlashToast } from './FlashToast'
import { MobileStatusBar } from './MobileStatusBar'
import { OfflineBanner } from './OfflineBanner'
import { LoadingScreen, ErrorScreen } from './AppScreen'
import { CountingBoard } from './CountingBoard'
import { DataEntryBoard } from './DataEntryBoard'
import { CatalogBoard } from './CatalogBoard'
import { ComparisonBoard } from './ComparisonBoard'
import { CollaboratorsBoard } from './CollaboratorsBoard'

interface DashboardProps {
  profile: Profile | null
  userName: string
  isAdmin: boolean
  currentUserId: string
  onSignOut: () => void
}

export function Dashboard({
  profile,
  userName,
  isAdmin,
  currentUserId,
  onSignOut,
}: DashboardProps) {
  const [tab, setTab] = useState<TabId>('count')
  const canManageCatalog = isAdmin
  const canSeeComparativo = isAdmin

  useEffect(() => {
    if (!canManageCatalog && (tab === 'catalog' || tab === 'comparativo')) {
      setTab('count')
    }
  }, [canManageCatalog, tab])

  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
    refresh: refreshCatalog,
  } = useCatalog()
  const { flash, notify } = useFlash()
  const online = useOnline()

  const session = useStoreSession({
    catalog,
    notify,
    onNavigate: setTab,
    preferredStoreId: profile?.store_id ?? null,
    userId: currentUserId,
  })
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
    refreshCurrentOrder,
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

  const isOffline = !online
  const effectiveError = isOffline
    ? 'Você está offline. Verifique a conexão e tente novamente.'
    : errorMessage

  const wasOfflineRef = useRef(false)
  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true
      return
    }
    if (!wasOfflineRef.current) return
    wasOfflineRef.current = false
    void (async () => {
      if (errorMessage) {
        clearError()
        reloadCatalog()
      }
      const { flushed } = await flushQueue()
      if (flushed > 0) {
        notify('Alterações sincronizadas.', 'success')
        await refreshCurrentOrder()
      }
    })()
  }, [isOffline, errorMessage, clearError, reloadCatalog, refreshCurrentOrder, notify])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (effectiveError) {
    return (
      <ErrorScreen
        message={effectiveError}
        onRetry={() => {
          clearError()
          reloadCatalog()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-shell pb-24 text-gray-900">
      <OfflineBanner />
      <AppHeader
        stores={catalog.stores}
        orders={orders}
        activeStoreId={activeStoreId}
        currentOrderId={currentOrder?.id ?? null}
        saving={saving}
        userName={userName}
        isAdmin={isAdmin}
        showStoreSelector={isAdmin}
        onSelectStore={selectStore}
        onSelectOrder={(orderId) => void selectOrder(orderId)}
        onNewCount={() => void newCount()}
        onSignOut={onSignOut}
      />

      <AppNav
        tab={tab}
        canFinish={tab === 'count' && !locksOrder}
        finishing={finishing}
        totalCounted={totalCounted}
        showCatalog={canManageCatalog}
        showComparativo={canSeeComparativo}
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

        {tab === 'catalog' && canManageCatalog && (
          <div className="space-y-4">
            <CollaboratorsBoard
              stores={catalog.stores}
              currentUserId={currentUserId}
              onFlash={notify}
            />
            <CatalogBoard
              catalog={catalog}
              onRefresh={refreshCatalog}
              onFlash={notify}
            />
          </div>
        )}

        {tab === 'comparativo' && canSeeComparativo && (
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