import { supabase } from './supabase'
import type { Order } from '../types/database'

export interface DraftItemRow {
  product_id: string | null
  product_variation_id: string | null
  product_code: string | null
  product_name: string
  variation_name: string | null
  quantity: number
  is_entered_in_legacy: boolean
}

export type OfflineAction =
  | {
      type: 'persist-draft'
      orderId: string
      requesterName: string
      notes: string
      totalItems: number
      items: DraftItemRow[]
    }
  | { type: 'finish-order'; orderId: string }
  | { type: 'create-order'; order: Order }

interface QueuedAction {
  id: string
  createdAt: number
  action: OfflineAction
}

const DB_NAME = 'pedidos-pwa'
const STORE_NAME = 'queue'
const DB_VERSION = 1

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export function isOfflineError(err: unknown): boolean {
  if (isOffline()) return true
  return (
    err instanceof TypeError &&
    /fetch|network|load failed/i.test(err.message)
  )
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o banco local'))
  })
}

async function withDB<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB()
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

function readAll(db: IDBDatabase): Promise<QueuedAction[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as QueuedAction[])
    request.onerror = () => reject(request.error ?? new Error('Falha ao ler a fila local'))
  })
}

function write(db: IDBDatabase, value: QueuedAction): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar na fila local'))
  })
}

function remove(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover ação da fila local'))
  })
}

async function enqueue(action: OfflineAction): Promise<void> {
  await withDB(async (db) => {
    const current = await readAll(db)
    let previousId: string | null = null

    if (action.type === 'persist-draft') {
      const finishing = current.some(
        (entry) =>
          entry.action.type === 'finish-order' && entry.action.orderId === action.orderId,
      )
      if (finishing) return
      const existing = current.find(
        (entry) =>
          entry.action.type === 'persist-draft' && entry.action.orderId === action.orderId,
      )
      if (existing) previousId = existing.id
    } else if (action.type === 'finish-order') {
      const existing = current.find(
        (entry) =>
          entry.action.type === 'finish-order' && entry.action.orderId === action.orderId,
      )
      if (existing) previousId = existing.id
    }

    if (previousId) await remove(db, previousId)
    await write(db, { id: newId(), createdAt: Date.now(), action })
  })
}

export function enqueuePersistDraft(payload: {
  orderId: string
  requesterName: string
  notes: string
  totalItems: number
  items: DraftItemRow[]
}): Promise<void> {
  return enqueue({ type: 'persist-draft', ...payload })
}

export function enqueueFinishOrder(orderId: string): Promise<void> {
  return enqueue({ type: 'finish-order', orderId })
}

export function enqueueCreateOrder(order: Order): Promise<void> {
  return enqueue({ type: 'create-order', order })
}

export function listPending(): Promise<QueuedAction[]> {
  return withDB(async (db) => {
    const entries = await readAll(db)
    return entries
      .filter((entry) => entry && entry.action)
      .sort((a, b) => a.createdAt - b.createdAt)
  })
}

export function pendingCount(): Promise<number> {
  return listPending().then((entries) => entries.length)
}

async function processAction(action: OfflineAction): Promise<void> {
  if (action.type === 'persist-draft') {
    const { orderId, requesterName, notes, totalItems, items } = action
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        requester_name: requesterName,
        notes: notes || null,
        total_items: totalItems,
      })
      .eq('id', orderId)
    if (orderError) throw orderError

    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
    if (deleteError) throw deleteError

    if (items.length > 0) {
      const rows = items.map((row) => ({ ...row, order_id: orderId }))
      const { error: insertError } = await supabase
        .from('order_items')
        .insert(rows)
      if (insertError) throw insertError
    }
    return
  }

  if (action.type === 'finish-order') {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'Concluido' })
      .eq('id', action.orderId)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('orders').insert({
    id: action.order.id,
    store_id: action.order.store_id,
    requester_name: action.order.requester_name,
    status: action.order.status,
    total_items: action.order.total_items,
    notes: action.order.notes,
  })
  if (error) throw error
}

export interface FlushResult {
  flushed: number
  remaining: number
}

export async function flushQueue(): Promise<FlushResult> {
  if (isOffline()) return { flushed: 0, remaining: 0 }
  const entries = await listPending()
  let flushed = 0
  for (const entry of entries) {
    try {
      await processAction(entry.action)
      await withDB((db) => remove(db, entry.id))
      flushed += 1
    } catch {
      break
    }
  }
  const remaining = await pendingCount()
  return { flushed, remaining }
}