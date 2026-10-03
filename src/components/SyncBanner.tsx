interface SyncBannerProps {
  pending: number
  syncing: boolean
  onSync: () => void
}

export function SyncBanner({ pending, syncing, onSync }: SyncBannerProps) {
  if (pending <= 0) return null
  const label =
    pending === 1
      ? '1 alteração aguardando sincronização.'
      : `${pending} alterações aguardando sincronização.`
  return (
    <div className="flex items-center justify-between gap-2 bg-blue-500/90 px-4 py-2 text-xs font-semibold text-white">
      <span>{label}</span>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="rounded-full bg-white/20 px-3 py-1 font-bold hover:bg-white/30 disabled:opacity-60"
      >
        {syncing ? 'Sincronizando…' : 'Sincronizar'}
      </button>
    </div>
  )
}