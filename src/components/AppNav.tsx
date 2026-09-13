import { BarChart3, CheckCircle2, ClipboardList, MonitorCheck, Package } from 'lucide-react'
import type { TabId } from '../types/app'
import { Spinner } from './ui'

interface AppNavProps {
  tab: TabId
  canFinish: boolean
  finishing: boolean
  totalCounted: number
  onTabChange: (tab: TabId) => void
  onFinish: () => void
}

const tabs: Array<{ id: TabId; label: string; short: string; icon: typeof ClipboardList }> = [
  { id: 'count', label: 'Contagem (Prancheta)', short: 'Contagem', icon: ClipboardList },
  { id: 'entry', label: 'Modo Digitação', short: 'Digitação', icon: MonitorCheck },
  { id: 'catalog', label: 'Cadastro & Produtos', short: 'Cadastro', icon: Package },
  { id: 'comparativo', label: 'Comparativo', short: 'Comparativo', icon: BarChart3 },
]

export function AppNav({
  tab,
  canFinish,
  finishing,
  totalCounted,
  onTabChange,
  onFinish,
}: AppNavProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-shell/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 py-2">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((entry) => {
            const active = tab === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onTabChange(entry.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  active
                    ? 'bg-wine-700 text-gold-300 shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-wine-700'
                }`}
              >
                <entry.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{entry.label}</span>
                <span className="sm:hidden">{entry.short}</span>
              </button>
            )
          })}
        </div>
        {canFinish ? (
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
        ) : null}
      </div>
    </nav>
  )
}
