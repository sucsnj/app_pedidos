-- Módulo de Gestão (/management): cadastro de vendedores e histórico de vendas/métricas.
-- Aplicar no Supabase (SQL Editor) ou via `supabase db push`.

-- ---------------------------------------------------------------- vendedores
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists sellers_name_unique on public.sellers (lower(name));

-- --------------------------------------------------- histórico de consolidação
create table if not exists public.sales_calculations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  reference_date date not null default current_date,
  total_sold numeric(14, 2) not null default 0,
  effective_base_total numeric(14, 2) not null default 0,
  custom_total_base numeric(14, 2),
  average_ticket numeric(14, 2) not null default 0,
  record_count integer not null default 0,
  target_achievement_percentage numeric(7, 2),
  top_sale jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

-- ------------------------------------------- vendas por vendedor (histórico)
create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid references public.sales_calculations (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  seller_name text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  percentage numeric(7, 2) not null default 0,
  reference_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists sales_records_seller_idx on public.sales_records (seller_id);
create index if not exists sales_records_calculation_idx on public.sales_records (calculation_id);
create index if not exists sales_records_reference_date_idx on public.sales_records (reference_date desc);
create index if not exists sales_calculations_created_at_idx on public.sales_calculations (created_at desc);

-- ------------------------------------------------------------------- RLS
alter table public.sellers enable row level security;
alter table public.sales_calculations enable row level security;
alter table public.sales_records enable row level security;

drop policy if exists "sellers leitura autenticada" on public.sellers;
drop policy if exists "sellers escrita autenticada" on public.sellers;
drop policy if exists "sellers atualizacao autenticada" on public.sellers;
drop policy if exists "sellers exclusao autenticada" on public.sellers;
create policy "sellers leitura autenticada" on public.sellers for select to authenticated using (true);
create policy "sellers escrita autenticada" on public.sellers for insert to authenticated with check (true);
create policy "sellers atualizacao autenticada" on public.sellers for update to authenticated using (true) with check (true);
create policy "sellers exclusao autenticada" on public.sellers for delete to authenticated using (true);

drop policy if exists "sales_calculations leitura autenticada" on public.sales_calculations;
drop policy if exists "sales_calculations escrita autenticada" on public.sales_calculations;
drop policy if exists "sales_calculations exclusao autenticada" on public.sales_calculations;
create policy "sales_calculations leitura autenticada" on public.sales_calculations for select to authenticated using (true);
create policy "sales_calculations escrita autenticada" on public.sales_calculations for insert to authenticated with check (true);
create policy "sales_calculations exclusao autenticada" on public.sales_calculations for delete to authenticated using (true);

drop policy if exists "sales_records leitura autenticada" on public.sales_records;
drop policy if exists "sales_records escrita autenticada" on public.sales_records;
drop policy if exists "sales_records exclusao autenticada" on public.sales_records;
create policy "sales_records leitura autenticada" on public.sales_records for select to authenticated using (true);
create policy "sales_records escrita autenticada" on public.sales_records for insert to authenticated with check (true);
create policy "sales_records exclusao autenticada" on public.sales_records for delete to authenticated using (true);
