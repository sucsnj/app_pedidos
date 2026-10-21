import { useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from '../types/app'
import type { Profile, Store as StoreRow } from '../types/database'
import { useCatalog } from '../hooks/useCatalog'
import { useFlash } from '../hooks/useFlash'
import { useOnline } from '../hooks/useOnline'
import { usePendingSync } from '../hooks/usePendingSync'
import { useStoreReports } from '../hooks/useStoreReports'
import { useStoreSession } from '../hooks/useStoreSession'
import { discardPending, flushQueue } from '../lib/offlineQueue'
import { getErrorMessage } from '../lib/utils'
import { AppHeader } from './AppHeader'
import { AppNav } from './AppNav'
import { FlashToast } from './FlashToast'
import { MobileStatusBar } from './MobileStatusBar'
import { OfflineBanner } from './OfflineBanner'
import { SyncBanner } from './SyncBanner'
import { LoadingScreen, ErrorScreen } from './AppScreen'
import { contentClass } from './ui'
import { CountingBoard } from './CountingBoard'
import { DataEntryBoard } from './DataEntryBoard'
import { CatalogBoard } from './CatalogBoard'
import { ComparisonBoard } from './ComparisonBoard'
import { CollaboratorsBoard } from './CollaboratorsBoard'

interface DashboardProps {
  profile: Profile | null
  isAdmin: boolean
  currentUserId: string
}

const TAB_STORAGE_KEY = 'pedidos:tab'

function readStoredTab(): TabId {
  try {
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY)
    return raw === 'entry' || raw === 'catalog' || raw === 'comparativo' ? raw : 'count'
  } catch {
    return 'count'
  }
}

export function Dashboard({ profile, isAdmin, currentUserId }: DashboardProps) {
  const [tab, setTabState] = useState<TabId>(readStoredTab)
  const setTab = useCallback((next: TabId) => {
    setTabState(next)
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next)
    } catch {
      // Sem storage — a aba apenas não é lembrada.
    }
  }, [])
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
  const { pending, refresh } = usePendingSync()
  const [syncing, setSyncing] = useState(false)

  const session = useStoreSession({
    catalog,
    notify,
    onNavigate: setTab,
    preferredStoreId: profile?.store_id ?? null,
    userId: currentUserId,
    isAdmin,
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
    flushDraft,
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
  // Offline não é, por si só, um erro: o app segue funcionando com os dados
  // espelhados. A mensagem de offline só substitui um erro real.
  const effectiveError = errorMessage
    ? isOffline
      ? 'Sem conexão — os dados espelhados serão exibidos. Se esta loja ainda não foi espelhada neste dispositivo, conecte-se uma vez para carregar.'
      : errorMessage
    : null

  const syncingRef = useRef(false)
  const syncPending = useCallback(async (): Promise<void> => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const { flushed, remaining, discarded } = await flushQueue(true)
      if (flushed > 0) {
        notify('Alterações sincronizadas.', 'success')
        await refreshCurrentOrder()
      }
      if (discarded > 0) {
        notify(
          `${discarded} alteração(ões) não puderam ser sincronizadas e foram descartadas.`,
          'error',
        )
      }
      if (remaining === 0) void refresh()
    } catch (err) {
      notify(getErrorMessage(err), 'error')
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [notify, refreshCurrentOrder, refresh])

  const discardPendingChanges = useCallback((): void => {
    const confirmed = window.confirm(
      'Descartar as alterações pendentes? Elas serão perdidas e não chegarão ao servidor.',
    )
    if (!confirmed) return
    void discardPending()
      .then((count) => {
        if (count > 0) notify('Alterações pendentes descartadas.', 'success')
        void refresh()
      })
      .catch((err) => notify(getErrorMessage(err), 'error'))
  }, [notify, refresh])

  const wasOfflineRef = useRef(false)
  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true
      return
    }
    if (!wasOfflineRef.current) return
    wasOfflineRef.current = false
    if (errorMessage) {
      clearError()
      reloadCatalog()
    }
    void syncPending()
  }, [isOffline, errorMessage, clearError, reloadCatalog, syncPending])

  const didAttemptMountSync = useRef(false)
  useEffect(() => {
    if (didAttemptMountSync.current) return
    // Aguarda o fim da carga da sessão: antes disso `currentOrder` é null e o
    // `refreshCurrentOrder` capturado não reconciliaria o pedido.
    if (loading || pending === 0) return
    didAttemptMountSync.current = true
    if (!isOffline) void syncPending()
  }, [loading, pending, isOffline, syncPending])

  useEffect(() => {
    if (!online || pending === 0) return
    const timer = window.setInterval(() => {
      void syncPending()
    }, 20000)
    return () => window.clearInterval(timer)
  }, [online, pending, syncPending])

  useEffect(() => {
    return () => {
      flushDraft()
    }
  }, [flushDraft])

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
    <div className="pb-24">
      <OfflineBanner />
      <SyncBanner
        pending={pending}
        syncing={syncing}
        onSync={() => void syncPending()}
        onDiscard={discardPendingChanges}
      />
      <AppHeader
        stores={catalog.stores}
        orders={orders}
        activeStoreId={activeStoreId}
        currentOrderId={currentOrder?.id ?? null}
        saving={saving}
        showStoreSelector={isAdmin}
        onSelectStore={selectStore}
        onSelectOrder={(orderId) => void selectOrder(orderId)}
        onNewCount={() => void newCount()}
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

      <main className={contentClass}>
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
