import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ClipboardList, LogOut } from 'lucide-react'
import { APP_SECTIONS } from '../lib/sections'
import { barClass } from './ui'

interface TopNavProps {
  userName: string
  isAdmin: boolean
  onSignOut: () => void
}

export function TopNav({ userName, isAdmin, onSignOut }: TopNavProps) {
  const [showUserName, setShowUserName] = useState(false)

  useEffect(() => {
    if (!showUserName) return
    const timer = window.setTimeout(() => setShowUserName(false), 2500)
    return () => window.clearTimeout(timer)
  }, [showUserName])

  return (
    <header className="bg-wine-700 text-white shadow-md">
      <div className={`${barClass} flex flex-col gap-2.5 py-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400">
              <ClipboardList className="h-5 w-5 text-wine-800" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-extrabold leading-tight sm:text-sm">
                Pedidos & Abastecimento
              </h1>
              <p className="hidden text-[11px] text-gold-300 sm:block">
                Contagem física · Prancheta digital
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserName((previous) => !previous)}
                className="max-w-[90px] truncate text-xs font-semibold text-gold-300 sm:max-w-[260px]"
              >
                {userName}
              </button>
              {showUserName ? (
                <div className="absolute right-0 top-full z-30 mt-2 max-w-[70vw] whitespace-normal rounded-lg bg-wine-900 px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/20">
                  {userName}
                </div>
              ) : null}
            </div>
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
              aria-label="Sair"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <nav
          aria-label="Seções do aplicativo"
          className="-mb-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {APP_SECTIONS.map((section) => (
            <NavLink
              key={section.path}
              to={section.path}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  isActive
                    ? 'bg-gold-400 text-wine-800 shadow-sm'
                    : 'bg-white/10 text-gold-200 hover:bg-white/20'
                }`
              }
            >
              <section.icon className="h-4 w-4" />
              {section.label}
              {section.ready ? null : (
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Em breve
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
