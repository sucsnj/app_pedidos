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
- [ ] **Escopos conscientemente fora da fila (são exigem rede)**: escrita de catálogo (`CatalogBoard`) e toggle `isEnteredInLegacy` de pedido já "agendado p/ concluir" — documentado como limitação.

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
- [ ] Limitação documentada: catálogo continua dependente do cache NetworkFirst do SW (TTL 7d) — sem rede por mais de 7 dias, o catálogo exige reconexão; primeira abertura 100% offline sem espelho prévio mostra a tela de offline.

## Checklist manual (PWA)

- [ ] Instalar o app (A2HS) no Android/desktop e abrir standalone.
- [ ] Redes offline (DevTools) e recarregar: shell abre, catálogo vem do cache e dados (pedido/itens/sugestões/relatório/perfil) vêm do espelho local.
- [ ] Fazer contagem offline (editar/novo pedido/concluir) → voltar online → verificar sync da fila + espelho atualizado.
- [ ] Publicar nova versão → ver banner de atualização → confirmar reload com dados preservados.

## Histórico

| Data | Etapa | Descrição |
| --- | --- | --- |
| 2026-10-01 | 0 | Preparação PWA: deps, ícones, `PROJECT_STATUS.md`. |
| 2026-10-01 | 1–4 | Shell PWA (manifest/SW), caches (NetworkFirst/CacheFirst), ciclo de vida `prompt` e fila de ações offline (IndexedDB). |
| 2026-10-01 | 5 | Docs/contexto de agentes + validação final. |
| 2026-10-01 | 6 | Leitura offline: espelho local (IndexedDB v2 `mirror`) + fallback "servidor 1º, espelho" em sessão/relatórios/perfil. |
| 2026-10-03 | 6b | Endurecimento offline: detecção de falha de rede por mensagem (`PostgrestError` "Failed to fetch"/`AbortError`) + fetch com timeout de 10s no cliente Supabase. |