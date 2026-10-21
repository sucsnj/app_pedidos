import { useState } from 'react'
import { Check, Eraser, Link2, Pencil, UserPlus, UserX, X } from 'lucide-react'
import type { Seller } from '../types/database'
import { formatCurrency, parseNumberOrNull } from '../lib/utils'
import { inputClass } from './ui'
import { CollapsibleCard } from './CollapsibleCard'

interface SalesSellersCardProps {
  sellers: Seller[]
  values: Record<string, string>
  saving: boolean
  onAdd: (name: string) => Promise<boolean>
  onRename: (id: string, name: string) => Promise<boolean>
  onBind: (id: string) => Promise<boolean>
  onRemove: (id: string) => Promise<void>
  onValueChange: (sellerId: string, value: string) => void
  onClearValues: () => void
}

export function SalesSellersCard({
  sellers,
  values,
  saving,
  onAdd,
  onRename,
  onBind,
  onRemove,
  onValueChange,
  onClearValues,
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

  const handleRemove = async (seller: Seller) => {
    const confirmed = window.confirm(
      `Desativar o vendedor "${seller.name}"? Ele deixa de aparecer na lista, mas o histórico e os lançamentos já registrados são preservados.`,
    )
    if (!confirmed) return
    await onRemove(seller.id)
  }

  return (
    <CollapsibleCard
      storageKey="management-vendedores"
      title="Vendedores"
      subtitle="Cadastrados no banco e vinculados à loja selecionada — informe o valor vendido no período."
      icon={<UserPlus className="h-5 w-5" />}
      badge={
        <span className="text-xs text-gray-500">{sellers.length} cadastrado(s)</span>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:max-w-2xl">
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
        <>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">
              {sellers.length} vendedor(es) · valores do período
            </span>
            <button
              type="button"
              onClick={onClearValues}
              disabled={Object.keys(values).length === 0}
              aria-label="Limpar valores dos vendedores"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 active:scale-95 disabled:opacity-40"
            >
              <Eraser className="h-3.5 w-3.5" /> Limpar valores
            </button>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {sellers.map((seller) => {
              const raw = values[seller.id] ?? ''
              const parsed = parseNumberOrNull(raw)
              const invalid = raw.trim() !== '' && (parsed === null || parsed < 0)
              const isEditing = editingId === seller.id
              return (
                <li
                  key={seller.id}
                  className="min-w-0 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1">
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
                          className={`${inputClass} min-w-0 flex-1`}
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
                      <>
                        <p className="min-w-0 truncate text-sm font-medium text-gray-800">
                          {seller.name}
                        </p>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(seller)}
                            disabled={saving}
                            aria-label={`Editar ${seller.name}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-wine-700 active:scale-95 disabled:opacity-30"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(seller)}
                    disabled={saving}
                    aria-label={`Desativar ${seller.name}`}
                    title="Desativar vendedor (histórico preservado)"
                    className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-gray-500 transition hover:bg-amber-50 hover:text-amber-700 active:scale-95 disabled:opacity-30"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                        </div>
                      </>
                    )}
                  </div>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={raw}
                    onChange={(event) => onValueChange(seller.id, event.target.value)}
                    placeholder="Valor (0,00)"
                    aria-label={`Valor de ${seller.name}`}
                    className={`${inputClass} mt-2 text-right tabular-nums ${
                      invalid ? 'border-red-400 focus:border-red-500' : ''
                    }`}
                  />
                  {invalid ? (
                    <p className="text-xs font-medium text-red-600">
                      {parsed === null
                        ? 'Valor inválido — use números (ex.: 3289,49).'
                        : 'O valor não pode ser negativo.'}
                    </p>
                  ) : parsed === 0 ? (
                    <p className="text-xs font-medium text-amber-600">
                      {raw.trim() === ''
                        ? 'Sem valor informado — assumido como R$ 0,00.'
                        : 'R$ 0,00 — sem vendas no período.'}
                    </p>
                  ) : parsed !== null ? (
                    <p className="text-xs text-gray-500">Valor lido: {formatCurrency(parsed)}</p>
                  ) : null}

                  {seller.store_id ? null : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                        sem loja
                      </span>
                      <button
                        type="button"
                        onClick={() => void onBind(seller.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-md bg-wine-50 px-1.5 py-0.5 text-[11px] font-bold text-wine-700 transition hover:bg-wine-100 active:scale-95 disabled:opacity-40"
                      >
                        <Link2 className="h-3 w-3" /> Vincular a esta loja
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </CollapsibleCard>
  )
}
