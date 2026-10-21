# PROJECT_STATUS.md

Status e histórico do projeto **pedidos-abastecimento**. Este arquivo alimenta a documentação e outros agentes de IA: ele mostra o que já foi implementado e o que ainda falta, por área e por etapa.

> Regra de manutenção: a cada mudança relevante, atualize esta seção de status e as checklists. Leia o `AGENTS.md` para o contexto geral do app.

## Visão geral

App mobile-first de contagem e pedidos de abastecimento por loja (React 19 + Vite 6 + Supabase). Uma contagem = pedido (`orders`) com itens (`order_items`); fluxo `Rascunho → Concluido → Lancado`.

## Funcionalidades já implementadas

### Autenticação & perfil (B2B)
- [x] Login por e-mail ou username (`useAuth` + `LoginScreen`), sessão Supabase com `getSession`/`onAuthStateChange`.
- [x] Consulta de `public.profiles` no login (`App.tsx`), definição de `userRole` (admin/gerente) e deslogar perfil `is_active = false`.
- [x] RBAC por cargo: `admin` (todas as abas + seletor de loja) e `gerente` (só Contagem/Digitação, preso à `store_id`).
- [x] `CollaboratorsBoard`: cadastro de colaborador (`auth.signUp` + `options.data`), restauração da sessão do admin e revogação/edição de acesso.

### Sessão de contagem (`useStoreSession`)
- [x] Carga de loja com preferência (`localStorage` `pedidos:selectedStore:<userId>` → perfil → primeira loja) e token anti-corrida.
- [x] Autosave com debounce de 700ms + chain de persistência (`useDraftPersistence`).
- [x] Escrita com `update` em `orders` e **delete + insert** em `order_items` (via `toOrderItemRows`, filtra `quantity > 0`).
- [x] Realtime por pedido (`useRealtimeOrder`) com guard `saving || dirty || <1500ms` (`shouldSkipSync` estável).
- [x] Ações: `adjust`, `setQuantity`, `toggleEntered`, `selectStore`, `selectOrder`, `newCount`, `finishOrder`, `saveNow`.

### Catálogo & relatórios
- [x] CRUD de lojas/categorias/produtos/variações (`CatalogBoard`, escrita direta no Supabase).
- [x] Sugestões por loja (`vw_product_suggestions`) com recarga ao trocar loja/nova contagem.
- [x] Última contagem e relatório mensal/semanal/top produtos (`useStoreReports` + `ComparisonBoard`).

## PWA — plano de implementação (por etapas)

Objetivo: comportamento completo de PWA — SW básico, Network First, Cache First, ciclo de vida, tela/rotas offline e filas de ações (background sync).

Decisões de design (validadas):
- **Offline completo, entregue por etapas** (shell → cache de leituras → fila de ações).
- **Atualização do SW**: modo `prompt` (não recarrega no meio da digitação).
- **Fila de ações em nível de app** (IndexedDB + cliente supabase com sessão fresca) — evita 401 de JWT expirado e preserva a ordem `delete+insert`.
- **Deploy**: Netlify, raiz `/` (`base: '/'`). Ícones gerados de `pwa-assets/icon.svg` (cores `#7C0F19`/`#FECB1A`).

### Etapa 0 — Preparação (Concluída)
- [x] Instalar `vite-plugin-pwa` e `@vite-pwa/assets-generator` (dev deps).
- [x] Gerar ícones para `public/` (`pwa-64/192/512`, `maskable-512`, `apple-touch-180`, `favicon.ico`) a partir de `pwa-assets/icon.svg`.
- [x] Criar `PROJECT_STATUS.md`.
- [ ] (a confirmar) Script `pwa:icons` para regenerar ícones.

### Etapa 1 — Shell PWA (Concluída)
- [x] `vite.config.ts`: plugin `VitePWA` (`registerType: 'prompt'`, manifest, workbox `cleanupOutdatedCaches` + `navigateFallback: '/index.html'`).
- [x] `src/main.tsx`: `setupPWA()` (registro SW via `virtual:pwa-register`).
- [x] `src/pwa.ts` + `src/components/PwaUpdatePrompt.tsx`: estado de atualização/offline-ready e banner "Nova versão disponível".
- [x] Tipos `vite-plugin-pwa/client` em `src/vite-env.d.ts`; metas/theme-color `#7C0F19` no `index.html`.
- [x] `public/_redirects` (`/* /index.html 200`) para SPA no Netlify.
- [x] Build valida `sw.js`/`manifest.webmanifest`/precache em `dist/`.

