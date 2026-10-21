import { formatCurrency } from '../lib/utils'

interface ManagementStatusBarProps {
  storeName: string | null
  totalSold: number | null
  sellerCount: number
}

/**
 * Rodapé fixo do `/management` (equivalente ao `MobileStatusBar` do `/orders`):
 * aparece em todas as abas e só no mobile.
 */
export function ManagementStatusBar({
  storeName,
  totalSold,
  sellerCount,
}: ManagementStatusBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/90 px-4 py-2 backdrop-blur sm:hidden">
      <p className="text-center text-xs font-semibold text-gray-600">
        {storeName ?? 'Sem loja'}
        {totalSold !== null ? ` · ${formatCurrency(totalSold)}` : ''}
        {sellerCount > 0 ? ` · ${sellerCount} vendedor(es)` : ''}
      </p>
    </div>
  )
}
