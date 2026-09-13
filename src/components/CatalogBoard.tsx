import { useState } from 'react'
import { Store, Package, FolderTree, Shapes, Plus, Pencil, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  Category,
  Product,
  ProductVariation,
  Store as StoreRow,
} from '../types/database'
import type { Catalog } from '../types/app'
import { emptyText, getErrorMessage, parseNumber } from '../lib/utils'
import { Field, IconButton, inputClass, selectClass } from './ui'

export type FlashKind = 'success' | 'error' | 'info'

interface CatalogBoardProps {
  catalog: Catalog
  onRefresh: () => Promise<unknown>
  onFlash: (message: string, kind: FlashKind) => void
}

type Loadable = CatalogBoardProps

function Section({
  icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
        </div>
        <span className="rounded-full bg-wine-100 px-2.5 py-1 text-xs font-bold text-wine-700">
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
        checked
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-gray-300 bg-gray-50 text-gray-400'
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
          checked ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  )
}

function AddButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-wine-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-wine-600 active:scale-95 disabled:opacity-40"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

function actionError(error: unknown) {
  return getErrorMessage(error)
}

/* ------------------------------------------------------------------ */
/* Lojas                                                               */
/* ------------------------------------------------------------------ */

function StoresManager({ catalog, onRefresh, onFlash }: Loadable) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')

  const create = async () => {
    if (!emptyText(name)) return
    setBusy(true)
    try {
      await supabase.from('stores').insert({
        code: emptyText(code) || null,
        name: name.trim(),
        is_active: true,
      })
      setName('')
      setCode('')
      setOpen(false)
      await onRefresh()
      onFlash('Loja criada com sucesso.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (store: StoreRow) => {
    try {
      await supabase
        .from('stores')
        .update({ is_active: !store.is_active })
        .eq('id', store.id)
      await onRefresh()
      onFlash('Loja ' + (store.is_active ? 'desativada' : 'ativada') + '.', 'info')
    } catch (error) {
      onFlash(actionError(error), 'error')
    }
  }

  const startEdit = (store: StoreRow) => {
    setEditingId(store.id)
    setEditName(store.name)
    setEditCode(store.code ?? '')
  }

  const saveEdit = async () => {
    if (!editingId || !emptyText(editName)) return
    setBusy(true)
    try {
      await supabase
        .from('stores')
        .update({ name: editName.trim(), code: emptyText(editCode) || null })
        .eq('id', editingId)
      setEditingId(null)
      await onRefresh()
      onFlash('Loja atualizada.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      icon={<Store className="h-5 w-5 text-wine-600" />}
      title="Lojas / Filiais"
      subtitle="Locais que fazem pedidos"
      count={catalog.stores.length}
    >
      {open ? (
        <div className="mb-3 grid gap-2 rounded-xl border border-wine-200 bg-wine-100/40 p-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Nome da loja">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Filial Centro"
              autoFocus
            />
          </Field>
          <Field label="Código">
            <input
              className={inputClass}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ex.: 003"
            />
          </Field>
          <div className="flex items-end gap-1">
            <AddButton
              onClick={create}
              disabled={busy || !emptyText(name)}
              label={busy ? 'Salvando...' : 'Criar'}
            />
            <IconButton label="Cancelar" onClick={() => setOpen(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setOpen(true)} label="Nova loja" />
      )}

      <ul className="mt-3 space-y-2">
        {catalog.stores.map((store) => (
          <li
            key={store.id}
            className={`rounded-xl border p-3 ${
              store.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'
            }`}
          >
            {editingId === store.id ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <Field label="Nome">
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </Field>
                <Field label="Código">
                  <input
                    className={inputClass}
                    value={editCode}
                    onChange={(event) => setEditCode(event.target.value)}
                  />
                </Field>
                <div className="flex items-end gap-1">
                  <AddButton
                    onClick={saveEdit}
                    disabled={busy || !emptyText(editName)}
                    label="Salvar"
                  />
                  <IconButton label="Cancelar" onClick={() => setEditingId(null)} className="h-9 w-9">
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{store.name}</p>
                  <p className="text-xs text-gray-400">{store.code ?? 'sem código'}</p>
                </div>
                <Toggle
                  checked={store.is_active}
                  onChange={() => toggleActive(store)}
                  label={store.is_active ? 'Ativa' : 'Inativa'}
                />
                <IconButton label="Editar loja" onClick={() => startEdit(store)} className="h-9 w-9">
                  <Pencil className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */

function CategoriesManager({ catalog, onRefresh, onFlash }: Loadable) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [order, setOrder] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState('')

  const create = async () => {
    if (!emptyText(name)) return
    setBusy(true)
    try {
      const nextOrder =
        catalog.categories.length === 0
          ? 1
          : Math.max(...catalog.categories.map((category) => category.display_order)) + 1
      await supabase.from('categories').insert({
        name: name.trim(),
        display_order: parseNumber(order) || nextOrder,
      })
      setName('')
      setOrder('')
      setOpen(false)
      await onRefresh()
      onFlash('Categoria criada.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditName(category.name)
    setEditOrder(String(category.display_order))
  }

  const saveEdit = async () => {
    if (!editingId || !emptyText(editName)) return
    setBusy(true)
    try {
      await supabase
        .from('categories')
        .update({ name: editName.trim(), display_order: parseNumber(editOrder) })
        .eq('id', editingId)
      setEditingId(null)
      await onRefresh()
      onFlash('Categoria atualizada.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      icon={<FolderTree className="h-5 w-5 text-wine-600" />}
      title="Categorias"
      subtitle="Ordem de exibição na prancheta"
      count={catalog.categories.length}
    >
      {open ? (
        <div className="mb-3 grid gap-2 rounded-xl border border-wine-200 bg-wine-100/40 p-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Nome">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: TORTAS"
              autoFocus
            />
          </Field>
          <Field label="Ordem">
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              placeholder="Auto"
            />
          </Field>
          <div className="flex items-end gap-1">
            <AddButton
              onClick={create}
              disabled={busy || !emptyText(name)}
              label={busy ? 'Salvando...' : 'Criar'}
            />
            <IconButton label="Cancelar" onClick={() => setOpen(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setOpen(true)} label="Nova categoria" />
      )}

      <ul className="mt-3 space-y-2">
        {catalog.categories.map((category) => (
          <li key={category.id} className="rounded-xl border border-gray-200 bg-white p-3">
            {editingId === category.id ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <Field label="Nome">
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </Field>
                <Field label="Ordem">
                  <input
                    className={inputClass}
                    type="number"
                    inputMode="numeric"
                    value={editOrder}
                    onChange={(event) => setEditOrder(event.target.value)}
                  />
                </Field>
                <div className="flex items-end gap-1">
                  <AddButton
                    onClick={saveEdit}
                    disabled={busy || !emptyText(editName)}
                    label="Salvar"
                  />
                  <IconButton label="Cancelar" onClick={() => setEditingId(null)} className="h-9 w-9">
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{category.name}</p>
                  <p className="text-xs text-gray-400">Ordem {category.display_order}</p>
                </div>
                <IconButton
                  label="Editar categoria"
                  onClick={() => startEdit(category)}
                  className="h-9 w-9"
                >
                  <Pencil className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Produtos                                                            */
/* ------------------------------------------------------------------ */

function ProductsManager({ catalog, onRefresh, onFlash }: Loadable) {
  const [open, setOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [unitType, setUnitType] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<{
    category_id: string
    code: string
    name: string
    unit_type: string
  }>({ category_id: '', code: '', name: '', unit_type: '' })

  const usableCategories = catalog.categories
  const visibleProducts = catalog.products.filter(
    (product) => categoryFilter === 'all' || product.category_id === categoryFilter,
  )
  const categoryName = (id: string) =>
    catalog.categories.find((category) => category.id === id)?.name ?? 'Sem categoria'

  const create = async () => {
    if (!emptyText(name) || !categoryId) return
    setBusy(true)
    try {
      await supabase.from('products').insert({
        category_id: categoryId,
        code: emptyText(code) || null,
        name: name.trim(),
        unit_type: emptyText(unitType) || 'Unidade',
        is_active: true,
      })
      setName('')
      setCode('')
      setUnitType('')
      setOpen(false)
      await onRefresh()
      onFlash('Produto cadastrado.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (product: Product) => {
    try {
      await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
      await onRefresh()
      onFlash('Produto ' + (product.is_active ? 'desativado' : 'ativado') + '.', 'info')
    } catch (error) {
      onFlash(actionError(error), 'error')
    }
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditFields({
      category_id: product.category_id,
      code: product.code ?? '',
      name: product.name,
      unit_type: product.unit_type,
    })
  }

  const saveEdit = async () => {
    if (!editingId || !emptyText(editFields.name)) return
    setBusy(true)
    try {
      await supabase
        .from('products')
        .update({
          category_id: editFields.category_id,
          code: emptyText(editFields.code) || null,
          name: editFields.name.trim(),
          unit_type: emptyText(editFields.unit_type) || 'Unidade',
        })
        .eq('id', editingId)
      setEditingId(null)
      await onRefresh()
      onFlash('Produto atualizado.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      icon={<Package className="h-5 w-5 text-wine-600" />}
      title="Produtos"
      subtitle="PLU/SKU e unidade de venda"
      count={catalog.products.length}
    >
      {open ? (
        <div className="mb-3 space-y-2 rounded-xl border border-wine-200 bg-wine-100/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nome">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Bolo de Chocolate"
                autoFocus
              />
            </Field>
            <Field label="Código (PLU/SKU)">
              <input
                className={inputClass}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ex.: 4521"
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Categoria">
              <select
                className={selectClass}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Selecione...</option>
                {usableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unidade">
              <input
                className={inputClass}
                value={unitType}
                onChange={(event) => setUnitType(event.target.value)}
                placeholder="Ex.: Unidade, Kg, Cento"
                list="unit-types"
              />
            </Field>
          </div>
          <datalist id="unit-types">
            <option value="Unidade" />
            <option value="Kg" />
            <option value="Cento" />
            <option value="Caixa" />
          </datalist>
          <div className="flex items-center gap-1">
            <AddButton
              onClick={create}
              disabled={busy || !emptyText(name) || !categoryId}
              label={busy ? 'Salvando...' : 'Criar produto'}
            />
            <IconButton label="Cancelar" onClick={() => setOpen(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </IconButton>
            {usableCategories.length === 0 ? (
              <p className="text-xs text-gray-500">Crie uma categoria antes de cadastrar produtos.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setOpen(true)} label="Novo produto" disabled={usableCategories.length === 0} />
      )}

      {catalog.products.length > 0 ? (
        <div className="mt-3">
          <div className="mb-2">
            <select
              className={selectClass}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Todas as categorias</option>
              {catalog.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-2">
            {visibleProducts.map((product) => (
              <li
                key={product.id}
                className={`rounded-xl border p-3 ${
                  product.is_active
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-gray-50 opacity-70'
                }`}
              >
                {editingId === product.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Nome">
                        <input
                          className={inputClass}
                          value={editFields.name}
                          onChange={(event) =>
                            setEditFields((previous) => ({ ...previous, name: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Código">
                        <input
                          className={inputClass}
                          value={editFields.code}
                          onChange={(event) =>
                            setEditFields((previous) => ({ ...previous, code: event.target.value }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Categoria">
                        <select
                          className={selectClass}
                          value={editFields.category_id}
                          onChange={(event) =>
                            setEditFields((previous) => ({
                              ...previous,
                              category_id: event.target.value,
                            }))
                          }
                        >
                          {catalog.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Unidade">
                        <input
                          className={inputClass}
                          value={editFields.unit_type}
                          onChange={(event) =>
                            setEditFields((previous) => ({
                              ...previous,
                              unit_type: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="flex items-center gap-1">
                      <AddButton
                        onClick={saveEdit}
                        disabled={busy || !emptyText(editFields.name)}
                        label="Salvar"
                      />
                      <IconButton label="Cancelar" onClick={() => setEditingId(null)} className="h-9 w-9">
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{product.name}</p>
                      <p className="truncate text-xs text-gray-400">
                        {categoryName(product.category_id)} · {product.unit_type}
                        {product.code ? ' · ' + product.code : ''}
                      </p>
                    </div>
                    <Toggle
                      checked={product.is_active}
                      onChange={() => toggleActive(product)}
                      label={product.is_active ? 'Ativo' : 'Inativo'}
                    />
                    <IconButton label="Editar produto" onClick={() => startEdit(product)} className="h-9 w-9">
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400">Nenhum produto cadastrado ainda.</p>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Variações / Pesos                                                   */
/* ------------------------------------------------------------------ */

function VariationsManager({ catalog, onRefresh, onFlash }: Loadable) {
  const [open, setOpen] = useState(false)
  const [productFilter, setProductFilter] = useState('all')
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [weightLabel, setWeightLabel] = useState('')
  const [skuCode, setSkuCode] = useState('')
  const [price, setPrice] = useState('')
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<{
    name: string
    weight_label: string
    sku_code: string
    price: string
    is_available: boolean
  }>({ name: '', weight_label: '', sku_code: '', price: '', is_available: true })

  const usableProducts = catalog.products.filter((product) => product.is_active)
  const visibleVariations = catalog.variations.filter(
    (variation) => productFilter === 'all' || variation.product_id === productFilter,
  )
  const productName = (id: string) =>
    catalog.products.find((product) => product.id === id)?.name ?? 'Sem produto'

  const create = async () => {
    if (!emptyText(name) || !productId) return
    setBusy(true)
    try {
      await supabase.from('product_variations').insert({
        product_id: productId,
        name: name.trim(),
        weight_label: emptyText(weightLabel) || null,
        sku_code: emptyText(skuCode) || null,
        price: parseNumber(price),
        is_available: available,
      })
      setName('')
      setWeightLabel('')
      setSkuCode('')
      setPrice('')
      setAvailable(true)
      setOpen(false)
      await onRefresh()
      onFlash('Variação cadastrada.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleAvailable = async (variation: ProductVariation) => {
    try {
      await supabase
        .from('product_variations')
        .update({ is_available: !variation.is_available })
        .eq('id', variation.id)
      await onRefresh()
      onFlash('Variação ' + (variation.is_available ? 'indisponível' : 'disponível') + '.', 'info')
    } catch (error) {
      onFlash(actionError(error), 'error')
    }
  }

  const startEdit = (variation: ProductVariation) => {
    setEditingId(variation.id)
    setEditFields({
      name: variation.name,
      weight_label: variation.weight_label ?? '',
      sku_code: variation.sku_code ?? '',
      price: String(variation.price),
      is_available: variation.is_available,
    })
  }

  const saveEdit = async () => {
    if (!editingId || !emptyText(editFields.name)) return
    setBusy(true)
    try {
      await supabase
        .from('product_variations')
        .update({
          name: editFields.name.trim(),
          weight_label: emptyText(editFields.weight_label) || null,
          sku_code: emptyText(editFields.sku_code) || null,
          price: parseNumber(editFields.price),
          is_available: editFields.is_available,
        })
        .eq('id', editingId)
      setEditingId(null)
      await onRefresh()
      onFlash('Variação atualizada.', 'success')
    } catch (error) {
      onFlash(actionError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      icon={<Shapes className="h-5 w-5 text-wine-600" />}
      title="Variações / Pesos"
      subtitle="Combinações de cada produto"
      count={catalog.variations.length}
    >
      {open ? (
        <div className="mb-3 space-y-2 rounded-xl border border-wine-200 bg-wine-100/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Produto">
              <select
                className={selectClass}
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                <option value="">Selecione...</option>
                {usableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: P 1.6kg"
                autoFocus
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Peso/Etiqueta">
              <input
                className={inputClass}
                value={weightLabel}
                onChange={(event) => setWeightLabel(event.target.value)}
                placeholder="Ex.: 1.6kg"
              />
            </Field>
            <Field label="SKU">
              <input
                className={inputClass}
                value={skuCode}
                onChange={(event) => setSkuCode(event.target.value)}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Preço">
              <input
                className={inputClass}
                type="number"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddButton
              onClick={create}
              disabled={busy || !emptyText(name) || !productId}
              label={busy ? 'Salvando...' : 'Criar variação'}
            />
            <IconButton label="Cancelar" onClick={() => setOpen(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </IconButton>
            <Toggle checked={available} onChange={setAvailable} label="Disponível" />
            {usableProducts.length === 0 ? (
              <p className="text-xs text-gray-500">Cadastre um produto antes de criar variações.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setOpen(true)} label="Nova variação" disabled={usableProducts.length === 0} />
      )}

      {catalog.variations.length > 0 ? (
        <div className="mt-3">
          <div className="mb-2">
            <select
              className={selectClass}
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="all">Todos os produtos</option>
              {catalog.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-2">
            {visibleVariations.map((variation) => (
              <li
                key={variation.id}
                className={`rounded-xl border p-3 ${
                  variation.is_available
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-gray-50 opacity-70'
                }`}
              >
                {editingId === variation.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Nome">
                        <input
                          className={inputClass}
                          value={editFields.name}
                          onChange={(event) =>
                            setEditFields((previous) => ({ ...previous, name: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Peso/Etiqueta">
                        <input
                          className={inputClass}
                          value={editFields.weight_label}
                          onChange={(event) =>
                            setEditFields((previous) => ({
                              ...previous,
                              weight_label: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="SKU">
                        <input
                          className={inputClass}
                          value={editFields.sku_code}
                          onChange={(event) =>
                            setEditFields((previous) => ({
                              ...previous,
                              sku_code: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Preço">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={editFields.price}
                          onChange={(event) =>
                            setEditFields((previous) => ({
                              ...previous,
                              price: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AddButton
                        onClick={saveEdit}
                        disabled={busy || !emptyText(editFields.name)}
                        label="Salvar"
                      />
                      <IconButton label="Cancelar" onClick={() => setEditingId(null)} className="h-9 w-9">
                        <X className="h-4 w-4" />
                      </IconButton>
                      <Toggle
                        checked={editFields.is_available}
                        onChange={(checked) =>
                          setEditFields((previous) => ({ ...previous, is_available: checked }))
                        }
                        label="Disponível"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {variation.name}
                        {variation.weight_label ? ' (' + variation.weight_label + ')' : ''}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {productName(variation.product_id)}
                        {variation.sku_code ? ' · SKU ' + variation.sku_code : ''}
                        {' · R$ ' + variation.price.toFixed(2)}
                      </p>
                    </div>
                    <Toggle
                      checked={variation.is_available}
                      onChange={() => toggleAvailable(variation)}
                      label={variation.is_available ? 'Disp.' : 'Indisp.'}
                    />
                    <IconButton label="Editar variação" onClick={() => startEdit(variation)} className="h-9 w-9">
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400">Nenhuma variação cadastrada ainda.</p>
      )}
    </Section>
  )
}

export function CatalogBoard({ catalog, onRefresh, onFlash }: CatalogBoardProps) {
  return (
    <div className="space-y-4">
      <StoresManager catalog={catalog} onRefresh={onRefresh} onFlash={onFlash} />
      <CategoriesManager catalog={catalog} onRefresh={onRefresh} onFlash={onFlash} />
      <ProductsManager catalog={catalog} onRefresh={onRefresh} onFlash={onFlash} />
      <VariationsManager catalog={catalog} onRefresh={onRefresh} onFlash={onFlash} />
    </div>
  )
}