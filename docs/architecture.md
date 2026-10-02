# Arquitetura — mecânica dos hooks e fluxos

Aprofundamento do `AGENTS.md`. Foco na composição de hooks, na persistência concorrente e no realtime. Antes de mexer, leia este arquivo e o `data-model.md`.

## Composição geral

```
App.tsx (gate de autenticação)
 ├─ useAuth ........... sessão Supabase (getSession/onAuthStateChange) + perfil public.profiles
 │   └─ Rende LoginScreen (anônimo) ou Dashboard (logado)
 ├─ PwaUpdatePrompt ... banners "Nova versão disponível" / "Pronto para uso offline" (src/pwa.ts)

Dashboard.tsx (conteúdo autenticado)
 ├─ useOnline .......... conectividade (navigator.onLine) — banner offline + flush da fila
 ├─ useCatalog ......... catálogo (stores, categories, products, variations) + reload/refresh
 ├─ useFlash ........... toast (notify estável; auto-dismiss 3500ms)
 ├─ useStoreSession .... SESSÃO: dono dos estados + ações            ~460 linhas
 │   ├─ useDraftPersistence ... persistência/autosave               ~220 linhas
 │   └─ useRealtimeOrder ...... subscription Supabase                ~85 linhas
 ├─ useStoreReports .... relatório + última contagem (bumpReport)
 └─ lib/offlineQueue ... fila de ações offline (IndexedDB) — flush na transição online
```

- **Contrato**: `useStoreSession({ catalog, notify, onNavigate, preferredStoreId })` retorna ~25 campos (`activeStoreId, orders, currentOrder, items, suggestions, requesterName, notes, loading, error, saving, finishing, savedAt, setRequesterName, setNotes, adjust, setQuantity, toggleEntered, selectStore, selectOrder, newCount, finishOrder, saveNow, refreshCurrentOrder, clearError`). `Dashboard.tsx` destrutura tudo — não mude sem ajustar ambos. Sem testes. Validação: `npm run typecheck` e `npm run build` (strict + `noUnusedLocals`/`noUnusedParameters`).

## Autenticação (`useAuth` + `App.tsx`)

- `App.tsx` é o gate: `useAuth` expõe `{ user, loading, signIn, signOut }`. Anônimo → `LoginScreen`; logado → `Dashboard`.
- Sessão via `getSession` na montagem + `onAuthStateChange` (login/logout refletem na hora).
- **Perfil/role**: quando `user` existe, o próprio `App.tsx` consulta `public.profiles` (`select('*').eq('id', user.id).maybeSingle()` — falha de leitura não bloqueia o login), define `userRole = profile?.role || 'gerente'`, desloga se `is_active === false` e faz `console.log("Dados do Perfil no Supabase:", profile, "Erro:", error)` (depuração). O header exibe o nome + badge de cargo (ADMIN/GERENTE).
- `signIn` usa `signInWithPassword` e mapeia credenciais inválidas para "Email ou senha inválidos." · `signOut` chama `supabase.auth.signOut` e o header volta ao Login.
- **Login por usuário ou e-mail**: o campo "Usuário ou E-mail" aceita username (ex.: `maria_souza`) ou e-mail completo. Se não contém `@`, o `LoginScreen` resolve o e-mail real via `public.profiles` (`select('email').eq('username', <lowercase>).maybeSingle()`); sem match, mostra "Nome de usuário não encontrado.".
- **Cargos (RBAC)**: `Dashboard` recebe `isAdmin = userRole === 'admin'`. `admin` vê todas as abas (incl. Cadastro + Comparativo) e o seletor de loja no header. `gerente` vê só Contagem e Digitação, fica com a `store_id` do perfil (o header exibe a loja sem seletor) e `Dashboard` força a aba de volta para `count` se ela cair em Cadastro/Comparativo.
- **Loja padrão**: `profile.store_id` vira `preferredStoreId` do `useStoreSession` — a loja selecionada automaticamente no carregamento.
- **Perfil offline**: `App.tsx` espelha `public.profiles` (`cacheProfile`) e, em falha de leitura offline, restaura role/loja do espelho (`readProfile`) — preserva admin/gerente e a loja sem rede.

