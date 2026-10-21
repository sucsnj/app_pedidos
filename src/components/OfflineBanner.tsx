import { useOnline } from '../hooks/useOnline'

const DEFAULT_MESSAGE = 'Sem conexão — as alterações serão sincronizadas quando houver rede.'

export function OfflineBanner({ message = DEFAULT_MESSAGE }: { message?: string }) {
  const online = useOnline()
  if (online) return null
  return (
    <div className="bg-amber-400/90 px-4 py-2 text-center text-xs font-semibold text-amber-950">
      {message}
    </div>
  )
}