### Etapa 2 — Estratégias de cache + offline (Concluída)
- [x] `runtimeCaching`: navegação **NetworkFirst** (`navigation-cache`); GETs cross-origin de catálogo (`stores|categories|products|product_variations`) **NetworkFirst** + TTL 7d (`catalog-cache`); denylist para `orders`/`order_items`/`profiles`/`vw_product_suggestions` (não entram em cache).
- [x] `useOnline` + `OfflineBanner` ("Sem conexão — as alterações serão sincronizadas quando houver rede").
- [x] Mensagem de offline no carregamento (`Dashboard`/`ErrorScreen`) + reload automático na transição offline→online (sem loop quando servidor fora).

### Etapa 3 — Ciclo de vida do SW (Concluída)
- [x] Fluxo `prompt`: `onNeedRefresh` → banner → "Atualizar" (`applyUpdate` = skipWaiting + reload).
- [x] `onOfflineReady` → toast "Pronto para uso offline".
- [x] Limpeza de caches antigos (`cleanupOutdatedCaches`) no `activate`.

### Etapa 4 — Filas de ações (Concluída)
- [x] `src/lib/offlineQueue.ts`: IndexedDB `pedidos-pwa/queue` + ações tipadas (`persist-draft`, `finish-order`, `create-order`) com dedupe/replace por `orderId`.
- [x] `flushQueue()` com cliente supabase vivo (sessão fresca → evita 401 de JWT expirado), ordem por `createdAt`, stop em falha de rede.
- [x] Integração: `useDraftPersistence.persistOrder` enfileira `persist-draft` quando offline (sem toast de erro repetido); `finishOrder` enfileira `finish-order` e navega; `newCount` enfileira `create-order` com id otimista (uuid do cliente).
- [x] `refreshCurrentOrder` (novo na sessão) reconcilia pedido corrente após flush (via `commitSyncedOrder` → limpa o guard do realtime).
- [x] `Dashboard` faz flush + reload na transição offline→online.
- [x] **Escopos conscientemente fora da fila (exigem rede)**: escrita de catálogo (`CatalogBoard`). A marcação de digitação (`isEnteredInLegacy`) de pedido já "agendado p/ concluir" **passou a ser enfileirada** (o rascunho não é mais descartado quando há `finish-order` pendente).

### Etapa 5 — UX offline + docs (Concluída)
- [x] Textos pt-BR consistentes e toasts de "sincronizado" (banner + toasts).
- [x] Atualizar `PROJECT_STATUS.md`.
- [x] Atualizar `AGENTS.md`, `docs/architecture.md` e skill `app-context`.
- [x] Validação automática: `npm run typecheck` + `npm run build` (OK; único aviso: chunk ~560 kB quebra o limite de 500 kB — não bloqueante).
- [ ] Checklist manual (usuário): instalar A2HS, offline no DevTools, sync da fila, banner "Nova versão disponível".

### Etapa 6 — Leitura offline (espelho local) (Concluída)
- [x] `src/lib/localCache.ts`: IndexedDB `pedidos-pwa` **v2** com store `mirror` (keyPath `key`) + `openDB`/`withDB` compartilhados com a fila (`queue` continua com keyPath `id`).
- [x] Espelho de **pedidos por loja**, **itens por pedido** (serializados como `{ key, quantity, isEnteredInLegacy }` e rematerializados contra o catálogo), **sugestões por loja**, **última contagem** e **relatório** por loja, e **perfil** por usuário.
- [x] Estratégia **servidor 1º, espelho fallback**: `useStoreSession` (carga da loja, `fetchOrderItems`, `fetchSuggestions`), `useStoreReports` e `App.tsx` (perfil) só leem o espelho quando a leitura falha por offline (`isOffline`/`isOfflineError`); toda leitura/escrita bem-sucedida atualiza o espelho.
- [x] Salvamento espelha sempre: `persistOrder` (online e offline), `finishOrder`, `newCount` (online e otimista) e `refreshCurrentOrder` gravam `updateOrderInStore`/`cacheCountedItems` — abrir offline mostra o estado da última sincronização, inclusive ações ainda na fila.
- [x] Sessão/login offline preservada: `App.tsx` cai para o perfil espelhado (role/loja) quando `profiles` falha.
- [x] Detecção de offline robusta + timeout: `isOfflineError` reconhece falha de rede por mensagem (ex.: `PostgrestError` "Failed to fetch"/"fetch failed" e `AbortError`), além do `TypeError`/`navigator.onLine` — corrige toasts de erro e tela de erro ao cair a rede com sessão ativa ou no F5 offline. Cliente Supabase usa fetch com abort em 10s (`lib/supabase.ts`) para falhar rápido em "conectado sem internet".
- [x] Validação automática: `npm run typecheck` + `npm run build` (OK; aviso de chunk ~560 kB não bloqueante).
- [x] Limitação documentada: o catálogo tem dupla proteção (cache NetworkFirst do SW com TTL 7d **e** espelho no IndexedDB, que funciona mesmo em dev sem SW); primeira abertura 100% offline sem espelho prévio mostra a tela de offline.

