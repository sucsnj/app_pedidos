# AGENTS.md

Contexto imediato para agentes que trabalham neste repositório. Leia este arquivo; consulte `docs/architecture.md` (mecânica dos hooks/fluxos) e `docs/data-model.md` (schema do banco) quando precisar de profundidade — o comando `/context` injeta ambos de uma vez, e a skill `app-context` cobre tarefas de persistência/realtime/schema.

## O que é

`pedidos-abastecimento`: app mobile-first de contagem e pedidos de abastecimento por loja. Uma contagem é um pedido (`orders`) com itens (`order_items`); o usuário digita quantidades, finaliza (`Concluido`) e depois há lançamento (`Lancado`).

## Stack e scripts

- React 19, TypeScript 5.6, Vite 6, Tailwind 4 (`@tailwindcss/vite`), `@supabase/supabase-js` (com generic tipado), `@supabase/ssr`, `lucide-react`, `react-router-dom` v7 (rotas da SPA), Vitest 5 (testes unitários). PWA via `vite-plugin-pwa` (Workbox `generateSW`) + `@vite-pwa/assets-generator` (ícones a partir de `pwa-assets/icon.svg`).
- Testes: `npm test` (`vitest run`), arquivos `src/**/*.test.ts(x)`, config em `vitest.config.ts` (ambiente `node` por padrão; `jsdom` por arquivo via `@vitest-environment`; `fake-indexeddb` para a fila offline).
- Sem config de ESLint (há `// eslint-disable` apenas de legado).
- Scripts (`npm run`):
  - `dev` — Vite dev server.
  - `build` — `tsc -b && vite build`.
  - `typecheck` / `lint` — `tsc -b --noEmit` (idênticos).
  - `test` — `vitest run` (unitários do `lib/`).
