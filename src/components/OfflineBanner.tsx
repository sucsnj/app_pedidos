import { useOnline } from '../hooks/useOnline'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="bg-amber-400/90 px-4 py-2 text-center text-xs font-semibold text-amber-950">
      Sem conexão — as alterações serão sincronizadas quando houver rede.
    </div>
  )
}