import { useEffect, useState } from 'react'
import {
  applyUpdate,
  subscribePWA,
  dismissUpdate,
  dismissOfflineReady,
} from '../pwa'
import type { PWAStatus } from '../pwa'

export function PwaUpdatePrompt() {
  const [status, setStatus] = useState<PWAStatus>({
    needsRefresh: false,
    offlineReady: false,
  })

  useEffect(() => subscribePWA(setStatus), [])

  if (!status.needsRefresh && !status.offlineReady) return null

  if (status.needsRefresh) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-wine-700 px-4 py-3 text-sm font-semibold text-white shadow-lg"
      >
        <span>Nova versão disponível</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dismissUpdate()}
            className="rounded-lg px-2 py-1 text-xs text-white/70 transition hover:text-white"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={() => applyUpdate()}
            className="rounded-lg bg-[#FECB1A] px-3 py-1 text-xs font-bold text-wine-800 transition hover:brightness-95"
          >
            Atualizar
          </button>
        </span>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 max-w-xs rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        Pronto para uso offline.
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => dismissOfflineReady()}
          className="ml-2 text-white/70 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}