### Etapa 6c — Sync com feedback (Concluída)
- [x] `subscribePending` (em `lib/offlineQueue.ts`): emite o contador real da fila a cada enqueue/flush — fonte de verdade independente do `navigator.onLine`.
- [x] `usePendingSync` (novo hook) + `SyncBanner` (novo componente): banner "X alterações aguardando sincronização" com botão "Sincronizar" e estado "Sincronizando…".
- [x] `flushQueue(force?)`: `force` ignora o guard `isOffline()` — retry/botão funcionam mesmo com `navigator.onLine` defasado (WiFi "conectado" sem internet).
- [x] `Dashboard`: auto-sync no mount (pendências de sessões anteriores), na transição offline→online e a cada 20s enquanto houver pendência online; toast "Alterações sincronizadas." + `refreshCurrentOrder` só no sucesso.
- [x] Validação automática: `npm run typecheck` + `npm run build` (OK).

### Etapa 8 — Rotas por endpoint (Concluída)
- [x] `react-router-dom` v7 instalado; `BrowserRouter` em `main.tsx`; `App.tsx` continua sendo o gate de autenticação e monta o `AppShell` quando logado.
- [x] `src/lib/sections.ts`: registro genérico das seções (`APP_SECTIONS` — `path`, `label`, `icon`, `description`, `ready`) + `DEFAULT_SECTION_PATH`.
- [x] `src/components/TopNav.tsx`: navbar de seções (`NavLink`) compartilhada por todas as rotas, com marca, usuário/cargo e Sair (movidos do `AppHeader`).
- [x] `src/components/AppShell.tsx`: `<Routes>` com uma rota por seção; `/orders` → `Dashboard` (comportamento atual, abas internas), `/management` → placeholder "em construção"; rota desconhecida → `/orders`.
- [x] `src/components/SectionPlaceholder.tsx`: tela genérica "em construção" (ícone, descrição, selo "em breve") — reusável por qualquer seção futura.
- [x] Deep link funciona (dev, preview e Netlify `_redirects`) e offline (`navigateFallback` do SW).
- [x] Validação automática: `npm run typecheck` + `npm run build` (OK).

### Etapa 9 — Cálculo de vendas/métricas em `/management` (Concluída)
- [x] DTOs em `src/types/sales.ts` (`SalesPayload`, `SalesItemInput`, `SalesSummary`, `SalesReportItem`, `SalesMetricsResult`, `SalesValidationError`).
- [x] Service puro `src/lib/salesMetrics.ts`: `normalizeSalesPayload` (validação → erro 400 com todos os detalhes), `buildSalesPayloadFromForm` (formulário → payload), `calculateSalesMetrics` (total vendido, base efetiva, porcentagem individual, ticket médio, maior venda, atingimento da meta), `round2` (2 casas) e `processSalesPayload`.
- [x] Controller `src/hooks/useSalesMetrics.ts` (estado do formulário: meta + linhas de vendedor; `addSeller`/`updateSeller`/`removeSeller`; `clear`/`loadExample`; resultado e erro **derivados** via `useMemo` — cálculo instantâneo, sem botão).
- [x] UI `src/components/SalesMetricsPanel.tsx` + `src/components/ManagementScreen.tsx`: **campo de meta**, linhas de vendedor (nome + valor, adicionar/remover), cards de resumo e detalhamento por vendedor (com barra de %) atualizados ao vivo; responsivo (`sm:grid-cols-2`, `xl:grid-cols-3/4`).
- [x] Utils `formatCurrency`/`formatPercentage`/`parseNumberOrNull`/`newId` em `src/lib/utils.ts` (`newId` migrado de `offlineQueue.ts`, com re-export preservado).
- [x] Testes unitários (Vitest): base customizada, fallback sem base, lista vazia, divisão por zero, empate no `topSale`, arredondamento, validação 400 e formulário → payload (com linhas em branco ignoradas) — `npm test` (19 testes, OK).
- [x] Validação automática: `npm run typecheck` + `npm run build` (OK).
- [x] (superado pela Etapa 10) o módulo passou a persistir no Supabase — vendedores, histórico de consolidações e vendas por vendedor.

