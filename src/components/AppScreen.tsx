import { RefreshCw } from 'lucide-react'
import { Spinner } from './ui'

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-wine-700">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-semibold">Carregando catálogo...</p>
    </div>
  )
}

export function ErrorScreen({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-wine-700">Não foi possível carregar o app.</p>
      <p className="max-w-md text-xs text-gray-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-wine-600"
      >
        <RefreshCw className="h-4 w-4" /> Tentar novamente
      </button>
    </div>
  )
}