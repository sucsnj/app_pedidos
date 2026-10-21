import { supabase } from './supabase'
import type { Json } from '../types/database'

export interface OrderDraftRow {
  product_id?: string | null
  product_variation_id?: string | null
  product_code?: string | null
  product_name: string
  variation_name?: string | null
  quantity?: number
  is_entered_in_legacy?: boolean
}

export interface OrderDraft {
  orderId: string
  requesterName: string
  notes: string
  totalItems: number
  rows: OrderDraftRow[]
}

/** A RPC `persist_order_draft` ainda não foi aplicada no banco? */
export function isMissingRpcError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  const message = (err as { message?: unknown } | null)?.message
  if (code === '42883') return true
  return typeof message === 'string' && /does not exist|function .*not found/i.test(message)
}

/**
 * Grava o rascunho em uma transação única (RPC no Postgres): sem a RPC, o
 * pedido pode ficar sem itens entre o delete e o insert.
 */
export async function persistOrderDraftAtomic(draft: OrderDraft): Promise<void> {
  const { error } = await supabase.rpc('persist_order_draft', {
    p_order_id: draft.orderId,
    p_requester_name: draft.requesterName,
    p_notes: draft.notes || null,
    p_total_items: draft.totalItems,
    p_items: draft.rows as unknown as Json,
  })
  if (error) throw error
}

/** Caminho alternativo (update + delete + insert) para quando a RPC não existe. */
export async function persistOrderDraftSequential(draft: OrderDraft): Promise<void> {
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      requester_name: draft.requesterName,
      notes: draft.notes || null,
      total_items: draft.totalItems,
    })
    .eq('id', draft.orderId)
  if (orderError) throw orderError

  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', draft.orderId)
  if (deleteError) throw deleteError

  if (draft.rows.length > 0) {
    const { error: insertError } = await supabase
      .from('order_items')
      .insert(draft.rows.map((row) => ({ ...row, order_id: draft.orderId })))
    if (insertError) throw insertError
  }
}

/** Grava o rascunho priorizando a transação única e caindo para o caminho legado. */
export async function persistOrderDraft(draft: OrderDraft): Promise<void> {
  try {
    await persistOrderDraftAtomic(draft)
  } catch (err) {
    if (!isMissingRpcError(err)) throw err
    await persistOrderDraftSequential(draft)
  }
}
