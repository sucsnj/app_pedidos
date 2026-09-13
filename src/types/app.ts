import type {
  Category,
  Product,
  ProductVariation,
  Store,
} from './database'

/** Variação sintética (id vazio) usada para produtos cadastrados sem variações. */
export const SYNTHETIC_VARIATION_ID = ''

export type TabId = 'count' | 'entry' | 'catalog'

/** Chave única de um item contado: `${productId}::${variationId}` */
export type ItemKey = string

export interface Catalog {
  stores: Store[]
  categories: Category[]
  products: Product[]
  variations: ProductVariation[]
}

export interface CountedItem {
  key: ItemKey
  product: Product
  variation: ProductVariation
  quantity: number
  isEnteredInLegacy: boolean
}

export type SuggestionsMap = Map<ItemKey, number>

export const itemKey = (productId: string, variationId: string): ItemKey =>
  `${productId}::${variationId}`

/** Cria a variação de unidade única para produtos sem variações cadastradas. */
export const defaultVariationForProduct = (product: Product): ProductVariation => ({
  id: SYNTHETIC_VARIATION_ID,
  product_id: product.id,
  name: 'Unidade',
  weight_label: product.unit_type ?? null,
  sku_code: product.code,
  price: 0,
  is_available: true,
  created_at: '',
})

/** Ordena por código PLU/SKU e, em seguida, por nome (critério da tela de digitação). */
export const compareByEntryCode = (
  a: CountedItem,
  b: CountedItem,
): number => {
  const aCode = (a.product.code ?? a.variation.sku_code ?? '').trim()
  const bCode = (b.product.code ?? b.variation.sku_code ?? '').trim()
  if (aCode !== bCode) return aCode.localeCompare(bCode, 'pt-BR', { numeric: true })
  return a.variation.name.localeCompare(b.variation.name, 'pt-BR')
}