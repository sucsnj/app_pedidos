import { supabase } from './supabase'
import type {
  Recordish,
  SalesCalculation,
  SalesCalculationInsert,
  SalesRecordInsert,
  Seller,
} from '../types/database'
import type { SalesSummary } from '../types/sales'

const DUPLICATE_NAME = '23505'

export async function fetchSellers(): Promise<Seller[]> {
  const { data, error } = await supabase.from('sellers').select('*').order('name')
  if (error) throw error
  return data
}

export async function createSeller(name: string): Promise<Seller> {
  const { data, error } = await supabase.from('sellers').insert({ name }).select().single()
  if (error) {
    if (error.code === DUPLICATE_NAME) {
      throw new Error('Já existe um vendedor com esse nome.')
    }
    throw error
  }
  return data
}

export async function updateSeller(id: string, name: string): Promise<Seller> {
  const { data, error } = await supabase
    .from('sellers')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (error.code === DUPLICATE_NAME) {
      throw new Error('Já existe um vendedor com esse nome.')
    }
    throw error
  }
  return data
}

export async function deleteSeller(id: string): Promise<void> {
  const { error } = await supabase.from('sellers').delete().eq('id', id)
  if (error) throw error
}

export async function fetchHistory(limit = 20): Promise<SalesCalculation[]> {
  const { data, error } = await supabase
    .from('sales_calculations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export interface SalesRecordInput {
  sellerId: string
  sellerName: string
  amount: number
  percentage: number
}

export interface RecordSalesInput {
  storeId: string | null
  referenceDate: string
  summary: SalesSummary
  items: SalesRecordInput[]
}

/**
 * Grava uma consolidação: cria o snapshot em `sales_calculations` e as vendas
 * por vendedor em `sales_records` (vinculadas pelo `calculation_id`).
 */
export async function recordSales(input: RecordSalesInput): Promise<SalesCalculation> {
  const calculation: Recordish<SalesCalculationInsert> = {
    store_id: input.storeId,
    reference_date: input.referenceDate,
    total_sold: input.summary.totalSold,
    effective_base_total: input.summary.effectiveBaseTotal,
    custom_total_base: input.summary.customTotalBase,
    average_ticket: input.summary.averageTicket,
    record_count: input.summary.count,
    target_achievement_percentage: input.summary.targetAchievementPercentage,
    top_sale: input.summary.topSale
      ? {
          id: input.summary.topSale.id,
          name: input.summary.topSale.name,
          value: input.summary.topSale.value,
        }
      : null,
  }

  const { data: created, error: calculationError } = await supabase
    .from('sales_calculations')
    .insert(calculation)
    .select()
    .single()
  if (calculationError) throw calculationError

  if (input.items.length > 0) {
    const rows: Recordish<SalesRecordInsert>[] = input.items.map((item) => ({
      calculation_id: created.id,
      seller_id: item.sellerId,
      seller_name: item.sellerName,
      amount: item.amount,
      percentage: item.percentage,
      reference_date: input.referenceDate,
    }))
    const { error: recordsError } = await supabase.from('sales_records').insert(rows)
    if (recordsError) {
      await supabase.from('sales_calculations').delete().eq('id', created.id)
      throw recordsError
    }
  }

  return created
}
