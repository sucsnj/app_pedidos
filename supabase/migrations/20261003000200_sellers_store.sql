-- Vendedores associados à loja selecionada (módulo de Gestão).

alter table public.sellers
  add column if not exists store_id uuid references public.stores (id) on delete set null;

create index if not exists sellers_store_id_idx on public.sellers (store_id);

-- Nota: vendedores criados antes desta migration ficam com `store_id = null`
-- (considerados globais e visíveis em qualquer loja).