### Etapa 10 — Vendedores no banco + histórico (Concluída)
- [x] Migration `supabase/migrations/20261003000100_management_sales.sql`: tabelas `sellers`, `sales_calculations` (snapshot) e `sales_records` (vendas por vendedor), índices e RLS para `authenticated`.
- [x] Tipos canônicos em `src/types/database.ts` (`Seller`, `SalesCalculation`, `SalesRecord` + `Insert`/`Update`, padrão `Recordish`).
- [x] Persistência `src/lib/salesStore.ts`: `fetchSellers`/`createSeller`/`updateSeller`/`deactivateSeller` (soft delete)/`fetchHistory`/`fetchSalesRecords`/`deleteCalculation`/`recordSales` (grava snapshot + vendas; rollback do snapshot se as vendas falharem).
- [x] Controller `src/hooks/useSalesManagement.ts`: vendedores do banco, valores do período, meta, data de referência, histórico e cálculo derivado (`useMemo`, instantâneo); `addSeller`/`removeSeller`/`register` com toasts.
- [x] UI: `SalesMetricsPanel` (card 1 — data, meta, "Registrar vendas"), `SalesResultCard` (card 2 — indicadores + detalhamento), `SalesSellersCard` (card 3 — cadastro no banco + **edição inline do nome** + valor na mesma linha), `SalesHistoryPanel` (card 4 — histórico + total acumulado) e `ManagementScreen` compondo na ordem pedida.
- [x] Removidos o payload JSON e o botão "Carregar exemplo".
- [x] Parser tolerante (`parseNumberOrNull`): aceita vírgula, ponto, separador de milhar ("3.289,49") e moeda ("R$ 3.289,49").
- [x] **Erro 400 só aparece ao clicar em "Registrar vendas"** (antes era exibido durante a digitação).
- [x] Histórico: **clicar em um lançamento carrega** seus dados no formulário (valores, meta e data) e **lixeira exclui** a consolidação (cascade nas vendas, com `window.confirm`).
- [x] Exclusão de vendedor pede confirmação (`window.confirm`, avisa do cascade no histórico) e há botão "Limpar valores" (zera apenas os valores digitados, mantém os vendedores).
- [x] Registrar **sem meta informada** pede confirmação (`window.confirm`) antes de gravar.
- [x] Cards expansíveis/colapsáveis (`src/components/CollapsibleCard.tsx`): estado do último uso persistido no `localStorage` (`pedidos:card:<chave>`) e aplicado aos 4 cards do `/management`.
- [x] Layout: em `xl` (grid de 2 colunas `minmax(0,2fr)`/`minmax(0,3fr)`) Cálculo (2/5) e Vendedores (3/5) ficam lado a lado, com Resultado e Histórico em largura total; abaixo de `xl` empilham na ordem Cálculo → Vendedores → Resultado → Histórico.
- [x] Correção do estouro de largura: tracks do grid com `minmax(0,…)` + `min-w-0` nos itens (track `1fr` = `minmax(auto,1fr)` herda o min-content dos cards e estourava o contêiner).
- [x] Correção do layout em telas grandes: listas em colunas passam a usar **bordas nas células** (o `bg-gray-100` no contêiner do grid deixava as colunas vazias da última linha em cinza) — aplicado em `/management` **e** na Prancheta/Digitação do `/orders`.
- [x] Histórico mostra também a **% do melhor vendedor** (calculada do snapshot `top_sale` sobre a base, via `percentageOf`) e a **% da meta** em destaque; o card "Maior venda" do resultado passou a exibir a participação do líder.
- [x] `/management` com abas próprias: **Vendas** (conteúdo atual) e **Comparação** ("em construção"); barra de abas genérica (`TabsBar`) extraída e reaproveitada pelas abas do `/orders` (`AppNav`).
- [x] `/management` com o **mesmo seletor de loja do `/orders`** (componente `StoreSelect` compartilhado, na mesma barra vinho de largura total) — a preferência continua compartilhada (`lib/storePreference.ts`); a loja escolhida é gravada em `sales_calculations.store_id`.
- [x] Histórico e vendedores **associados à loja selecionada**: migration `supabase/migrations/20261003000200_sellers_store.sql` (`sellers.store_id`, aplicada no Supabase); `sales_calculations.store_id` é gravado no registro, a listagem do histórico é filtrada pela loja (com os legados `store_id is null`) e mostra o nome da loja.
- [x] Ao trocar de loja, a tela recarrega **os vendedores e o histórico da loja** (`fetchSellers`/`fetchHistory` com `store_id`); os vendedores sem loja (legados) aparecem com a etiqueta "sem loja" e a ação "Vincular a esta loja".
- [x] Respiro no fim da página: `pb-12 lg:pb-16` no conteúdo do `/management` + rodapé de contexto (loja selecionada e nº de lançamentos do histórico) fechando a visualização.
- [x] Ações do lançamento em **dois lugares** (novo `SalesActions.tsx`): "Registrar vendas" + "Novas vendas" lado a lado à direita do seletor de loja (barra vinho) e dentro de "Detalhamento por vendedor" (card branco); o registro fica **desabilitado** quando todos os vendedores estão vazios ou em 0,00.
- [x] Validação automática: `npm run typecheck` + `npm test` (70 testes) + `npm run build` (OK).
- [x] Migrations aplicadas no Supabase: `20261003000100` (tabelas), `..._sellers_store` (`sellers.store_id`), `..._sellers_unique_per_store` (índice por loja/ativos), `..._management_rls` (RLS por loja + auditoria) e `..._persist_order_draft` (RPC transacional).
- [ ] (backlog) Análises futuras sobre `sales_records` (ranking de vendedores, evolução mensal, meta por período) e definição de RBAC da seção (hoje visível para qualquer usuário logado).

