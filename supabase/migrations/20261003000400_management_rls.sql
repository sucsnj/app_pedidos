-- Isolamento por loja no módulo de Gestão + auditoria de vendedores.
-- Regra: `admin` acessa todas as lojas; `gerente` só a loja do seu perfil.
-- Requer as tabelas de `20261003000100_management_sales.sql` e a coluna
-- `sellers.store_id` de `20261003000200_sellers_store.sql`.

-- ------------------------------------------------------------------ helpers
-- `security definer` para consultar `profiles` sem recursão de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active
  );
$$;

create or replace function public.current_user_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
  limit 1;
$$;

create or replace function public.can_access_calculation(p_calculation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sales_calculations c
    where c.id = p_calculation_id
      and (public.is_admin() or c.store_id = public.current_user_store_id())
  );
$$;

-- ------------------------------------------------------------------ auditoria
alter table public.sellers
  add column if not exists created_by uuid references auth.users (id) on delete set null default auth.uid();

alter table public.sellers
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.sellers
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_seller_audit()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sellers_touch_audit on public.sellers;
create trigger sellers_touch_audit
  before update on public.sellers
  for each row execute function public.touch_seller_audit();

-- ---------------------------------------------------------------------- RLS
alter table public.sellers enable row level security;
alter table public.sales_calculations enable row level security;
alter table public.sales_records enable row level security;

-- sellers: leitura da própria loja + os globais (legados); escrita só na própria loja.
drop policy if exists "sellers leitura autenticada" on public.sellers;
drop policy if exists "sellers escrita autenticada" on public.sellers;
drop policy if exists "sellers atualizacao autenticada" on public.sellers;
drop policy if exists "sellers exclusao autenticada" on public.sellers;

create policy "sellers leitura autenticada" on public.sellers
  for select to authenticated
  using (
    public.is_admin()
    or store_id is null
    or store_id = public.current_user_store_id()
  );

create policy "sellers escrita autenticada" on public.sellers
  for insert to authenticated
  with check (public.is_admin() or store_id = public.current_user_store_id());

create policy "sellers atualizacao autenticada" on public.sellers
  for update to authenticated
  using (
    public.is_admin()
    or store_id is null
    or store_id = public.current_user_store_id()
  )
  with check (public.is_admin() or store_id = public.current_user_store_id());

-- Desativação é o fluxo normal (soft delete); a exclusão física é do admin.
create policy "sellers exclusao autenticada" on public.sellers
  for delete to authenticated
  using (public.is_admin());

-- sales_calculations: escopo pela loja do lançamento.
drop policy if exists "sales_calculations leitura autenticada" on public.sales_calculations;
drop policy if exists "sales_calculations escrita autenticada" on public.sales_calculations;
drop policy if exists "sales_calculations exclusao autenticada" on public.sales_calculations;

create policy "sales_calculations leitura autenticada" on public.sales_calculations
  for select to authenticated
  using (public.is_admin() or store_id = public.current_user_store_id());

create policy "sales_calculations escrita autenticada" on public.sales_calculations
  for insert to authenticated
  with check (public.is_admin() or store_id = public.current_user_store_id());

create policy "sales_calculations atualizacao autenticada" on public.sales_calculations
  for update to authenticated
  using (public.is_admin() or store_id = public.current_user_store_id())
  with check (public.is_admin() or store_id = public.current_user_store_id());

create policy "sales_calculations exclusao autenticada" on public.sales_calculations
  for delete to authenticated
  using (public.is_admin() or store_id = public.current_user_store_id());

-- sales_records: sem store_id próprio — herdam o escopo da consolidação.
drop policy if exists "sales_records leitura autenticada" on public.sales_records;
drop policy if exists "sales_records escrita autenticada" on public.sales_records;
drop policy if exists "sales_records exclusao autenticada" on public.sales_records;

create policy "sales_records leitura autenticada" on public.sales_records
  for select to authenticated
  using (public.is_admin() or public.can_access_calculation(calculation_id));

create policy "sales_records escrita autenticada" on public.sales_records
  for insert to authenticated
  with check (public.is_admin() or public.can_access_calculation(calculation_id));

create policy "sales_records atualizacao autenticada" on public.sales_records
  for update to authenticated
  using (public.is_admin() or public.can_access_calculation(calculation_id))
  with check (public.is_admin() or public.can_access_calculation(calculation_id));

create policy "sales_records exclusao autenticada" on public.sales_records
  for delete to authenticated
  using (public.is_admin() or public.can_access_calculation(calculation_id));
