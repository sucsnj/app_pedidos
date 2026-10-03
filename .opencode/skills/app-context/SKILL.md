---
name: app-context
description: Use when a task touches the persistence or realtime mechanics of the session (useStoreSession, useDraftPersistence, useRealtimeOrder), the offline action queue (lib/offlineQueue.ts, flush/sync), changes Supabase tables or the types in types/database.ts, or needs deep application context (data model, order flow, save invariants).
---

# Contexto da aplicação — pedidos-abastecimento

Tarefa envolvendo persistência, realtime ou schema do banco. Leia na íntegra, além do `AGENTS.md` (já carregado):

- `docs/architecture.md` — mecânica de hooks/fluxos.
- `docs/data-model.md` — schema e regras de domínio.

## Invariantes que nunca devem ser quebrados sem justificativa

- **Contrato de `useStoreSession`** (~25 campos, incl. `refreshCurrentOrder`) — o orquestrador (`Dashboard`) destrutura tudo; adições são permitidas, remoções/renomeações exigem ajustar o outro lado.
- **Autosave com debounce de 700ms** (efeito em `[items, requesterName, notes, currentOrder?.id, loading, enqueuePersist]`).
- **Guard do realtime**: `savingRef || dirtyRef || now - lastSavedAt < 1500` — `shouldSkipSync` deve continuar estável (`useCallback([])`, só lê refs) para não re-subscribe o channel.
- **Persistência delete+insert** dos `order_items` via `toOrderItemRows` (filtra `quantity > 0`), encadeada no `persistChainRef`.
- **Fila offline** (`lib/offlineQueue.ts`, IndexedDB `pedidos-pwa/queue`): ações `persist-draft`/`finish-order`/`create-order`; `flushQueue` em ordem `createdAt` com o cliente supabase **vivo** (sessão fresca → evita 401 de JWT), parando em falha de rede; reconciliação pós-flush via `refreshCurrentOrder`/`commitSyncedOrder` (limpa `dirty`/guard). Persistência/catálogo podem enfileirar; CRUD do catálogo **não**.
- **Espelho local de leitura** (`lib/localCache.ts`, IndexedDB `pedidos-pwa/mirror`, DB v2): pedidos/itens/sugestões/última contagem/relatório/perfil. Estratégia **servidor 1º, espelho fallback** — leituras re-espelham **só após sucesso** e caem para o espelho **apenas em falha offline** (`isOffline`/`isOfflineError` — detecção por `navigator.onLine` + mensagem de rede: `PostgrestError` "Failed to fetch"/`AbortError`; cliente Supabase aborta em 10s); escritas (persist online e offline/otimista, `finishOrder`, `newCount`, pós-flush) também gravam `updateOrderInStore`/`cacheCountedItems`.
- **Preferência de loja**: `selectStore` (seletor do `admin`) grava `pedidos:selectedStore:<userId>` no `localStorage`; a carga respeita a preferência validada contra o catálogo antes do `preferredStoreId` do perfil.
- **CRUD do catálogo** (`CatalogBoard`) grava **direto no Supabase**, fora do `useStoreSession`/`persistChain` — não usa debounce nem chain (exige rede).
- **Sub-hooks recebem estados/setters por parâmetro**; o orquestrador segue dono dos estados; nunca chame hooks condicionalmente.
- **Tipos `Insert`/`Update`** com `& Record<string, unknown>` (padrão `Recordish`) para satisfazer o generic do supabase-js (`OrderInsert` tem `id?: string` p/ create-order otimista).
- Convenções: sem comentários por padrão (sobrepujado por regras do framework ou boas práticas de programação), newline final, mensagens de UI em pt-BR.

## Padrão de atuação

- Ao alterar, atualize os contextos de agente afetados (`AGENTS.md`, `docs/`, esta skill).
- Sem ações destrutivas que mudem comportamentos do app sem autorização prévia.
- Siga as regras do projeto e do contexto do agente.
- Ante instrução ambígua ou confusa no prompt, pergunte antes de agir.

Ao alterar persistência/realtime/schema, valide com `npm run typecheck` e `npm run build`.