### Fase 1 (branch `ajustes`) — Perda de dados no fluxo de pedidos (Concluída)
- [x] `removeDraftForOrder(orderId)` em `lib/offlineQueue.ts`: o persist **online** bem-sucedido descarta o `persist-draft` enfileirado do mesmo pedido (o replay antigo sobrescrevia o estado novo do servidor).
- [x] `flushQueue` reconfirma a presença da ação na fila (`isQueued`) antes de aplicá-la → não reaplica snapshot obsoleto.
- [x] Flush de mount do `Dashboard` passa a esperar o fim da carga da sessão (antes capturava `refreshCurrentOrder` com `currentOrder === null` → no-op).
- [x] `flushDraft` (novo, em `useDraftPersistence`): grava o rascunho pendente sem toast no unmount do `Dashboard` (troca de seção cancelava o debounce de 700 ms).
- [x] `selectStore` aguarda o `enqueuePersist()` da loja anterior antes de trocar.
- [x] `persistOrder` offline enfileira direto (sem esperar o timeout de 10 s) e a remoção local do rascunho pendente não invalida uma gravação já concluída.
- [x] Testes: `tests/lib/offlineQueue.test.ts` (IndexedDB falso via `fake-indexeddb`) e `tests/hooks/useDraftPersistence.test.tsx` — `npm test` (50 testes, OK).

### Fase 2 (branch `ajustes`) — Carregamento offline do `/orders` (Concluída)
- [x] **Causa raiz**: no `Dashboard`, o estado offline **forçava** a tela de erro (`effectiveError` era sempre preenchido offline) → o app nunca mostrava o conteúdo sem conexão, mesmo com o espelho carregado.
- [x] Offline só é erro quando a carga falhou de verdade; caso contrário o app segue em uso com o banner "Sem conexão…".
- [x] Catálogo espelhado no IndexedDB (`cacheCatalog`/`readCatalog`): o `useCatalog` cai para o espelho quando a rede falha — funciona **também em dev** (sem service worker).
- [x] `/management`: banner "Sem conexão…" explicativo (vendedores/histórico/lançamento dependem do banco) e mensagem de erro amigável em vez de "Failed to fetch".
- [x] Testes: `tests/components/Dashboard.test.tsx` (offline sem erro → app visível; offline com erro → tela de erro; online com erro → erro real) e `tests/hooks/useCatalog.test.tsx` (fallback do espelho) — `npm test` (56 testes, OK).

