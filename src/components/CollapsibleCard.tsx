import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

const STORAGE_PREFIX = 'pedidos:card:'

export function readCardState(storageKey: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey)
    if (raw === null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

function writeCardState(storageKey: string, open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, open ? '1' : '0')
  } catch {
    // Sem storage disponível (modo privado) — segue sem persistir.
  }
}

interface CollapsibleCardProps {
  storageKey: string
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Card expansível/colapsável que guarda o último estado no navegador
 * (`localStorage`, chave `pedidos:card:<storageKey>`).
 */
export function CollapsibleCard({
  storageKey,
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(() => readCardState(storageKey, defaultOpen))

  const toggle = useCallback(() => {
    const next = !open
    setOpen(next)
    writeCardState(storageKey, next)
  }, [open, storageKey])

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${open ? 'Recolher' : 'Expandir'} ${title}`}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-gray-50 active:bg-gray-100"
      >
        {icon ? <span className="shrink-0 text-wine-600">{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-800">{title}</span>
          {subtitle ? <span className="block truncate text-xs text-gray-500">{subtitle}</span> : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? '' : '-rotate-90'
          }`}
        />
      </button>
      {open ? <div className="border-t border-gray-100 p-4">{children}</div> : null}
    </section>
  )
}
