---
name: app-context
description: Use when a task touches the persistence or realtime mechanics of the session (useStoreSession, useDraftPersistence, useRealtimeOrder), changes Supabase tables or the types in types/database.ts, or needs deep application context (data model, order flow, save invariants).
---

# Contexto da aplicação — pedidos-abastecimento

Tarefa envolvendo persistência, realtime ou schema do banco. Leia na íntegra, além do `AGENTS.md` (já carregado):

- `docs/architecture.md` — mecânica de hooks/fluxos.
- `docs/data-model.md` — schema e regras de domínio.

## Invariantes que nunca devem ser quebrados sem justificativa

- **Contrato de `useStoreSession`** (~24 campos) — `App.tsx` destrutura tudo; mudar exige ajustar os dois.
- **Autosave com debounce de 700ms** (efeito em `[items, requesterName, notes, currentOrder?.id, loading, enqueuePersist]`).
- **Guard do realtime**: `savingRef || dirtyRef || now - lastSavedAt < 1500` — `shouldSkipSync` deve continuar estável (`useCallback([])`, só lê refs) para não re-subscribe o channel.
- **Persistência delete+insert** dos `order_items` via `toOrderItemRows` (filtra `quantity > 0`), encadeada no `persistChainRef`.
- **CRUD do catálogo** (`CatalogBoard`) grava **direto no Supabase**, fora do `useStoreSession`/`persistChain` — não usa debounce nem chain.
- **Sub-hooks recebem estados/setters por parâmetro**; o orquestrador segue dono dos estados; nunca chame hooks condicionalmente.
- **Tipos `Insert`/`Update`** com `& Record<string, unknown>` (padrão `Recordish`) para satisfazer o generic do supabase-js.
- Convenções: sem comentários, newline final, mensagens de UI em pt-BR.

Ao alterar persistência/realtime/schema, valide com `npm run typecheck` e `npm run build`.