### Fase 2 (branch `ajustes`) — Escopo por loja e integridade no `/management` (Concluída)
- [x] Trocar de loja **zera o formulário** (valores, meta, estado de registro, listas) — reset no render, antes de pintar a nova loja.
- [x] A carga só começa **após a resolução da loja** (`useStoreSelection.resolved`): não há mais busca sem filtro (que mostrava vendedores/histórico de todas as lojas por um instante).
- [x] **Soft delete** de vendedor: `deactivateSeller` (`is_active = false`) em vez de exclusão definitiva — o histórico e os lançamentos são preservados; `fetchSellers` traz só os ativos; a UI virou "Desativar" (ícone `UserX`, `confirm` explicando que o histórico é preservado).
- [x] **Papel no escopo**: `admin` usa a preferência do navegador; `gerente` fica preso à loja do perfil e não grava a preferência — vale para `/orders` (`useStoreSession` ganhou `isAdmin`) e `/management` (`useStoreSelection`).
- [x] Migration `supabase/migrations/20261003000300_sellers_unique_per_store.sql`: nome único **por loja** e só entre os ativos (destrava o bloqueio de nomes iguais em lojas diferentes).
- [x] Testes: `tests/hooks/useSalesManagement.test.tsx` (escopo por loja, reset do formulário, soft delete) e `tests/hooks/useStoreSelection.test.tsx` (papel admin/gerente) — `npm test` (64 testes, OK).
- [x] Migration `20261003000300_sellers_unique_per_store.sql` aplicada no Supabase (nome único por loja e entre os ativos).

### Fase 3 (branch `ajustes`) — Isolamento por loja (RLS) + auditoria (Concluída)
- [x] Migration `supabase/migrations/20261003000400_management_rls.sql`: helpers `security definer` (`public.is_admin()`, `public.current_user_store_id()`, `public.can_access_calculation`) + políticas por loja em `sellers`, `sales_calculations` e `sales_records` — **admin** acessa todas as lojas, **gerente** só a loja do perfil (vendedores globais ficam legíveis; exclusão física só pelo admin).
- [x] Auditoria em `sellers`: `created_by` (default `auth.uid()`), `updated_by` e `updated_at` via trigger `sellers_touch_audit`; tipos atualizados em `types/database.ts`.
- [x] App: sem loja definida, **nenhuma consulta é feita** (o `useSalesManagement` só carrega com `storeId` + `ready`).
- [x] Validação automática: `npm run typecheck` + `npm test` (64 testes) + `npm run build` (OK).
- [x] Migration `20261003000400_management_rls.sql` aplicada no Supabase (RLS por loja + auditoria em `sellers`).

### Fase 4 (branch `ajustes`) — Fila offline e realtime (Concluída)
- [x] `flushQueue` distingue o tipo de falha: **rede/sessão (401)** preserva a fila e interrompe; **permanente** (pedido removido, política violada) descarta a ação e segue para as próximas (`FlushResult.discarded` + aviso na tela) — a fila não fica mais travada para sempre.
- [x] Botão **"Descartar"** no `SyncBanner` (`discardPending`, com confirmação) para limpar pendências que não devem ser enviadas.
- [x] `syncPending` com `catch` (sem unhandled rejection) e toast de erro.
- [x] Gravação **atômica** do rascunho: nova RPC `persist_order_draft` (`supabase/migrations/20261003000500_persist_order_draft.sql`) grava update+delete+insert numa transação — elimina a janela "pedido sem itens"; `lib/orderDraft.ts` cai para o caminho legado quando a RPC ainda não existe no banco.
- [x] `useRealtimeOrder` passa a depender de `currentOrder?.id` (o canal não é mais recriado a cada contagem).
- [x] `isOffline()` detecta offline de forma explícita (`navigator.onLine === false`) — antes, `undefined` (fora do navegador) era tratado como offline.
- [x] Testes: fila (descarte por erro permanente, preservação em erro de rede, `discardPending`) e persistência (RPC + fallback) — `npm test` (67 testes, OK).
- [x] Migration `20261003000500_persist_order_draft.sql` aplicada no Supabase (gravação transacional do rascunho; o app ainda cai para o caminho legado se a RPC faltar).