## `useStoreSession` (orquestrador)

Dono **de todos os estados** da sessão:

- `activeStoreId`, `orders`, `currentOrder`, `items`, `suggestions`, `requesterName`, `notes`, `loading`, `error`, `finishing`. `saving`/`savedAt` vêm de `useDraftPersistence`.
- Compõe os sub-hooks passando estados/setters como parâmetro (nunca chama hooks condicionalmente).

### Carga da loja (efeito)

- Um efeito curto escolhe a loja padrão quando `activeStoreId` está vazio: preferência em `localStorage` (`pedidos:selectedStore:<userId>`, gravada só pelo `selectStore` — seletor do `admin`; validada contra o catálogo), depois `preferredStoreId` do perfil (se existir e constar no catálogo), senão a primeira loja `is_active` (ou `stores[0]`).
- Token `storeEffectToken` + flag `cancelled` evitam corrida entre trocas rápidas de loja.
- Reseta todos os estados e `savedAt` (`resetSavedAt`), carrega:
  - `orders` (máx. 25, `updated_at desc`) por `store_id`;
  - `vw_product_suggestions` (monta `SuggestionsMap` com `itemKey`);
  - se não houver pedido, **insere** um `Rascunho` vazio e o usa.
- Depois busca os `order_items` via `fetchOrderItems` (estável, `useCallback([])`) e mapeia com `mapOrderItems`.
- **Fallback offline**: as leituras (`orders`, `sugestões`, `order_items`) tentam o Supabase primeiro; se falharem por offline (`isOffline`/`isOfflineError`), caem para o espelho (`lib/localCache.ts`) e só re-lançam erro se não houver dados locais. Todas as leituras OK re-espelham o resultado.

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
- `toggleEntered`: alterna `isEnteredInLegacy` (mesmo `CountedItem`). **Limite consciente**: se o pedido tem `finish-order` na fila offline, o toggle não é enfileirado — a entrada no legado é conferida após o sync.
- `finishOrder` → Promise\<boolean>: guarda `status === 'Rascunho'`; `clearDebounce` → `markDirty` → `enqueuePersist` (flush) → update `orders` para `Concluido` → `commitSyncedOrder(completed)` → notify + navega para `entry`; `App.tsx` faz `bumpReport()` se `true`. `finishing` é estado da sessão. **Offline**: enfileira `finish-order` na `offlineQueue`, dá notify, navega para `entry` e retorna `true` (o `bumpReport` ocorre; o status no servidor é aplicado no flush).
- `newCount`: flush do rascunho se houver, insere novo `Rascunho`, limpa `items`/requester/notes/`savedAt`, navega para `count`. **Offline**: cria o pedido otimista com `newId()` (uuid do cliente) e enfileira `create-order` — só funciona quando a sessão já estava ativa; ir offline antes do primeiro login exige rede.
- `selectStore` / `selectOrder`: flush + trocam contexto; `selectOrder` recarrega os `order_items`.
- `saveNow`: flush manual imediato (mesmo debounce/chain).
- `refreshCurrentOrder`: reconcilia o pedido corrente após o flush da fila (chama `commitSyncedOrder` com o pedido vindo do servidor para limpar `dirty`/guard do realtime e atualizar `items`).

## PWA e offline

