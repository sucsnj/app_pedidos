import { Eraser, Save } from 'lucide-react'

interface SalesActionsProps {
  canRegister: boolean
  hasAnyValue: boolean
  saving: boolean
  onRegister: () => void
  onClear: () => void
  /** `dark` para a barra vinho (topo), `light` para cards brancos. */
  tone?: 'dark' | 'light'
  className?: string
}

/**
 * Par de ações do lançamento de vendas — usado em dois pontos da tela
 * (ao lado do seletor de loja e dentro de "Detalhamento por vendedor").
 */
export function SalesActions({
  canRegister,
  hasAnyValue,
  saving,
  onRegister,
  onClear,
  tone = 'light',
  className = '',
}: SalesActionsProps) {
  const primary =
    tone === 'dark'
      ? 'bg-gold-400 text-wine-800 hover:bg-gold-500'
      : 'bg-wine-500 text-white hover:bg-wine-600'
  const secondary =
    tone === 'dark'
      ? 'bg-white/10 text-white hover:bg-white/20'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onRegister}
        disabled={saving || !canRegister}
        title={
          canRegister
            ? 'Registrar o lançamento no histórico'
            : 'Informe o valor de ao menos um vendedor para registrar'
        }
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${primary}`}
      >
        <Save className="h-4 w-4" /> Registrar vendas
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={saving || !hasAnyValue}
        title="Limpar os valores digitados e começar um novo lançamento"
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${secondary}`}
      >
        <Eraser className="h-4 w-4" /> Novas vendas
      </button>
    </div>
  )
}
