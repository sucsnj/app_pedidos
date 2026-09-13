import type { Order } from '../types/database'

interface MobileStatusBarProps {
  storeName: string | null
  totalCounted: number
  currentOrder: Order | null
  locksOrder: boolean
}

export function MobileStatusBar({
  storeName,
  totalCounted,
  currentOrder,
  locksOrder,
}: MobileStatusBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/90 px-4 py-2 backdrop-blur sm:hidden">
      <p className="text-center text-xs font-semibold text-gray-600">
        {storeName ?? 'Sem loja'} · {totalCounted} unidade(s)
        {currentOrder
          ? ' · ' + (locksOrder ? 'Concluído' : 'Rascunho salvo automaticamente')
          : ''}
      </p>
    </div>
  )
}
