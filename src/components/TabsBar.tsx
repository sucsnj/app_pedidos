import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { barClass } from './ui'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  short: string
  icon: LucideIcon
}

interface TabsBarProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  renderTabExtra?: (id: T) => ReactNode
}

/** Barra de abas reutilizável (mesma linguagem visual das abas do `/orders`). */
export function TabsBar<T extends string>({
  tabs,
  active,
  onChange,
  renderTabExtra,
}: TabsBarProps<T>) {
  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-shell/95 backdrop-blur">
      <div className={`${barClass} flex items-center gap-1.5 py-2`}>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((entry) => (
            <Fragment key={entry.id}>
              <button
                type="button"
                onClick={() => onChange(entry.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  active === entry.id
                    ? 'bg-wine-700 text-gold-300 shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-wine-700'
                }`}
              >
                <entry.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{entry.label}</span>
                <span className="sm:hidden">{entry.short}</span>
              </button>
              {renderTabExtra?.(entry.id)}
            </Fragment>
          ))}
        </div>
      </div>
    </nav>
  )
}
