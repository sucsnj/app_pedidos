export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OrderStatus = 'Rascunho' | 'Concluido' | 'Lancado'

/* --- stores --- */
export interface Store {
  id: string
  code: string | null
  name: string
  is_active: boolean
  created_at: string
}
export interface StoreInsert {
  code?: string | null
  name: string
  is_active?: boolean
}
export type StoreUpdate = Partial<StoreInsert>

/* --- categories --- */
export interface Category {
  id: string
  name: string
  display_order: number
  created_at: string
}
export interface CategoryInsert {
  name: string
  display_order?: number
}
export type CategoryUpdate = Partial<CategoryInsert>

/* --- products --- */
export interface Product {
  id: string
  category_id: string
  code: string | null
  name: string
  unit_type: string
  is_active: boolean
  display_order: number
  created_at: string
}
export interface ProductInsert {
  category_id: string
  code?: string | null
  name: string
  unit_type?: string
  is_active?: boolean
  display_order?: number
}
export type ProductUpdate = Partial<ProductInsert>

/* --- product_variations --- */
export interface ProductVariation {
  id: string
  product_id: string
  name: string
  weight_label: string | null
  sku_code: string | null
  price: number
  is_available: boolean
  created_at: string
}
export interface ProductVariationInsert {
  product_id: string
  name: string
  weight_label?: string | null
  sku_code?: string | null
  price?: number
  is_available?: boolean
}
export type ProductVariationUpdate = Partial<ProductVariationInsert>

/* --- orders --- */
export interface Order {
  id: string
  store_id: string | null
  requester_name: string
  status: OrderStatus
  total_items: number
  notes: string | null
  created_at: string
  updated_at: string
}
export interface OrderInsert {
  store_id?: string | null
  requester_name?: string
  status?: OrderStatus
  total_items?: number
  notes?: string | null
}
export type OrderUpdate = Partial<OrderInsert>

/* --- order_items --- */
export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_variation_id: string | null
  product_code: string | null
  product_name: string
  variation_name: string | null
  quantity: number
  is_entered_in_legacy: boolean
  created_at: string
}
export interface OrderItemInsert {
  order_id: string
  product_id?: string | null
  product_variation_id?: string | null
  product_code?: string | null
  product_name: string
  variation_name?: string | null
  quantity?: number
  is_entered_in_legacy?: boolean
}
export type OrderItemUpdate = Partial<OrderItemInsert>

/* --- profiles --- */
export type UserRole = 'admin' | 'gerente'

export interface Profile {
  id: string
  email: string | null
  username: string | null
  store_id: string | null
  role: UserRole
  full_name: string | null
  is_active: boolean
  created_at: string
}
export interface ProfileInsert {
  id: string
  email?: string | null
  username?: string | null
  store_id?: string | null
  role?: UserRole
  full_name?: string | null
  is_active?: boolean
}
export type ProfileUpdate = Partial<ProfileInsert>

/* --- vw_product_suggestions (view) --- */
export interface ProductSuggestion {
  store_id: string
  product_id: string
  product_variation_id: string
  suggested_quantity: number
  last_ordered_at: string
}

/* --- Generic do Supabase (SupabaseDatabase) para consultas 100% tipadas --- */
/**
 * Interfaces não possuem signature implícita de índice, então não satisfazem
 * Record<string, unknown> (exigido pelo GenericTable do supabase-js).
 * A interseção com Record<string, unknown> preserva as interfaces originais
 * e torna o tipo atribuível ao generic do cliente.
 */
type Recordish<T> = T & Record<string, unknown>

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: Recordish<Store>
        Insert: Recordish<StoreInsert>
        Update: Recordish<StoreUpdate>
        Relationships: []
      }
      categories: {
        Row: Recordish<Category>
        Insert: Recordish<CategoryInsert>
        Update: Recordish<CategoryUpdate>
        Relationships: []
      }
      products: {
        Row: Recordish<Product>
        Insert: Recordish<ProductInsert>
        Update: Recordish<ProductUpdate>
        Relationships: []
      }
      product_variations: {
        Row: Recordish<ProductVariation>
        Insert: Recordish<ProductVariationInsert>
        Update: Recordish<ProductVariationUpdate>
        Relationships: []
      }
      orders: {
        Row: Recordish<Order>
        Insert: Recordish<OrderInsert>
        Update: Recordish<OrderUpdate>
        Relationships: []
      }
      order_items: {
        Row: Recordish<OrderItem>
        Insert: Recordish<OrderItemInsert>
        Update: Recordish<OrderItemUpdate>
        Relationships: []
      }
      profiles: {
        Row: Recordish<Profile>
        Insert: Recordish<ProfileInsert>
        Update: Recordish<ProfileUpdate>
        Relationships: []
      }
    }
    Views: {
      vw_product_suggestions: {
        Row: Recordish<ProductSuggestion>
        Relationships: []
      }
    }
    Functions: {}
  }
}