- Para rodar: `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (obrigatório, o `lib/supabase.ts` lança erro sem elas).

## Arquitetura (visão geral)

`src/App.tsx` (176 linhas) é o orquestrador que **compõe hooks** e renderiza telas:

- Hooks: `useAuth` (sessão Supabase), `useCatalog` (catálogo + reload/refresh), `useFlash` (toast; `notify` é estável), `useStoreReports` (relatório/última contagem), `useStoreSession` (sessão da contagem corrente).
- `App.tsx` é o **gate de autenticação**: `useAuth` decide entre `LoginScreen` (anônimo) e `AppShell` (logado). Após o login, o próprio `App.tsx` consulta `public.profiles` (`maybeSingle()` por `user.id`, falha de leitura não bloqueia), define `userRole` (`profile?.role || 'gerente'`) e faz `console.log("Dados do Perfil no Supabase:", profile, "Erro:", error)` para depuração.
- **Rotas** (`react-router-dom` v7, `BrowserRouter` em `main.tsx`): `AppShell` monta a `TopNav` (navbar de seções) + `<Routes>`; as seções são declaradas em `lib/sections.ts` (`APP_SECTIONS`). `/orders` → `Dashboard` (tela atual de pedidos, com as abas internas); `/management` → `SectionPlaceholder` ("em construção"); rota desconhecida → redireciona para `DEFAULT_SECTION_PATH` (`/orders`).
- `useStoreSession` (~394 linhas) **é dono dos estados** e compõe dois sub-hooks: `useDraftPersistence` (autosave/persistência) e `useRealtimeOrder` (subscription Supabase). Contrato de retorno deve permanecer intacto — o orquestrador (`Dashboard`) destrutura tudo; adições são permitidas (ex.: `refreshCurrentOrder` para reconciliar o pedido corrente após o flush da fila offline).
- Boards (`components/`): `CountingBoard`, `DataEntryBoard`, `CatalogBoard`, `ComparisonBoard` — sem estado próprio de sessão, recebem props.
- Camada pura: `lib/orders.ts` concentra regras de contagem/pedidos (sem dependência de React). Utils genéricos em `lib/utils.ts` (`getErrorMessage`).
- Tipos: `types/app.ts` (domínio da UI/sessão) e `types/database.ts` (linhas do banco + `Database` para o supabase-js).

### Mapa de módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Gate de autenticação: `useAuth` decide entre `LoginScreen` (anônimo) e `AppShell` (logado); consulta `public.profiles`, define `userRole` e desloga perfil `is_active = false` |
| `src/components/AppShell.tsx` | Shell das rotas: `TopNav` + `<Routes>` (uma rota por `APP_SECTIONS`); `/orders` → `Dashboard`, demais → `SectionPlaceholder`; rota desconhecida → `/orders` |
| `src/components/TopNav.tsx` | Navbar de seções (marca + links `NavLink` + usuário/cargo/Sair) — compartilhada por todas as rotas |
| `src/components/SectionPlaceholder.tsx` | Conteúdo genérico "em construção" (ícone, título, descrição, selo) — reusado por seções de rota e por abas |
| `src/lib/sections.ts` | Registro das seções/endpoints (`APP_SECTIONS`: `path`, `label`, `icon`, `description`, `ready`) + `DEFAULT_SECTION_PATH` |
| `src/lib/salesMetrics.ts` | Service puro do cálculo de vendas: `normalizeSalesPayload` (validação → 400), `buildSalesPayloadFromForm` (formulário → payload), `calculateSalesMetrics` (regras de negócio), `percentageOf`, `round2`, `processSalesPayload` |
| `src/lib/salesStore.ts` | Persistência do módulo de Gestão: `fetchSellers`/`createSeller`/`updateSeller`/`deactivateSeller` (**soft delete**: `is_active = false`, preserva o histórico), `fetchHistory`, `fetchSalesRecords`, `deleteCalculation` (cascade), `recordSales` (snapshot + vendas) — tudo escopado por loja |
| `src/types/sales.ts` | DTOs do módulo de vendas (`SalesPayload`, `SalesItemInput`, `SalesSummary`, `SalesReportItem`, `SalesMetricsResult`, `SalesValidationError`) |
| `src/hooks/useSalesManagement.ts` | Controller do módulo: vendedores (do banco, **da loja selecionada**), valores do período, meta, data, histórico e **cálculo derivado** (`useMemo` — instantâneo); `addSeller`/`renameSeller`/`bindSeller`/`removeSeller`/`loadHistory`/`removeHistory`/`register` (o erro 400 **só** aparece ao registrar); `registered`/`hasValues` controlam a troca entre os botões "Registrar vendas" e "Novas vendas" |
| `src/components/SalesSellersCard.tsx` | Card 3 da tela: cadastro/edição/**desativação** de vendedores (grava no banco; desativar pede `window.confirm` e preserva o histórico) + valor na mesma célula (com eco do valor lido), botão "Limpar valores" e ação "Vincular a esta loja" para os vendedores sem loja (`store_id is null`); lista em colunas (`sm:grid-cols-2 xl:grid-cols-3`, células com borda) |
| `src/components/SalesHistoryPanel.tsx` | Card 4 da tela: histórico de consolidações (do banco): **clicar carrega** o lançamento no formulário + botão de **exclusão** (cascade); mostra total, % da meta e o **melhor vendedor com sua %** (calculada do snapshot `top_sale` sobre a base) |
| `src/components/CollapsibleCard.tsx` | Card expansível/colapsável genérico: estado (aberto/fechado) persistido no `localStorage` (`pedidos:card:<chave>`) |
| `src/components/SalesMetricsPanel.tsx` | Card 1 da tela: data de referência, meta, erro 400 (só ao registrar) e o botão contextual — "Registrar vendas" (quando há valores) ou "Novas vendas" (após registrar; limpa os campos) |
| `src/components/SalesResultCard.tsx` | Card 2 da tela: indicadores do cálculo (total, base, meta, ticket médio, registros, atingimento, maior venda) + detalhamento por vendedor |
| `src/hooks/useStoreSelection.ts` | Seleção de loja para telas fora da sessão de pedidos (busca `stores`; **admin** usa a preferência do navegador, **gerente** fica preso à loja do perfil); `storeId`/`selectStore`/`resolved` (a carga só começa após a resolução — evita ler todas as lojas) |
| `src/lib/storePreference.ts` | Preferência de loja por usuário (`localStorage`, `pedidos:selectedStore:<userId>`) — compartilhada por `/orders` e `/management` |
| `src/components/ManagementScreen.tsx` | Tela da rota `/management` (barra vinho com o **mesmo seletor de loja** do `/orders` + abas próprias `TabsBar`: **Vendas** e **Comparação** — esta última "em construção"); `main` com `pb-12 lg:pb-16` e rodapé de contexto (loja + nº de lançamentos) |
| `src/hooks/useAuth.ts` | Sessão Supabase (`getSession` + `onAuthStateChange`), `signIn`/`signOut` |
| `src/hooks/useStoreSession.ts` | Orquestrador: estados do pedido corrente, carga da loja, ações |
| `src/hooks/useDraftPersistence.ts` | Persistência/autosave: refs espelhadas, debounce 700ms, chain de persist, `flushDraft` (grava sem toast, usado no unmount da tela) |
| `src/hooks/useRealtimeOrder.ts` | Subscription Supabase por pedido + reload no guard |
| `src/hooks/useCatalog.ts` | Catálogo (stores, categories, products, variations) + `reload`/`refresh`; espelha no `localCache` e, sem rede, cai para o espelho (`readCatalog`) |
| `src/hooks/useFlash.ts`, `useStoreReports.ts` | Suporte: notificações, relatório |
| `src/lib/orders.ts` | Regras puras: mapear itens, contar, mesclar pedidos, `orderLabel` |
| `src/lib/offlineQueue.ts` | Fila de ações offline (IndexedDB `pedidos-pwa/queue`): `enqueuePersistDraft`, `enqueueFinishOrder`, `enqueueCreateOrder`, `removeDraftForOrder` (descarta o rascunho enfileirado após o persist online), `flushQueue(force?)`, `listPending`/`pendingCount`, `subscribePending` (contador em tempo real), `isOffline`/`isOfflineError` (detecção por `navigator.onLine` + mensagem de rede: `PostgrestError` "Failed to fetch"/"fetch failed", `AbortError`, `TypeError`) |
| `src/lib/localCache.ts` | Espelho local p/ leitura offline (IndexedDB `pedidos-pwa/mirror`, DB v2): **catálogo**, pedidos por loja, itens por pedido (`{key, quantity, isEnteredInLegacy}`), sugestões, última contagem, relatório, perfil; `openDB`/`withDB` compartilhados com a fila |
| `src/lib/supabase.ts` | Cliente Supabase tipado com fetch + timeout de 10s (falha rápido em "conectado sem internet") |
| `src/pwa.ts` | Registro do SW (`setupPWA`), estado de atualização/offline-ready e `applyUpdate` (bridges via `subscribePWA`) |
| `src/hooks/useOnline.ts` | Hook de conectividade (`navigator.onLine` + eventos online/offline) |
| `src/hooks/usePendingSync.ts` | Hook do contador de ações pendentes na fila (assina `subscribePending`) |
| `src/components/PwaUpdatePrompt.tsx` | Banners "Nova versão disponível" (Atualizar/Depois) e "Pronto para uso offline" |
| `src/components/OfflineBanner.tsx` | Banner "Sem conexão…" (mensagem configurável via prop — o `/management` avisa que vendedores/histórico exigem rede) |
| `src/components/SyncBanner.tsx` | Banner "X alterações aguardando sincronização" + botão "Sincronizar" (auto-flush em 20s) |
| `src/lib/orderText.ts` | Resumo do pedido em texto p/ colar (legado/WhatsApp) — `buildOrderSummary` + `copyTextToClipboard` |
| `src/lib/utils.ts` | `getErrorMessage`, datas pt-BR (`formatDate`/`formatDateTime`), `parseNumber`, `emptyText` |
| `src/types/app.ts` | `Catalog`, `CountedItem`, `ItemKey`, `SuggestionsMap`, `TabId`, flash/report, `compareByEntryCode`, `SYNTHETIC_VARIATION_ID`/`defaultVariationForProduct` |
| `src/types/database.ts` | Tipos de tabelas + interface `Database` |
| `src/components/*` | Header, nav, telas (loading/error), toast, status bar, boards |
| `src/components/Dashboard.tsx` | Conteúdo autenticado: compõe hooks de sessão/catálogo e renderiza telas; aplica RBAC por cargo |
| `src/components/LoginScreen.tsx` | Tela de login (email/senha via `signInWithPassword`), erros visuais e indicador de carregamento |
| `src/components/CollaboratorsBoard.tsx` | Gestão de usuários (visível só p/ `admin`): cadastra gerente (`auth.signUp` + `profiles`, restaurando a sessão do admin) e lista/edita loja, cargo e acesso. Cards colapsáveis com cabeçalho no mesmo estilo do `Section` do `CatalogBoard` |
| `src/components/AppHeader.tsx` | Cabeçalho da seção Pedidos: seletor loja/pedido, "Nova contagem" e indicador `saving` (marca, usuário/cargo/Sair ficam na `TopNav`) |
| `src/components/StoreSelect.tsx` | Seletor de loja **compartilhado** por `/orders` (`AppHeader`) e `/management` (mesmo componente, estilo e posição) |
| `src/components/TabsBar.tsx` | Barra de abas genérica (genérica em `T`, sticky, mesmo visual das abas do `/orders`); `renderTabExtra` permite ação extra após uma aba (botão "Concluir Pedido") |
| `src/components/AppNav.tsx` | Abas do `/orders` (Contagem/Digitação/Cadastro/Comparativo) sobre `TabsBar` + botão "Concluir Pedido" logo à direita da aba Contagem |
| `src/components/CountingBoard.tsx` | Categorias colapsáveis (estado local; cabeçalho **e** rodapé alternam o colapso), campo de busca por nome/código de produto (ao lado de "Salvar rascunho", desabilitado quando travado), sugestão por item clicável (aplica a quantidade sugerida via `onSetQuantity`), nome do item em `text-base` |
| `src/components/CatalogBoard.tsx` | Seções colapsáveis (`Section` reutilizada por Lojas/Categorias/Produtos/Variações); formulário de produto com chips de variações + exclusão manual de variações + campo **Ordem** (criação e edição) |

### Telas e fluxo de uso

`TabId`: `count` | `entry` | `catalog` | `comparativo`.

| Tab/screen | Componente | O que faz |
| --- | --- | --- |
| Login (`login`) | `LoginScreen` | Cartão de login (usuário ou e-mail via `signInWithPassword`; username resolvido em `public.profiles`), fundo claro, topo `#7C0F19` com detalhes `#FECB1A`, erros visuais e indicador de carregamento |
| Contagem (`count`) | `CountingBoard` | Digita quantidades (+/− via `adjust`; digitação direta via `setQuantity`), nome/notas (`requesterName`/`notes`), salvar manual (`saveNow`), busca de produtos por nome ou código, sugestões por item (click aplica a quantidade), indicadores `saving`/`savedAt`, última contagem |
| Digitação (`entry`) | `DataEntryBoard` | Lista itens com quantidade (ordenados por PLU/SKU via `compareByEntryCode`), progresso X/Y, alterna `isEnteredInLegacy` (`toggleEntered`) e "Copiar Resumo em Texto" (`buildOrderSummary`) |
| Cadastro & Produtos (`catalog`, só `admin`) | `CatalogBoard` + `CollaboratorsBoard` | CRUD do catálogo (lojas/categorias/produtos/variações) gravando **direto no Supabase** e gestão de usuários (cadastro de gerente, edição de loja/cargo, revogar acesso). Formulário de produto com **chips de variações** (selecionar/desmarcar sincroniza vínculos; desmarcar não exclui). Produtos reordenáveis por categoria (`display_order`, campo Ordem, auto = max da categoria + 1) |
| Comparativo (`comparativo`) | `ComparisonBoard` | Compara a contagem corrente com a última (`lastOrder`) e mostra o `report` (pedidos do mês, top produto, variação semanal, top produtos) — definições no `architecture.md` |
| Header | `AppHeader` | Troca loja (`selectStore`, seletor só p/ `admin`, escolha lembrada em `localStorage`), escolhe pedido (`selectOrder`), nova contagem (`newCount`), indicador `saving` |
| Navegação | `AppNav` | Tabs + botão "Concluir Pedido" à direita da aba "Contagem" (`handleFinishOrder` → `finishOrder` + `bumpReport`) se `canFinish` |
| Navbar de seções | `TopNav` | Marca do app + links `NavLink` para as seções (`APP_SECTIONS`), nome do usuário (toque mostra o nome completo em popover ~2,5s), badge de cargo (ADMIN/GERENTE) e botão Sair (`signOut`) — visível em **todas** as rotas |
| Rota `/management` | `ManagementScreen` + abas próprias (`TabsBar`: **Vendas** e **Comparação** — esta última mostra "em construção") | Cabeçalho com **seletor de loja** (admin escolhe; gerente vê a loja do perfil). Aba "Vendas" = Cálculo (2/5) e Vendedores (3/5) lado a lado em `xl` (grid `minmax(0,2fr)`/`minmax(0,3fr)`), Resultado e Histórico em largura total; abaixo de `xl` empilham (Vendedores logo abaixo de Cálculo). **Vendedores persistidos no banco** (`sellers`): cadastro/edição/exclusão e valor vendido na mesma célula. Cálculo em tempo real (data de referência + meta) → resumo e `salesReport` com `percentage`. "Registrar vendas" grava `sales_calculations` (com `store_id` da loja selecionada) + `sales_records` — **histórico** (clicar carrega o lançamento; lixeira exclui). Seção placeholder (`SectionPlaceholder`) continua como fallback para seções sem implementação |
| Barra de status | `MobileStatusBar` | Resumo: loja, total contado, pedido corrente |
| Toast | `FlashToast` | Notificações via `useFlash` (`notify`) |

- `locksOrder` = `currentOrder !== null && currentOrder.status !== 'Rascunho'` — trava edição quando o pedido não é rascunho.
- Concluir um pedido navega para `entry` ("Modo Digitação"); em seguida o `comparativo` compara com a última contagem.
- **Layout responsivo**: container de `Header`/`Nav`/`main` é `max-w-3xl` (mobile-first) alargando em `lg:max-w-5xl`/`xl:max-w-6xl`/`2xl:max-w-7xl`; no widescreen a Prancheta mostra produtos por categoria em 2–3 colunas (`lg:grid-cols-2 xl:grid-cols-3`) e a Digitação em 2 colunas (`lg:grid-cols-2`). Listas em colunas usam **bordas nas células** (`border-l border-t` no contêiner + `border-b border-r` na célula) — **nunca** `bg-gray-100` no contêiner do grid, senão as colunas vazias da última linha ficam cinzas (visual quebrado).
- **Grid no layout**: track `1fr` é `minmax(auto,1fr)` → o mínimo da coluna é o **min-content** dos itens, e o grid estourra o contêiner. Use `minmax(0,…)` nas tracks (`xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`) **e** `min-w-0` nos itens do grid — vale para page-level e para as listas internas dos cards.

## Regras de domínio (resumo)

- **status** do pedido: `Rascunho` → `Concluido` → `Lancado` (valores exatos do banco, sem acento em "Concluido").
- **Autenticação/perfil**: `useAuth` gerencia a sessão (`getSession` + `onAuthStateChange`); após o login, `App.tsx` consulta `public.profiles` (`id`, `email`, `username`, `full_name`, `store_id`, `role`, `is_active`) e define `userRole`. Login aceita username ou e-mail — sem `@`, o `LoginScreen` resolve o e-mail via `profiles.username`. Perfil ausente assume `gerente`; perfil com `is_active = false` é deslogado.
- **Cargos (RBAC)**: `admin` acessa todas as abas (Contagem, Digitação, Cadastro & Produtos, Comparativo) e o seletor de qualquer loja. `gerente` vê apenas Contagem e Digitação, fica vinculado à `store_id` do perfil (sem seletor de loja) e gerencia colaboradores nunca — cadastro/edição de usuários só na aba Cadastro, exclusiva do `admin`.
- **Cadastro de usuário**: `CollaboratorsBoard` (aba 3) usa `supabase.auth.signUp` (sem service_role) com `options.data` (`username`/`full_name`/`store_id`/`role`); o trigger `handle_new_user` cria o perfil e um `profiles.update().eq('id', data.user.id)` best-effort faz a reconciliação (sem `upsert`, não trava o formulário). Username é obrigatório (minúsculo, sem espaços); e-mail é opcional — se vazio, gera `${username}@sistema.local`. Se o Supabase trocar a sessão para o novo usuário, restaura a sessão do admin via `setSession`. Revogação = `profiles.is_active = false`.
- **`itemKey`** identifica um item contado: `` `${productId}::${variationId}` ``.
- **Variação sintética**: produtos sem variações cadastradas usam `id: ''` (`SYNTHETIC_VARIATION_ID`); `defaultVariationForProduct` gera essa variação na hora.
- **Variações do produto (Cadastro)**: o formulário de produto usa **chips** com nomes globais únicos de `product_variations` (busca no load + merge com `catalog.variations`). Salvar sincroniza vínculos do produto: cria variação faltante (`price: 0`, `is_available: true`), reativa (`is_available = true`) e **desmarcar só desativa** (`is_available = false`) — nunca deleta. Exclusão manual apenas na seção "Variações / Pesos" (lixeira, com `confirm`).
- **Persistência**: a cada save, atualiza o `orders` e reescreve os `order_items` (delete + insert) com `is_entered_in_legacy`.
- **Preferência de loja**: a troca manual de loja (`selectStore`, seletor só p/ `admin`) grava em `localStorage` (`pedidos:selectedStore:<userId>`) e a carga a respeita (validada contra o catálogo). `gerente` não grava e fica **preso à `store_id` do perfil** (vale para `/orders` e `/management`) — a preferência gravada por um admin não pode deslocar o gerente para outra loja.
- **Sugestões**: vêm da view `vw_product_suggestions` por loja; `fetchSuggestions` recarrega ao trocar de loja e ao "nova contagem" (`newCount`) — sem precisar de F5; exibidas quando o item ainda não tem quantidade.
- **Ordenação da digitação**: `compareByEntryCode` — por código PLU/SKU (numérico) e depois nome da variação.
- **Resumo em texto**: `buildOrderSummary` (`lib/orderText.ts`) gera o pedido para colagem (WhatsApp/legado), com ordem PLU/SKU; `copyTextToClipboard` tem fallback via `document.execCommand`.
- **Lista de pedidos**: máx. 25 por loja, ordenada por `updated_at desc`.

## PWA e offline

- **Service Worker**: Workbox `generateSW` via `vite-plugin-pwa` (`vite.config.ts`) com `registerType: 'prompt'`, precache automático (JS/CSS/icons), `cleanupOutdatedCaches`, `navigateFallback: '/index.html'` e `navigateFallbackDenylist` para não servir HTML para requisitos de API.
- **Caching** (`runtimeCaching`): navegação **NetworkFirst** (`navigation-cache`); GETs cross-origin do Supabase **só de catálogo** (`stores|categories|products|product_variations`) em **NetworkFirst** + TTL 7d (`catalog-cache`). Dados sensíveis (`orders`, `order_items`, `profiles`, `vw_product_suggestions`, relatório) **nunca** entram em cache.
- **Ciclo de vida**: `src/pwa.ts` registra via `virtual:pwa-register` (`onNeedRefresh`/`onOfflineReady`); `PwaUpdatePrompt` mostra "Nova versão disponível" (Atualizar/Depois) e "Pronto para uso offline".
- **Fila de ações offline** (`lib/offlineQueue.ts`, IndexedDB `pedidos-pwa/queue`): `persist-draft` (update orders + delete+insert items, mesmo formato do persist online), `finish-order` (status `Concluido`), `create-order` (id otimista uuid do cliente). `flushQueue` replay com o cliente supabase vivo (sessão fresca → evita 401 de JWT expirado) em ordem de `createdAt`, parando em falha de rede. `isOffline`/`isOfflineError` detectam o cenário — a detecção casa falha de rede por mensagem além do `TypeError` (supabase-js v2 devolve `PostgrestError` "Failed to fetch"), e o cliente Supabase (`lib/supabase.ts`) aborta requisições após 10s para não travar em "conectado sem internet".
- **Rascunho pendente x persist online**: quando o persist online conclui, ele **descarta** o `persist-draft` enfileirado do mesmo pedido (`removeDraftForOrder`) — sem isso o replay posterior sobrescreveria o estado mais novo do servidor. O `flushQueue` ainda reconfirma a presença da ação na fila antes de aplicá-la (`isQueued`), para não reaplicar um snapshot já obsoleto.
- **Integração**: `persistOrder` enfileira `persist-draft` (sem toast repetido); `finishOrder` enfileira `finish-order` e navega para Digitação; `newCount` cria pedido otimista e enfileira `create-order`. Após o flush, `refreshCurrentOrder` reconcilia pedido corrente via `commitSyncedOrder` (limpa `dirty`/guard do realtime).
- **Sync com feedback (independe de `navigator.onLine`)**: `subscribePending` emite o contador real da fila a cada enqueue/flush → `usePendingSync` alimenta o `SyncBanner` ("X alterações aguardando sincronização" + botão "Sincronizar"). O `Dashboard` sincroniza no mount, na transição offline→online (evento `navigator`) e a cada 20s enquanto houver pendência online — `flushQueue(force)` ignora o guard offline para o botão/retry funcionarem mesmo com o `navigator.onLine` defasado (WiFi "conectado" sem internet). Toast "Alterações sincronizadas." + `refreshCurrentOrder` só no sucesso.
- **Leitura offline (espelho)**: `lib/localCache.ts` (IndexedDB `pedidos-pwa`, DB v2, store `mirror`) guarda **catálogo**, pedidos por loja, itens por pedido (serializados `{key, quantity, isEnteredInLegacy}` e rematerializados contra o catálogo), sugestões, última contagem, relatório e perfil. Estratégia **servidor 1º, espelho fallback**: sessão (`useStoreSession`), **catálogo (`useCatalog`)**, relatórios (`useStoreReports`) e perfil (`App.tsx`) só leem o espelho quando a leitura falha por offline (`isOffline`/`isOfflineError`); toda leitura/escrita OK atualiza o espelho (`cacheCatalog`, `cacheOrders`, `cacheCountedItems`, `cacheSuggestions`, `cacheLastOrder`, `cacheReport`, `cacheProfile`, `updateOrderInStore`). Catálogo também é servido pelo cache do SW (NetworkFirst, TTL 7d) em produção.
- **Offline não é erro**: o `Dashboard` só mostra a tela de erro quando a carga **falhou de verdade**; ficar offline (com os dados espelhados) mantém o app em uso com o banner "Sem conexão…".
- **Fora da fila (exigem rede)**: escrita de catálogo (`CatalogBoard`) e `toggleEntered` de pedido já agendado para concluir — limites conscientes.

## Fontes de verdade (onde procurar)

- **Schema/colunas**: `src/types/database.ts` — canônico (alimenta o generic do supabase-js). `docs/data-model.md` resume a semântica — se conflitar, vale o tipo.
- **Regras de contagem/pedidos**: `src/lib/orders.ts` (funções puras, sem React).
- **Regras de vendas/métricas**: `src/lib/salesMetrics.ts` (service puro, com testes em `salesMetrics.test.ts`) + DTOs em `src/types/sales.ts`; persistência em `src/lib/salesStore.ts` (tabelas `sellers`, `sales_calculations`, `sales_records` — DDL em `supabase/migrations/`).
- **Resumo em texto / digitação**: `src/lib/orderText.ts` (formato ordenado por código) + `compareByEntryCode` em `types/app.ts`.
- **Utils genéricos**: `src/lib/utils.ts` (`getErrorMessage`, datas, `parseNumber`, `parseNumberOrNull`, `newId`, `emptyText`, `formatCurrency`, `formatPercentage`).
- **PWA/offline**: `src/lib/offlineQueue.ts` (fila de ações) + `src/lib/localCache.ts` (espelho de leitura) + `src/pwa.ts` (ciclo de vida do SW) + `vite.config.ts` (estratégias de cache).
- **Comportamento da sessão**: `src/hooks/useStoreSession.ts` + sub-hooks (`useDraftPersistence`, `useRealtimeOrder`); `docs/architecture.md` resume fluxos/invariantes.
- **Autenticação/perfil**: `src/hooks/useAuth.ts` (sessão) + `src/App.tsx` (consulta `public.profiles`, `userRole`) + `src/types/database.ts`.
- **Catálogo/notificações/relatório**: `src/hooks/useCatalog.ts`, `useFlash.ts`, `useStoreReports.ts`.
- **Domínio da UI**: `src/types/app.ts` (`Catalog`, `CountedItem`, `SuggestionsMap`, `TabId`, flash/report).
- **Banco efetivo**: não há migrations no repositório; o schema real vive no Supabase — `types/database.ts` é o contrato da aplicação.

## Convenções do código

- **Sem comentários** por padrão (exceto se solicitado); a regra pode ser sobrepujada quando regras do framework e/ou boas práticas de programação exigirem. Mensagens de UI em pt-BR.
- **Newline final** obrigatório em todo arquivo.
- TypeScript `strict` com `noUnusedLocals` e `noUnusedParameters` — imports/símbolos não usados quebram o build.
- Lógica pura vai em `lib/`; tipos de domínio em `types/`; um arquivo por hook/componente.
- **Sub-hooks recebem estado/setters por parâmetro**; o orquestrador segue dono dos estados. Nunca chamar hooks condicionalmente.
- **Identidade de callbacks importa**: callbacks que só leem refs devem ser estáveis (`useCallback([])`, ex.: `shouldSkipSync`) — se variarem, o channel do realtime pode re-subscribe (efeito dependent).
- Interfaces de `types/database.ts` precisam de `& Record<string, unknown>` para satisfazer o generic do supabase-js (padrão `Recordish`) — ao criar novos tipos `Insert`, siga esse padrão.
- Re-exports são usados para compatibilidade (ex.: `CatalogBoard` reexporta `FlashKind`) — manter ao mover símbolos.

## Estado do repo

- Branch: `pwa` — comporta a implementação PWA (manifest/SW, caches, ciclo de vida e fila de ações offline). Modularização concluída (`App.tsx` é o gate de auth; `Dashboard.tsx` ~conteúdo autenticado; `useStoreSession` ~460).
- `HEAD` base: `987acf9` ("melhorias para contexto de agentes e readme adicionado"). Autenticação B2B implementada (`useAuth`, `LoginScreen`, RBAC por cargo, `CollaboratorsBoard` com `auth.signUp` + restauração de sessão do admin + revogação). Detalhes por etapa no `PROJECT_STATUS.md`.
- Histórico relevante: "primeira etapa … fase final da refatoração de App" → "refatoração de hooks" → "contexto e memória para agentes" → "melhorias para contexto de agentes e readme adicionado".

## Padrão de atuação do agente

Sempre que fizer qualquer alteração:

- Atualize os documentos e o contexto para agentes afetados pelo que mudou (`AGENTS.md`, `docs/architecture.md`, `docs/data-model.md`, skills).
- Não faça ações destrutivas que mudem comportamentos do app sem autorização prévia.
- Siga as regras do projeto e do contexto do agente.
- Ante confusão ou falta de clareza nas instruções do prompt, pergunte para esclarecer antes de agir.

## Vigilância: evite regressões de comportamento

- Não altere o contrato de retorno de `useStoreSession` sem ajustar `App.tsx`.
- Não mude o debounce (700ms), o guard do realtime (`saving || dirty || <1500ms`) nem a estratégia delete+insert dos itens sem motivo — são decisões base de concorrência.
- Ao mexer na fila offline, preserve a ordem `createdAt`, o replay com o cliente vivo e a reconciliação via `refreshCurrentOrder`/`commitSyncedOrder` (evita 401 de JWT e fila "presa" com guard do realtime).
- Ao mexer no espelho (`localCache`), preserve a estratégia **servidor 1º, espelho fallback**: leituras espelham só após sucesso e caem para o espelho apenas em falha offline (`isOffline`/`isOfflineError`) — não mascarar erros reais com dados velhos.
- **Detecção de offline**: `isOfflineError` casa falha de rede por mensagem (`PostgrestError` "Failed to fetch"/"fetch failed", `AbortError`, `TypeError`) e o cliente Supabase aborta em 10s (`lib/supabase.ts`) — não restrinja a detecção só a `TypeError`, ou o app volta a exigir rede ao cair a conexão com sessão ativa.
- Ao mexer em hooks, valide com `npm run typecheck` e `npm run build`.

## Receita para mudanças seguras

1. Leia este `AGENTS.md`; abra `docs/architecture.md` (mecânica) e `docs/data-model.md` (schema) quando o trecho for sensível (persistência, realtime, tipos).
2. Mantenha as convenções: sem comentários por padrão (sobrepujado por regras do framework ou boas práticas), newline final, mensagens de UI em pt-BR.
3. Não mude contrato de `useStoreSession`, debounce 700ms, guard do realtime nem delete+insert sem justificativa.
4. Não chame hooks condicionalmente; sub-hooks recebem estados/setters por parâmetro; callbacks estáveis para não re-subscribe do channel.
5. Faça a alteração e valide: `npm run typecheck` e `npm run build`. Smoke opcional: `npm run dev`.
6. Preserve re-exports e o padrão `Recordish` (`& Record<string, unknown>`) ao tocar em tipos `Insert`.
7. Se o domínio mudar, atualize `AGENTS.md`/`docs/` — contexto obsoleto custa leitura de código.
