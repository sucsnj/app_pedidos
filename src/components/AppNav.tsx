import { CheckCircle2, ClipboardList, MonitorCheck, Package, BarChart3 } from 'lucide-react'
import type { TabId } from '../types/app'
import { Spinner } from './ui'
import { TabsBar } from './TabsBar'
import type { TabItem } from './TabsBar'

const tabs: TabItem<TabId>[] = [
  { id: 'count', label: 'Contagem (Prancheta)', short: 'Contagem', icon: ClipboardList },
  { id: 'entry', label: 'Modo Digitação', short: 'Digitação', icon: MonitorCheck },
  { id: 'catalog', label: 'Cadastro & Produtos', short: 'Cadastro', icon: Package },
  { id: 'comparativo', label: 'Comparativo', short: 'Comparativo', icon: BarChart3 },
]

interface AppNavProps {
  tab: TabId
  canFinish: boolean
  finishing: boolean
  totalCounted: number
  showCatalog: boolean
  showComparativo: boolean
  onTabChange: (tab: TabId) => void
  onFinish: () => void
}

export function AppNav({
  tab,
  canFinish,
  finishing,
  totalCounted,
  showCatalog,
  showComparativo,
  onTabChange,
  onFinish,
}: AppNavProps) {
  const visibleTabs = tabs.filter((entry) => {
    if (entry.id === 'catalog') return showCatalog
    if (entry.id === 'comparativo') return showComparativo
    return true
  })

  return (
    <TabsBar
      tabs={visibleTabs}
      active={tab}
      onChange={onTabChange}
      renderTabExtra={(id) =>
        id === 'count' && canFinish ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing || totalCounted === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gold-400 px-3 py-2 text-sm font-bold text-wine-800 shadow-sm transition hover:bg-gold-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {finishing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Concluir Pedido</span>
            <span className="sm:hidden">Concluir</span>
          </button>
        ) : null
      }
    />
  )
}
