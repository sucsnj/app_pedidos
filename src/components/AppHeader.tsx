import { ClipboardList, LogOut, Plus, Store } from 'lucide-react'
import type { Order, Store as StoreRow } from '../types/database'
import { orderLabel } from '../lib/orders'
import { Spinner } from './ui'

interface AppHeaderProps {
  stores: StoreRow[]
  orders: Order[]
  activeStoreId: string
  currentOrderId: string | null
  saving: boolean
  userName: string
  isAdmin: boolean
  showStoreSelector: boolean
  onSelectStore: (storeId: string) => void
  onSelectOrder: (orderId: string) => void
  onNewCount: () => void
  onSignOut: () => void
}

export function AppHeader({
  stores,
  orders,
  activeStoreId,
  currentOrderId,
  saving,
  userName,
  isAdmin,
  showStoreSelector,
  onSelectStore,
  onSelectOrder,
  onNewCount,
  onSignOut,
}: AppHeaderProps) {
  const activeStoreName = stores.find((store) => store.id === activeStoreId)?.name ?? 'Nenhuma loja'
  return (
    <header className="bg-wine-700 text-white shadow-md">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400">
              <ClipboardList className="h-5 w-5 text-wine-800" />
            </span>
            <div>
              <h1 className="text-sm font-extrabold leading-tight">
                Pedidos & Abastecimento
              </h1>
              <p className="text-[11px] text-gold-300">Contagem física · Prancheta digital</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold sm:inline-flex">
                <Spinner className="h-3.5 w-3.5" /> Salvando
              </span>
            ) : null}
            <span className="max-w-[110px] truncate text-xs font-semibold text-gold-300 sm:max-w-[160px]">
              {userName}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                isAdmin ? 'bg-gold-400 text-wine-800' : 'bg-white/10 text-gold-300'
              }`}
            >
              {isAdmin ? 'ADMIN' : 'GERENTE'}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>

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
              className="min-w-0 flex-1 rounded-lg border border-gold-500/40 bg-wine-800/70 px-3 py-2 text-sm font-medium text-white outline-none focus:border-gold-400 disabled:opacity-50"
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
        </div>
      </div>
    </header>
  )
}
