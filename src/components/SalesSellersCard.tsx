import { useState } from 'react'
import { Check, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import type { Seller } from '../types/database'
import { formatCurrency, parseNumberOrNull } from '../lib/utils'
import { inputClass } from './ui'

interface SalesSellersCardProps {
  sellers: Seller[]
  values: Record<string, string>
  saving: boolean
  onAdd: (name: string) => Promise<boolean>
  onRename: (id: string, name: string) => Promise<boolean>
  onRemove: (id: string) => Promise<void>
  onValueChange: (sellerId: string, value: string) => void
}

export function SalesSellersCard({
  sellers,
  values,
  saving,
  onAdd,
  onRename,
  onRemove,
  onValueChange,
}: SalesSellersCardProps) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleAdd = async () => {
    const added = await onAdd(name)
    if (added) setName('')
  }

  const startEdit = (seller: Seller) => {
    setEditingId(seller.id)
    setEditingName(seller.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const saved = await onRename(editingId, editingName)
    if (saved) cancelEdit()
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-bold text-gray-800">Vendedores</p>
        <p className="text-xs text-gray-500">
          Cadastrados no banco. Informe o valor vendido no período ao lado de cada nome.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleAdd()
            }
          }}
          placeholder="Nome do novo vendedor"
          aria-label="Nome do novo vendedor"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
        >
          <UserPlus className="h-4 w-4" /> Cadastrar vendedor
        </button>
      </div>

      {sellers.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          Nenhum vendedor cadastrado. Cadastre acima para começar o lançamento.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sellers.map((seller) => {
            const raw = values[seller.id] ?? ''
            const parsed = parseNumberOrNull(raw)
            const invalid = raw.trim() !== '' && (parsed === null || parsed < 0)
            return (
              <li key={seller.id} className="space-y-1">
                <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_160px_40px_40px]">
                  {editingId === seller.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void saveEdit()
                          }
                          if (event.key === 'Escape') cancelEdit()
                        }}
                        aria-label={`Editar nome de ${seller.name}`}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={saving}
                        aria-label="Salvar nome"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wine-500 text-white transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancelar edição"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 active:scale-95"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                      {seller.name}
                    </span>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={raw}
                    onChange={(event) => onValueChange(seller.id, event.target.value)}
                    placeholder="Valor (0,00)"
                    aria-label={`Valor de ${seller.name}`}
                    className={`${inputClass} text-right tabular-nums ${
                      invalid ? 'border-red-400 focus:border-red-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => startEdit(seller)}
                    disabled={saving}
                    aria-label={`Editar ${seller.name}`}
                    className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-wine-700 active:scale-95 disabled:opacity-30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemove(seller.id)}
                    disabled={saving}
                    aria-label={`Remover ${seller.name}`}
                    className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {invalid ? (
                  <p className="text-xs font-medium text-red-600">
                    {parsed === null
                      ? 'Valor inválido — use números (ex.: 3289,49).'
                      : 'O valor não pode ser negativo.'}
                  </p>
                ) : parsed !== null ? (
                  <p className="text-xs text-gray-500">Valor lido: {formatCurrency(parsed)}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