- **Service Worker** (Workbox `generateSW`, `vite-plugin-pwa`): `registerType: 'prompt'`, precache JS/CSS/icons, `cleanupOutdatedCaches`, `navigateFallback: '/index.html'` (SPA de rota única) com `navigateFallbackDenylist` para não servir HTML a requisitos de API.
- **`runtimeCaching`**:
  - navegação → **NetworkFirst** (`navigation-cache`);
  - GETs cross-origin do Supabase **só de catálogo** (`stores|categories|products|product_variations`) → **NetworkFirst** + TTL 7d (`catalog-cache`);
  - dados sensíveis (`orders`, `order_items`, `profiles`, `vw_product_suggestions`, relatório) **nunca** em cache.
- **Ciclo de vida**: `src/pwa.ts` registra via `virtual:pwa-register` (`onNeedRefresh`/`onOfflineReady`) e expõe `setupPWA`/`subscribePWA`/`applyUpdate` (+ dismiss). `PwaUpdatePrompt` mostra banner "Nova versão disponível" (Atualizar → `applyUpdate` = skipWaiting + reload; Depois → dismiss) e "Pronto para uso offline".
- **Fila de ações** (`lib/offlineQueue.ts`, IndexedDB `pedidos-pwa`/store `queue`):
  - `persist-draft` → update `orders` + delete+insert `order_items` (mesmo formato do persist online, snapshot descartando `quantity <= 0`);
  - `finish-order` → status `Concluido`;
  - `create-order` → insert de pedido com `id` gerado pelo cliente (`newId()`).
  - Dedupe: `persist-draft` substitui o anterior do mesmo pedido; é ignorado se já existe `finish-order` do mesmo pedido; `finish-order` substitui o anterior.
  - `flushQueue` replay com o cliente supabase **vivo** (sessão fresca → evita 401 de JWT expirado), em ordem de `createdAt`, parando em falha de rede (resto permanece na fila). `isOffline`/`isOfflineError` detectam o cenário.
- **Integração**: `persistOrder` enfileira `persist-draft` quando offline (sem toast repetido); `finishOrder`/`newCount` como nas Ações; `Dashboard` usa `useOnline` e no `offline→online` chama `flushQueue()` + `notify('Alterações sincronizadas.')` + `refreshCurrentOrder()`.
- **Leitura offline (espelho)** (`lib/localCache.ts`, IndexedDB `pedidos-pwa` v2, store `mirror`): pedidos por loja, itens por pedido (`{key, quantity, isEnteredInLegacy}`), sugestões, última contagem, relatório e perfil por usuário. Estratégia **servidor 1º, espelho fallback**: as leituras só caem para o espelho em falha offline (`isOffline`/`isOfflineError`) e re-espelham a cada sucesso. `updateOrderInStore`/`cacheCountedItems` gravam também nas escritas (online, offline/otimista e pós-flush) — abrir offline mostra o estado da última sincronização, inclusive ações ainda na fila.
- **Fora da fila (exigem rede)**: escrita de catálogo (`CatalogBoard`/`CollaboratorsBoard`) e `toggleEntered` de pedido com `finish-order` pendente.

## `useStoreReports` — última contagem e relatório

- **`lastOrder`**: último pedido com `status = 'Concluido'` (1 registro, `updated_at desc`); itens mapeados via `mapOrderItems` em `LastOrderData`. Leitura OK grava `cacheLastOrder`; falha offline lê `readLastOrder` e rematerializa os itens contra o catálogo.
- **`report`** (tudo por loja; token `reportToken` + `cancelled` descartam corridas):
  - `monthOrders` — nº de pedidos com `created_at` a partir do 1º dia do mês (qualquer status);
  - `weekVariationPct` — soma de `quantity` dos últimos 7 dias × os 7 dias anteriores (janelas de `created_at`); `null` quando a anterior é 0;
  - `topProducts` — agrega `quantity` dos últimos 30 dias por `itemKey` (top 10), `label` = nome do produto + variação; `topProduct` = primeira entrada.
- Falhas são silenciosas (relatório auxiliar não bloqueia o app); em falha **offline** lê `readLastOrder`/`readReport` do espelho. `bumpReport()` força recarga; `App.tsx` o chama após `finishOrder` bem-sucedido.

