import type {
  Catalog,
  CountedItem,
  ItemKey,
  LastOrderData,
  Report,
  SuggestionsMap,
} from '../types/app'
import type { Order, Profile } from '../types/database'
import { resolveItemForCount } from './orders'

const DB_NAME = 'pedidos-pwa'
const DB_VERSION = 2
const QUEUE_STORE = 'queue'
const MIRROR_STORE = 'mirror'

export interface CachedCountedItem {
  key: ItemKey
  quantity: number
  isEnteredInLegacy: boolean
}

export interface CachedLastOrder {
  totalItems: number
  items: CachedCountedItem[]
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(MIRROR_STORE)) {
        db.createObjectStore(MIRROR_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Falha ao abrir o banco local'))
  })
}

export async function withDB<T>(
  fn: (db: IDBDatabase) => Promise<T>,
): Promise<T> {
  const db = await openDB()
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

async function readMirror<T>(key: string): Promise<T | null> {
  try {
    return await withDB(async (db) => {
      const tx = db.transaction(MIRROR_STORE, 'readonly')
      const request = tx.objectStore(MIRROR_STORE).get(key)
      return await new Promise<T | null>((resolve, reject) => {
        request.onsuccess = () =>
          resolve((request.result as { value: T } | undefined)?.value ?? null)
        request.onerror = () =>
          reject(request.error ?? new Error('Falha ao ler o espelho local'))
      })
    })
  } catch {
    return null
  }
}

async function writeMirror(key: string, value: unknown): Promise<void> {
  try {
    await withDB(async (db) => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite')
      tx.objectStore(MIRROR_STORE).put({ key, value })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar o espelho local'))
      })
    })
  } catch {}
}

const ordersKey = (storeId: string) => `orders:${storeId}`
const itemsKey = (orderId: string) => `items:${orderId}`
const suggestionsKey = (storeId: string) => `suggestions:${storeId}`
const lastOrderKey = (storeId: string) => `lastOrder:${storeId}`
const reportKey = (storeId: string) => `report:${storeId}`
const profileKey = (userId: string) => `profile:${userId}`

export function cacheOrders(storeId: string, orders: Order[]): Promise<void> {
  return writeMirror(ordersKey(storeId), orders)
}

export function readOrders(storeId: string): Promise<Order[] | null> {
  return readMirror<Order[]>(ordersKey(storeId))
}

export function updateOrderInStore(order: Order): Promise<void> {
  const storeId = order.store_id ?? ''
  if (!storeId || !order.id) return Promise.resolve()
  return readOrders(storeId).then((list) => {
    if (!list) return
    const previous = list.find((entry) => entry.id === order.id)
    const next = previous
      ? list.map((entry) => (entry.id === order.id ? { ...entry, ...order } : entry))
      : [order, ...list].slice(0, 25)
    return cacheOrders(storeId, next)
  })
}

export function serializeCounted(items: CountedItem[]): CachedCountedItem[] {
  return items.map((item) => ({
    key: item.key,
    quantity: item.quantity,
    isEnteredInLegacy: item.isEnteredInLegacy,
  }))
}

export function materializeCounted(
  rows: CachedCountedItem[],
  catalog: Catalog,
): CountedItem[] {
  const result: CountedItem[] = []
  for (const entry of rows) {
    const match = resolveItemForCount(catalog, entry.key)
    if (!match) continue
    result.push({
      key: entry.key,
      product: match.product,
      variation: match.variation,
      quantity: entry.quantity,
      isEnteredInLegacy: entry.isEnteredInLegacy,
    })
  }
  return result
}

export function cacheCountedItems(
  orderId: string,
  items: CountedItem[],
): Promise<void> {
  return writeMirror(itemsKey(orderId), serializeCounted(items))
}

export function readCountedItems(
  orderId: string,
): Promise<CachedCountedItem[] | null> {
  return readMirror<CachedCountedItem[]>(itemsKey(orderId))
}

export function cacheSuggestions(
  storeId: string,
  suggestions: SuggestionsMap,
): Promise<void> {
  const serialized: Record<string, number> = {}
  for (const [key, value] of suggestions) serialized[key] = value
  return writeMirror(suggestionsKey(storeId), serialized)
}

export function readSuggestions(
  storeId: string,
): Promise<SuggestionsMap | null> {
  return readMirror<Record<string, number>>(suggestionsKey(storeId)).then(
    (serialized) => {
      if (serialized == null) return null
      const result: SuggestionsMap = new Map()
      for (const [key, value] of Object.entries(serialized)) result.set(key, value)
      return result
    },
  )
}

export function cacheLastOrder(
  storeId: string,
  lastOrder: LastOrderData | null,
): Promise<void> {
  return writeMirror(
    lastOrderKey(storeId),
    lastOrder
      ? { totalItems: lastOrder.totalItems, items: serializeCounted(lastOrder.items) }
      : null,
  )
}

export function readLastOrder(storeId: string): Promise<CachedLastOrder | null> {
  return readMirror<CachedLastOrder>(lastOrderKey(storeId))
}

export function cacheReport(storeId: string, report: Report): Promise<void> {
  return writeMirror(reportKey(storeId), report)
}

export function readReport(storeId: string): Promise<Report | null> {
  return readMirror<Report>(reportKey(storeId))
}

export function cacheProfile(
  userId: string,
  profile: Profile | null,
): Promise<void> {
  return writeMirror(profileKey(userId), profile)
}

export function readProfile(userId: string): Promise<Profile | null> {
  return readMirror<Profile>(profileKey(userId))
}