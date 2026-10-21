-- Gravação do rascunho do pedido em transação única (update + delete + insert).
-- Sem isso, uma falha entre o delete e o insert deixa o pedido sem itens.

create or replace function public.persist_order_draft(
  p_order_id uuid,
  p_requester_name text,
  p_notes text,
  p_total_items integer,
  p_items jsonb
)
returns void
language plpgsql
as $$
declare
  v_item jsonb;
begin
  update public.orders
     set requester_name = p_requester_name,
         notes = p_notes,
         total_items = p_total_items
   where id = p_order_id;

  delete from public.order_items where order_id = p_order_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_variation_id,
      product_code,
      product_name,
      variation_name,
      quantity,
      is_entered_in_legacy
    ) values (
      p_order_id,
      nullif(v_item->>'product_id', '')::uuid,
      nullif(v_item->>'product_variation_id', '')::uuid,
      v_item->>'product_code',
      v_item->>'product_name',
      v_item->>'variation_name',
      (v_item->>'quantity')::integer,
      coalesce((v_item->>'is_entered_in_legacy')::boolean, false)
    );
  end loop;
end;
$$;

grant execute on function public.persist_order_draft(uuid, text, text, integer, jsonb)
  to authenticated;