## Telas — comportamentos notáveis

- **`CatalogBoard` (tab Cadastro, só `admin`)**: CRUD de lojas/categorias/produtos/variações com escrita **direta no Supabase** (fora do `useStoreSession`; sem chain/persist). Cada operação chama `refreshCatalog` (= `loadCatalog`, recarrega o catálogo) e mostra toast. Nova categoria usa `display_order = max + 1` (ou 1 se vazio); novo produto usa `max display_order` dos produtos da categoria selecionada + 1; preço/ordem via `parseNumber`. Produtos do catálogo carregam por `display_order` (depois `name`) — a contagem exibe cada categoria nessa ordem.
- **`CollaboratorsBoard` (tab Cadastro, só `admin`)**: gerencia usuários. Card "Cadastrar Novo Colaborador" usa `supabase.auth.signUp` com `options.data` (`username`/`full_name`/`store_id`/`role`) — o trigger `handle_new_user` do banco cria o perfil automaticamente; um `profiles.update().eq('id', data.user.id)` best-effort faz a reconciliação sem travar. Username é obrigatório (minúsculo, sem espaços); e-mail é opcional — se vazio, gera `${username}@sistema.local`. Antes do signUp captura a sessão do admin e, se o Supabase trocar a sessão para o novo usuário, restaura a sessão do admin via `supabase.auth.setSession` (não usa service role nem `auth.admin.*`). Lista os perfis (exceto o próprio `currentUserId`) e permite alterar `store_id`/`role` e revogar/restaurar acesso via `profiles.is_active`.
- **`CountingBoard`**: trava edição quando `orderStatus !== 'Rascunho'`. Categorias colapsáveis (cabeçalho **e** rodapé alternam o estado); busca por nome/código de produto filtrada em cada categoria. Por variação exibe "Último: N un" (do `lastOrder`), "Sugestão: N" (só com `counted === 0`; clicar aplica a quantidade sugerida via `onSetQuantity` com `stopPropagation`) e aviso "⚠️ Acima do habitual" quando `counted > lastQty * 2` (rascunho).
- **`DataEntryBoard` (Digitação)**: lista apenas itens com `quantity > 0`, ordenados por `compareByEntryCode` (PLU/SKU numérico → nome da variação); progresso "digitados/total"; botão "Copiar Resumo em Texto" usa `buildOrderSummary` + `copyTextToClipboard`.
- **`ComparisonBoard`**: unifica por `itemKey` (item só de um lado entra com 0 no outro), ordena por nome da label; mostra KPIs e top produtos do `report`.

## Regras de vigilância

- Siga o **padrão de atuação do agente** do `AGENTS.md`: atualize contextos afetados a cada alteração, não mude comportamentos do app sem autorização prévia e pergunte ante instrução ambígua.
- Não trocar o debounce (700ms), o guard (`saving || dirty || <1500ms`) nem o delete+insert dos itens sem motivo — são decisões base de concorrência.
- Ao mexer na fila offline, preserve: ordem `createdAt` no flush, replay com o cliente supabase vivo (evita 401 de JWT) e a reconciliação `refreshCurrentOrder`/`commitSyncedOrder` (limpa `dirty`/guard, senão a fila "prende" o realtime).
- Ao mexer no espelho (`localCache`), preserve a estratégia **servidor 1º, espelho fallback**: re-espelhar só após sucesso e cair para o espelho apenas em falha offline — não mascarar erros reais com dados velhos.
- Fora da fila (exigem rede) continua: escrita de catálogo e `toggleEntered` de pedido com `finish-order` pendente — não "consertar" sem autorização.
- Manter os callbacks estáveis que só leem refs (`shouldSkipSync`) e desestruturar handles estáveis do sub-hook nos deps das ações.
- Sub-hooks novos devem receber estados/setters por parâmetro; o orquestrador segue dono dos estados.
