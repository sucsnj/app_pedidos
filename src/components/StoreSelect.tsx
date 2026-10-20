import { Store } from 'lucide-react'
import type { Store as StoreRow } from '../types/database'

interface StoreSelectProps {
  stores: StoreRow[]
  activeStoreId: string
  showStoreSelector: boolean
  onSelectStore: (storeId: string) => void
}

/** Seletor de loja usado no `/orders` e no `/management` (mesmo componente/estilo). */
export function StoreSelect({
  stores,
  activeStoreId,
  showStoreSelector,
  onSelectStore,
}: StoreSelectProps) {
  const activeStoreName = stores.find((store) => store.id === activeStoreId)?.name ?? 'Nenhuma loja'

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {showStoreSelector ? (
        <>
          <Store className="hidden h-4 w-4 shrink-0 text-gold-300 sm:block" />
          <select
            value={activeStoreId}
            onChange={(event) => onSelectStore(event.target.value)}
            aria-label="Selecionar loja"
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
  )
}
