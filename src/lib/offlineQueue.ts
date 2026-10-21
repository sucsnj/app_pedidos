import { supabase } from './supabase'
import { withDB } from './localCache'
import { persistOrderDraft } from './orderDraft'
import { newId } from './utils'
import type { Order } from '../types/database'

export { newId }

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

const STORE_NAME = 'queue'

export function isOffline(): boolean {
  // `=== false` (e não `!navigator.onLine`): fora do navegador o `onLine` é
  // `undefined` e não significa "offline".
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

const NETWORK_FAILURE_PATTERN =
  /failed to fetch|fetch failed|load failed|network request failed|network error|econnrefused|enotfound|ehostunreach|enetunreach|net::err/i

export function isOfflineError(err: unknown): boolean {
  if (isOffline()) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return true
  }
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : ''
  return message ? NETWORK_FAILURE_PATTERN.test(message) : false
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

type PendingListener = (count: number) => void
const pendingListeners = new Set<PendingListener>()

export function subscribePending(listener: PendingListener): () => void {
  pendingListeners.add(listener)
  void pendingCount()
    .then(listener)
    .catch(() => undefined)
  return () => {
    pendingListeners.delete(listener)
  }
}

function emitPending(): void {
  void pendingCount()
    .then((count) => {
      for (const listener of pendingListeners) listener(count)
    })
    .catch(() => undefined)
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
    emitPending()
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

/**
 * Remove o `persist-draft` pendente de um pedido — usado quando o rascunho foi
 * gravado online (o snapshot enfileirado ficou antigo e não pode sobrescrever
 * o estado mais novo do servidor).
 */
export async function removeDraftForOrder(orderId: string): Promise<void> {
  await withDB(async (db) => {
    const current = await readAll(db)
    const drafts = current.filter(
      (entry) => entry.action.type === 'persist-draft' && entry.action.orderId === orderId,
    )
    if (drafts.length === 0) return
    for (const draft of drafts) await remove(db, draft.id)
    emitPending()
  })
}

async function isQueued(entryId: string): Promise<boolean> {
  const entries = await listPending()
  return entries.some((entry) => entry.id === entryId)
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
    await persistOrderDraft({
      orderId,
      requesterName,
      notes,
      totalItems,
      rows: items.map((item) => ({
        product_id: item.product_id,
        product_variation_id: item.product_variation_id,
        product_code: item.product_code,
        product_name: item.product_name,
        variation_name: item.variation_name,
        quantity: item.quantity,
        is_entered_in_legacy: item.is_entered_in_legacy,
      })),
    })
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
  /** Ações removidas por erro permanente (ex.: pedido já excluído). */
  discarded: number
}

/** Erro de sessão (401/JWT) — a ação é válida, só não dá para aplicar agora. */
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status
  const code = (err as { code?: unknown } | null)?.code
  return status === 401 || code === 'PGRST301'
}

export async function flushQueue(force = false): Promise<FlushResult> {
  if (!force && isOffline()) return { flushed: 0, remaining: 0, discarded: 0 }
  const entries = await listPending()
  let flushed = 0
  let discarded = 0
  for (const entry of entries) {
    try {
      // A entrada pode ter sido removida enquanto o flush corria (ex.: rascunho
      // gravado online) — nesse caso o snapshot já está no servidor e não deve
      // ser reaplicado, sob pena de sobrescrever um estado mais novo.
      if (!(await isQueued(entry.id))) continue
      await processAction(entry.action)
      await withDB((db) => remove(db, entry.id))
      flushed += 1
    } catch (err) {
      if (isOfflineError(err) || isAuthError(err)) break
      // Erro permanente (pedido removido, política violada…): a ação não pode
      // ser aplicada nunca — descarta e segue para as próximas.
      await withDB((db) => remove(db, entry.id)).catch(() => undefined)
      discarded += 1
    }
  }
  const remaining = await pendingCount()
  emitPending()
  return { flushed, remaining, discarded }
}

/** Limpa a fila (descarta tudo) — usado pelo botão "Descartar pendências". */
export async function discardPending(): Promise<number> {
  const entries = await listPending()
  await withDB(async (db) => {
    for (const entry of entries) {
      await remove(db, entry.id)
    }
  })
  emitPending()
  return entries.length
}