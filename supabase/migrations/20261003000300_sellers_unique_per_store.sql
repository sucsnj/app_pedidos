-- Nome de vendedor único **por loja** (e só entre os ativos) + soft delete.
-- Antes: `sellers_name_unique` era global (lower(name)) e impedia usar o mesmo
-- nome em lojas diferentes; a remoção era definitiva (cascade nos lançamentos).

drop index if exists public.sellers_name_unique;

create unique index if not exists sellers_name_store_active_unique
  on public.sellers (store_id, lower(name))
  where is_active;

-- Nota: vendedores com `store_id is null` (globais/legados) não são
-- restringidos pelo índice (NULLs são distintos no Postgres).
