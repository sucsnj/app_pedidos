# Arquitetura — mecânica dos hooks e fluxos

Aprofundamento do `AGENTS.md`. Foco na composição de hooks, na persistência concorrente e no realtime. Antes de mexer, leia este arquivo e o `data-model.md`.

## Composição geral

```
App.tsx (176 linhas)
 ├─ useCatalog ......... catálogo (stores, categories, products, variations) + reload/refresh
 ├─ useFlash ........... toast (notify estável)
 ├─ useStoreSession .... SESSÃO: dono dos estados + ações            ~394 linhas
 │   ├─ useDraftPersistence ... persistência/autosave               ~199 linhas
 │   └─ useRealtimeOrder ...... subscription Supabase                ~85 linhas
 └─ useStoreReports .... relatório + última contagem (bumpReport)
```

- **Contrato**: `useStoreSession({ catalog, notify, onNavigate })` retorna ~24 campos (`activeStoreId, orders, currentOrder, items, suggestions, requesterName, notes, loading, error, saving, finishing, savedAt, setRequesterName, setNotes, adjust, setQuantity, toggleEntered, selectStore, selectOrder, newCount, finishOrder, saveNow, clearError`). `App.tsx` destrutura tudo — não mude sem ajustar ambos.
- Sem testes. Validação: `npm run typecheck` e `npm run build` (strict + `noUnusedLocals`/`noUnusedParameters`).

## `useStoreSession` (orquestrador)

Dono **de todos os estados** da sessão:

- `activeStoreId`, `orders`, `currentOrder`, `items`, `suggestions`, `requesterName`, `notes`, `loading`, `error`, `finishing`. `saving`/`savedAt` vêm de `useDraftPersistence`.
- Compõe os sub-hooks passando estados/setters como parâmetro (nunca chama hooks condicionalmente).

### Carga da loja (efeito)

- Token `storeEffectToken` + flag `cancelled` evitam corrida entre trocas rápidas de loja.
- Reseta todos os estados e `savedAt` (`resetSavedAt`), carrega:
  - `orders` (máx. 25, `updated_at desc`) por `store_id`;
  - `vw_product_suggestions` (monta `SuggestionsMap` com `itemKey`);
  - se não houver pedido, **insere** um `Rascunho` vazio e o usa.
- Depois busca os `order_items` via `fetchOrderItems` (estável, `useCallback([])`) e mapeia com `mapOrderItems`.

### Reconciliar catálogo

- Efeito em `catalog.products`/`catalog.variations` remapeia os `items` para as referências atualizadas (nome/preço/etc.) sem perder quantidade.

## `useDraftPersistence` — persistência

- **Refs espelhadas**: `orderRef`, `itemsRef`, `requesterRef`, `notesRef` sincronizadas por efeitos a cada render; `savingRef`, `dirtyRef`, `lastSavedAt`, `saveTimer`, `persistChainRef`.
- **Autosave**: efeito em `[items, requesterName, notes, currentOrder?.id, loading, enqueuePersist]`; ignora se `loading` ou sem `currentOrder`; marca `dirty` e agenda **700ms** (debounce).
- **`enqueuePersist`**: encadeia no `persistChainRef` (`.then` sobre a promise anterior) — evita escrita concorrente; erros não quebram a chain.
- **`persistOrder`**: snapshot das refs → update em `orders` (requester/notes/total_items) → **delete + insert** em `order_items` (via `toOrderItemRows`, filtra `quantity > 0`) → `commitSyncedOrder`. Erro marca `dirty`.
- **`commitSyncedOrder(synced)`**: atualiza `lastSavedAt`, limpa `dirty`, faz mesclagem de `setCurrentOrder` + `setOrders` (preservando identidade quando `orderDisplayEquals`) e marca `savedAt`. Usado por `persistOrder` e por `finishOrder`.
- **Exposto**: `saving`, `savedAt`, `enqueuePersist`, `saveNow`, `clearDebounce`, `markDirty`, `commitSyncedOrder`, `snapshotRefs`, `shouldSkipSync`, `resetSavedAt`.

### Identidades (crítico)

- **`shouldSkipSync`** é `useCallback([])` — só lê refs (`savingRef || dirtyRef || now-lastSavedAt < 1500`). Estável por design: se variar, o channel do realtime re-subscribe a cada render.
- `commitSyncedOrder`/`snapshotRefs`/`clearDebounce` dependem só de setters refs estáveis → estáveis.

## `useRealtimeOrder` — subscription

- Assina `channel('order:' + id)` reagindo a `order_items` (qualquer evento) e `orders` (`UPDATE`) do pedido corrente.
- `reloadFromServer(orderId)` CONSULTA o servidor e só aplica se `shouldSkipSync()` permitir (não sobrepõe salvamento/dirty/reflexo recente).
- Falhas são ignoradas (sincronização auxiliar não bloqueia o app).

## Ações

- `adjust` / `setQuantity`: resolvem via `resolveItemForCount` (produto + variação sintética) e aplicam reducers puros `adjustCountedItems`/`setCountedQuantity`. `setQuantity` trunca e não cria item com `0`.
- `toggleEntered`: alterna `isEnteredInLegacy` (mesmo `CountedItem`).
- `finishOrder` → Promise\<boolean>: guarda `status === 'Rascunho'`; `clearDebounce` → `markDirty` → `enqueuePersist` (flush) → update `orders` para `Concluido` → `commitSyncedOrder(completed)` → notify + navega para `entry`; `App.tsx` faz `bumpReport()` se `true`. `finishing` é estado da sessão.
- `newCount`: flush do rascunho se houver, insere novo `Rascunho`, limpa `items`/requester/notes/`savedAt`, navega para `count`.
- `selectStore` / `selectOrder`: flush + trocam contexto; `selectOrder` recarrega os `order_items`.
- `saveNow`: flush manual imediato (mesmo debounce/chain).

## Regras de vigilância

- Não trocar o debounce (700ms), o guard (`saving || dirty || <1500ms`) nem o delete+insert dos itens sem motivo — são decisões base de concorrência.
- Manter os callbacks estáveis que só leem refs (`shouldSkipSync`) e desestruturar handles estáveis do sub-hook nos deps das ações.
- Sub-hooks novos devem receber estados/setters por parâmetro; o orquestrador segue dono dos estados.
