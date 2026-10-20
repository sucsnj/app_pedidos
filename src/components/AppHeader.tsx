import { Plus, Store } from 'lucide-react'
import type { Order, Store as StoreRow } from '../types/database'
import { orderLabel } from '../lib/orders'
import { Spinner, barClass } from './ui'

interface AppHeaderProps {
  stores: StoreRow[]
  orders: Order[]
  activeStoreId: string
  currentOrderId: string | null
  saving: boolean
  showStoreSelector: boolean
  onSelectStore: (storeId: string) => void
  onSelectOrder: (orderId: string) => void
  onNewCount: () => void
}

export function AppHeader({
  stores,
  orders,
  activeStoreId,
  currentOrderId,
  saving,
  showStoreSelector,
  onSelectStore,
  onSelectOrder,
  onNewCount,
}: AppHeaderProps) {
  const activeStoreName = stores.find((store) => store.id === activeStoreId)?.name ?? 'Nenhuma loja'

  return (
    <header className="bg-wine-800 text-white shadow-sm">
      <div className={`${barClass} flex flex-col gap-2 py-2.5`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showStoreSelector ? (
              <>
                <Store className="hidden h-4 w-4 shrink-0 text-gold-300 sm:block" />
                <select
                  value={activeStoreId}
                  onChange={(event) => onSelectStore(event.target.value)}
                  className="w-full rounded-lg border border-gold-500 bg-gold-400 px-3 py-2 text-sm font-bold text-wine-800 outline-none focus:border-wine-900"
                >
                  <option value="">Selecione a loja</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                      {store.code ? ' (' + store.code + ')' : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-gold-500 bg-gold-400 px-3 py-2">
                <Store className="hidden h-4 w-4 shrink-0 text-wine-800 sm:block" />
                <span className="truncate text-sm font-bold text-wine-800">{activeStoreName}</span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 gap-2">
            <select
              value={currentOrderId ?? ''}
              onChange={(event) => onSelectOrder(event.target.value)}
              disabled={orders.length === 0}
              className="min-w-0 flex-1 rounded-lg border border-gold-500/40 bg-wine-900/70 px-3 py-2 text-sm font-medium text-white outline-none focus:border-gold-400 disabled:opacity-50"
            >
              <option value="">Sem pedido</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {orderLabel(order)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onNewCount}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-2 text-sm font-bold text-wine-800 transition hover:bg-gold-500 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova contagem</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>

          {saving ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3 py-1 text-xs font-semibold sm:self-auto">
              <Spinner className="h-3.5 w-3.5" /> Salvando
            </span>
          ) : null}
        </div>
      </div>
    </header>
  )
}
