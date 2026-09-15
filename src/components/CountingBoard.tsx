import { useState } from 'react'
import { Minus, Plus, Save, Check, ChevronDown, Search, ShoppingCart } from 'lucide-react'
import type { Category, OrderStatus, Product, ProductVariation } from '../types/database'
import type { CountedItem, ItemKey, LastOrderData, SuggestionsMap } from '../types/app'
import { itemKey, defaultVariationForProduct } from '../types/app'
import { formatDateTime } from '../lib/utils'
import { Spinner, inputClass } from './ui'

interface CountingBoardProps {
  storeName: string
  categories: Category[]
  products: Product[]
  variations: ProductVariation[]
  items: CountedItem[]
  suggestions: SuggestionsMap
  requesterName: string
  notes: string
  orderStatus: OrderStatus | null
  saving: boolean
  savedAt: Date | null
  lastOrder: LastOrderData | null
  onRequesterNameChange: (value: string) => void
  onNotesChange: (value: string) => void
  onAdjust: (key: ItemKey, delta: number) => void
  onSetQuantity: (key: ItemKey, value: number) => void
  onSaveNow: () => void
}

export function CountingBoard({
  storeName,
  categories,
  products,
  variations,
  items,
  suggestions,
  requesterName,
  notes,
  orderStatus,
  saving,
  savedAt,
  lastOrder,
  onRequesterNameChange,
  onNotesChange,
  onAdjust,
  onSetQuantity,
  onSaveNow,
}: CountingBoardProps) {
  const locked = orderStatus !== null && orderStatus !== 'Rascunho'
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')

  const normalizedSearch = search.trim().toLowerCase()
  const matchesSearch = (product: Product) => {
    if (!normalizedSearch) return true
    return (
      product.name.toLowerCase().includes(normalizedSearch) ||
      (product.code?.toLowerCase().includes(normalizedSearch) ?? false)
    )
  }

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((previous) => {
      const next = new Set(previous)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const itemsByKey = new Map(items.map((item) => [item.key, item]))
  const lastByKey = new Map(
    (lastOrder?.items ?? []).map((item) => [item.key, item.quantity] as const),
  )
  const totalCounted = items.reduce((sum, item) => sum + item.quantity, 0)

  const updateQuantity = (key: ItemKey, value: number, isAbsolute = false) => {
    if (isAbsolute) onSetQuantity(key, value)
    else onAdjust(key, value)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-wine-600" />
            <div>
              <p className="text-sm font-bold leading-tight text-gray-800">
                {storeName || 'Nenhuma loja selecionada'}
              </p>
              <p className="text-xs text-gray-500">
                {totalCounted} unidade(s) contada(s) ·{' '}
                {orderStatus ? orderStatus : 'Sem pedido ativo'}
                {lastOrder && lastOrder.totalItems > 0
                  ? ` · Último concluído: ${lastOrder.totalItems} un`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wine-100 px-3 py-1 text-xs font-semibold text-wine-700">
                <Spinner className="h-3.5 w-3.5" /> Salvando...
              </span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                <Check className="h-3.5 w-3.5" /> Salvo {formatDateTime(savedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nome do solicitante
            </span>
            <input
              type="text"
              value={requesterName}
              onChange={(event) => onRequesterNameChange(event.target.value)}
              disabled={locked}
              placeholder="Ex.: Supervisor de Loja"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Observações
            </span>
            <input
              type="text"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              disabled={locked}
              placeholder="Opcional"
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={locked}
              placeholder="Buscar por nome ou código"
              className={`${inputClass} pl-9`}
            />
          </div>
          <button
            type="button"
            onClick={onSaveNow}
            disabled={locked || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-wine-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> Salvar rascunho
          </button>
          {locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-500">
              Contagem concluída — use o Modo Digitação
            </span>
          ) : null}
        </div>
      </section>

      {categories.map((category) => {
        const categoryProducts = products
          .filter((product) => product.category_id === category.id)
          .filter(matchesSearch)
        if (categoryProducts.length === 0) return null

        return (
          <section key={category.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="flex w-full items-center gap-2 bg-wine-700 px-4 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-white transition hover:bg-wine-800 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gold-300 transition-transform ${
                  collapsedCategories.has(category.id) ? '-rotate-90' : ''
                }`}
              />
            </button>
            {collapsedCategories.has(category.id) ? null : (
              <div className="divide-y divide-gray-100">
                  {categoryProducts.map((product) => {
                const productVariations = variations.filter(
                  (variation) => variation.product_id === product.id,
                )
                const visibleVariations =
                  productVariations.length > 0
                    ? productVariations
                    : [defaultVariationForProduct(product)]

                return (
                  <div key={product.id} className="px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-base font-semibold text-gray-800">
                        {product.name}
                      </p>
                      {product.code ? (
                        <span className="rounded-md bg-wine-100 px-2 py-0.5 font-mono text-xs font-semibold text-wine-700">
                          {product.code}
                        </span>
                      ) : null}
                      {product.unit_type ? (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {product.unit_type}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {visibleVariations.map((variation) => {
                        const key = itemKey(product.id, variation.id)
                        const counted = itemsByKey.get(key)?.quantity ?? 0
                        const available = variation.is_available && product.is_active
                        const suggestion = suggestions.get(key)
                        const lastQty = lastByKey.get(key) ?? 0
                        const aboveUsual = !locked && lastQty > 0 && counted > lastQty * 2

                        return (
                          <div
                            key={variation.id}
                            role="button"
                            tabIndex={available && !locked ? 0 : -1}
                            onClick={() => {
                              if (available && !locked) onAdjust(key, 1)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                if (available && !locked) onAdjust(key, 1)
                              }
                            }}
                            className={`flex touch-manipulation items-center gap-3 rounded-2xl border p-3 transition select-none ${
                              available
                                ? 'cursor-pointer border-gray-200 bg-white shadow-sm hover:border-wine-300 active:scale-[0.99]'
                                : 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60'
                            } ${locked && counted > 0 ? 'bg-wine-100/50' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold text-gray-800">
                                {variation.name}
                              </p>
                              <p className="truncate text-xs text-gray-500">
                                {[variation.weight_label, variation.sku_code ? `SKU ${variation.sku_code}` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                              {lastQty > 0 ? (
                                <span className="mt-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                                  Último: {lastQty} un
                                </span>
                              ) : null}
                              {aboveUsual ? (
                                <span className="mt-1 inline-flex items-center rounded-md bg-gold-200 px-1.5 py-0.5 text-[11px] font-bold text-wine-800">
                                  ⚠️ Acima do habitual
                                </span>
                              ) : null}
                              {counted === 0 && !locked && suggestion && suggestion > 0 ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onSetQuantity(key, suggestion)
                                  }}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 inline-flex items-center rounded-md bg-wine-50 px-1.5 py-0.5 text-xs font-semibold text-wine-600 transition hover:bg-wine-100 active:scale-95"
                                >
                                  Sugestão: {suggestion}
                                </button>
                              ) : null}
                              {!available ? (
                                <p className="text-xs italic text-gray-400">Indisponível</p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Diminuir ${variation.name}`}
                                disabled={!available || locked || counted === 0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  updateQuantity(key, -1)
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-700 transition hover:bg-gray-300 active:scale-90 disabled:opacity-30"
                              >
                                <Minus className="h-6 w-6" strokeWidth={3} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={counted > 0 ? String(counted) : ''}
                                placeholder="0"
                                onChange={(event) => {
                                  const parsed = parseInt(event.target.value, 10)
                                  updateQuantity(key, Number.isNaN(parsed) ? 0 : parsed, true)
                                }}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                disabled={!available || locked}
                                aria-label={`Quantidade de ${variation.name}`}
                                className={`h-11 w-14 shrink-0 rounded-xl px-1 text-center text-xl font-extrabold tabular-nums outline-none transition focus:ring-2 focus:ring-wine-300 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                  counted > 0
                                    ? 'bg-wine-500 text-white'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              />
                              <button
                                type="button"
                                aria-label={`Aumentar ${variation.name}`}
                                disabled={!available || locked}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  updateQuantity(key, 1)
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-wine-800 transition hover:bg-gold-500 active:scale-90 disabled:opacity-40"
                              >
                                <Plus className="h-6 w-6" strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            )}
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              aria-expanded={!collapsedCategories.has(category.id)}
              className="flex w-full items-center gap-2 cursor-pointer border-t border-wine-200 bg-wine-50/60 px-4 py-1.5 text-left transition hover:bg-wine-100 active:bg-wine-200"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wider text-wine-600">
                {category.name}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-wine-400 transition-transform ${
                  collapsedCategories.has(category.id) ? '' : 'rotate-180'
                }`}
              />
            </button>
          </section>
        )
      })}

      {items.length === 0 && (
        <p className="text-center text-sm text-gray-400">
          Nenhuma contagem ainda. Toque em “+” para adicionar produtos.
        </p>
      )}
    </div>
  )
}