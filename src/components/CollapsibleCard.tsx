import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { readCardState, writeCardState } from '../lib/cardState'

export type CardAccent = 'wine' | 'gold' | 'sky' | 'emerald' | 'neutral'

const ACCENT_STYLES: Record<CardAccent, { bar: string; chip: string }> = {
  wine: { bar: 'bg-wine-600', chip: 'bg-wine-100 text-wine-700' },
  gold: { bar: 'bg-gold-400', chip: 'bg-gold-100 text-wine-800' },
  sky: { bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700' },
  emerald: { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  neutral: { bar: 'bg-gray-300', chip: 'bg-gray-100 text-gray-600' },
}

interface CollapsibleCardProps {
  storageKey: string
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: ReactNode
  accent?: CardAccent
  /** Ao mudar, o card abre e rola suavemente até ele. */
  revealSignal?: number
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
  accent = 'neutral',
  revealSignal,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(() => readCardState(storageKey, defaultOpen))
  const styles = ACCENT_STYLES[accent]
  const lastSignal = useRef(revealSignal)

  const toggle = useCallback(() => {
    const next = !open
    setOpen(next)
    writeCardState(storageKey, next)
  }, [open, storageKey])

  const reveal = useCallback(() => {
    setOpen(true)
    writeCardState(storageKey, true)
    const element = document.getElementById(storageKey)
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [storageKey])

  useEffect(() => {
    if (revealSignal === undefined || revealSignal === lastSignal.current) return
    lastSignal.current = revealSignal
    reveal()
  }, [revealSignal, reveal])

  return (
    <section
      id={storageKey}
      className="scroll-mt-16 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <div className={`h-1 w-full ${styles.bar}`} />
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${open ? 'Recolher' : 'Expandir'} ${title}`}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-gray-50 active:bg-gray-100"
      >
        {icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.chip}`}
          >
            {icon}
          </span>
        ) : null}
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