### Fase 5 (branch `ajustes`) — Qualidade e performance (Concluída)
- [x] Espelho de pedidos: `updateOrderInStore` **mescla** (não sobrescreve) e cria a lista quando a loja ainda não foi espelhada — o `cacheOrders` da loja não é mais substituído por uma lista de 1 item ao criar pedido.
- [x] `mergeOrderRow` atualiza `updated_at` → rótulo do header e do dropdown com a mesma data.
- [x] `useCatalog`: guarda de cancelamento no `setCatalog` (respostas fora de ordem) + **cache em memória** (sem refetch a cada remontagem) e `refresh` com tratamento de erro.
- [x] Relatório: `.limit(2000)` no `.in('order_id', …)` (evita URL gigante / erro 414).
- [x] `DataEntryBoard`: timer do "Copiado!" limpo no unmount.
- [x] `supabase.ts`: `combineSignals` com **fallback** para navegadores sem `AbortSignal.any` (iOS antigo).
- [x] `offlineQueue`: regex de falha de rede restrita a padrões inequívocos (um erro do Postgres/Auth não vira "offline").
- [x] Aba do `/orders` lembrada em `localStorage` (`pedidos:tab`) — trocar de seção não perde a posição; o catálogo em memória evita o refetch.
- [x] Testes: `tests/lib/localCache.test.ts` (espelho mesclando/atualizando/criando) — `npm test` (71 testes, OK).

### Fase 6 (branch `ajustes`) — Regras e documentação (Concluída)
- [x] **Newline final** garantido em todos os arquivos de `src/` (24 sem o caracter).
- [x] Exceções registradas no AGENTS: JSDoc em API pública é permitido (documenta o contrato) e `components/ui.tsx` concentra as primitivas compartilhadas.
- [x] Código alinhado às regras: o rascunho pendente **não** é mais descartado quando há `finish-order` na fila (itens/marcações de digitação se perdiam); o `flushQueue` renova a sessão antes do replay ("cliente supabase vivo"); o fallback do perfil no `App.tsx` só acontece **em falha offline** (erro real do banco não é mascarado).
- [x] Docs alinhados: AGENTS (visão geral do `App.tsx`/`useStoreSession`, rotas, "Estado do repo" → branch `ajustes`, migrations do módulo de Gestão, `navigateFallback` real, fontes de verdade), `architecture.md` (`bumpReport` é do `Dashboard`, limite do `toggleEntered`, contrato da sessão, allow-list do SW), `data-model.md` (view com `product_variation_id` anulável, variação sintética com `created_at`), `PROJECT_STATUS.md` (pendência superada, contagem de testes) e `README.md` (PWA/offline, estrutura, testes, rotas).
- [x] Ajustes no `/management`: percentual mais visível (chip destacado ao lado da barra no detalhamento e chip colorido por atingimento no histórico) · **valor em branco = 0,00** (`parseAmountInput`) · **confirmação ao registrar com vendedor em 0,00** (e aviso "sem valor informado — assumido como R$ 0,00" na linha).
- [x] Ações do lançamento em **dois lugares** (novo `SalesActions.tsx`): "Registrar vendas" + "Novas vendas" lado a lado à direita do seletor de loja (barra vinho) e dentro de "Detalhamento por vendedor" (card branco); o registro fica **desabilitado** quando todos os vendedores estão vazios ou em 0,00.
- [x] Validação automática: `npm run typecheck` + `npm test` (75 testes) + `npm run build` (OK).

### Ajuste — Badge da Netlify / "hide this badge" (Concluída)
- [x] Diagnóstico: a badge "Powered by Netlify" é injetada no **edge** da Netlify e o opt-out "hide this badge" (guardado no `localStorage` do domínio) **não é oferecido** quando um service worker controla a página — o script trata a página como *web app*. Nenhuma mudança de código restaura a opção.
- [x] Solução: badge **desativada no painel do projeto** (Project configuration > General > Powered by Netlify badge) — vale na próxima requisição, sem redeploy.
- [x] `vite.config.ts` mantém `navigateFallback: '/index.html'` (offline-first): qualquer navegação — inclusive link profundo nunca visitado — abre o shell do precache, instantâneo e 100% offline, com HTML e assets da mesma versão.

### Fase 7 (branch `ajustes`) — Testes fora de `src/` + CI (Concluída)
- [x] Testes movidos para **`tests/`**, com subpastas espelhando `src/`: `tests/lib/`, `tests/hooks/`, `tests/components/` (imports `../../src/...`).
- [x] `vitest.config.ts` aponta para `tests/**/*.test.ts(x)`; `tsconfig.app.json` inclui `tests` (os testes entram no `npm run typecheck`).
- [x] Novos testes do `/orders` e do módulo de Gestão: `tests/lib/orders.test.ts` (mapeamento, contagem, merges, rótulo), `tests/lib/orderText.test.ts` (resumo para colagem), `tests/lib/salesStore.test.ts` (filtro por loja, nome duplicado, soft delete, gravação), `tests/hooks/useStoreSession.test.tsx` (loja preferida × loja do perfil, carga online, **fallback offline pelo espelho**, erro sem espelho) e `tests/components/CollapsibleCard.test.tsx` (colapso + persistência).
- [x] CI em `.github/workflows/ci.yml`: `typecheck` → `test` → `build` em push/PR (branches `main`, `ajustes`, `endpoint`).
- [x] O cálculo só existe com **pelo menos um vendedor acima de zero** (campo vazio = 0,00): enquanto não houver, o card de Resultado mostra "Informe o valor de ao menos um vendedor para ver o cálculo." (mantendo as ações) e "Registrar vendas" fica desabilitado.
- [x] Paleta do `/management` reaproveitada com distribuição por significado: acento por card (**wine** = Cálculo/valores, **gold** = Resultado/meta, **sky** = Vendedores/cadastro, **emerald** = Histórico/registros) e indicadores coloridos por papel (total/base/maior venda em wine, meta em gold, ticket médio em sky, registros em gray, **atingimento dinâmico** emerald/amber/gray).
- [x] Navegação por scroll suave: "Registrar vendas" revela o card de **Histórico** (abre se estiver colapsado + `scrollIntoView` suave) e "Novas vendas" revela o card de **Vendedores** (`revealSignal` no `CollapsibleCard` + `scroll-mt-16` para não ficar sob a barra de abas fixa).
- [x] Validação automática: `npm run typecheck` + `npm test` (112 testes) + `npm run build` (OK).

## Checklist manual (PWA)

- [ ] Instalar o app (A2HS) no Android/desktop e abrir standalone.
- [ ] Redes offline (DevTools) e recarregar: shell abre, catálogo vem do cache e dados (pedido/itens/sugestões/relatório/perfil) vêm do espelho local.
- [ ] Fazer contagem offline (editar/novo pedido/concluir) → banner "X alterações aguardando sincronização" aparece → voltar online → auto-sync ou botão "Sincronizar" → toast "Alterações sincronizadas." + espelho atualizado.
- [ ] Publicar nova versão → ver banner de atualização → confirmar reload com dados preservados.
- [ ] Navegar entre as seções pela navbar (`/orders` ↔ `/management`), abrir `/management` direto (deep link) e recarregar em `/orders`.

## Histórico

| Data | Etapa | Descrição |
| --- | --- | --- |
| 2026-10-01 | 0 | Preparação PWA: deps, ícones, `PROJECT_STATUS.md`. |
| 2026-10-01 | 1–4 | Shell PWA (manifest/SW), caches (NetworkFirst/CacheFirst), ciclo de vida `prompt` e fila de ações offline (IndexedDB). |
| 2026-10-01 | 5 | Docs/contexto de agentes + validação final. |
| 2026-10-01 | 6 | Leitura offline: espelho local (IndexedDB v2 `mirror`) + fallback "servidor 1º, espelho" em sessão/relatórios/perfil. |
| 2026-10-03 | 6b | Endurecimento offline: detecção de falha de rede por mensagem (`PostgrestError` "Failed to fetch"/`AbortError`) + fetch com timeout de 10s no cliente Supabase. |
| 2026-10-03 | 6c | Sync com feedback: `subscribePending`/`usePendingSync`/`SyncBanner`, `flushQueue(force?)` e auto-sync no mount/transição/20s + botão "Sincronizar". |
| 2026-10-03 | 7 | Layout responsivo widescreen: container alarga para `max-w-7xl` (lg/xl/2xl); Prancheta em 2–3 colunas e Digitação em 2 colunas em telas grandes. |
| 2026-10-03 | 8 | Rotas por endpoint: `react-router-dom` v7, `AppShell` + `TopNav` + `APP_SECTIONS`; `/orders` (tela de pedidos) e `/management` ("em construção"). |
| 2026-10-03 | 9 | Cálculo de vendas/métricas em `/management`: service puro + DTOs + controller + UI + testes (Vitest). |
| 2026-10-03 | 10 | Vendedores persistidos no banco + histórico de vendas/consolidações (migration `supabase/migrations/`). |