# pedidos-abastecimento

App web mobile-first para contagem e pedidos de abastecimento por loja. Uma **contagem** é um pedido (`orders`) com itens (`order_items`): o usuário digita quantidades, finaliza o pedido (`Concluido`) e depois há o lançamento (`Lancado`).

Stack: React 19, TypeScript 5.6 (strict), Vite 6, Tailwind 4, React Router 7, Supabase (Postgres + Realtime) e Vitest. Funciona como **PWA** (instalável, cache do shell/catálogo, espelho local e fila de ações offline).

## Como rodar

```bash
npm install
npm run dev
```

Obrigatório: `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — `src/lib/supabase.ts` lança erro sem elas.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run typecheck` / `npm run lint` | `tsc -b --noEmit` (idênticos) |
| `npm test` | `vitest run` (testes unitários) |

## Estrutura

- `src/App.tsx` — gate de autenticação; logado, monta o `AppShell` (rotas).
- `src/hooks/` — `useStoreSession` (sessão/orquestrador), `useDraftPersistence` (persistência/autosave), `useRealtimeOrder` (subscription), `useCatalog`, `useFlash`, `useStoreReports`, `useStoreSelection` (loja fora da sessão), `useSalesManagement` (módulo de Gestão), `usePendingSync`.
- `src/components/` — shell/rotas (`AppShell`, `TopNav`, `SectionPlaceholder`, `TabsBar`, `StoreSelect`, `CollapsibleCard`), header, nav, telas de loading/erro, toast, status bar e boards (`CountingBoard`, `DataEntryBoard`, `CatalogBoard`, `ComparisonBoard`, `SalesMetricsPanel`, `SalesSellersCard`, `SalesResultCard`, `SalesHistoryPanel`).
- `src/lib/` — lógica pura de pedidos (`orders.ts`), métricas de vendas (`salesMetrics.ts`), persistência de vendas (`salesStore.ts`), gravação do rascunho (`orderDraft.ts`), fila offline (`offlineQueue.ts`), espelho local (`localCache.ts`), resumo em texto (`orderText.ts`), seções/endpoints (`sections.ts`), utilitários e cliente Supabase.
- `src/types/` — domínio da UI (`app.ts`), DTOs de vendas (`sales.ts`) e tipos do banco (`database.ts`).
- `supabase/migrations/` — DDL do módulo de Gestão (`sellers`, `sales_calculations`, `sales_records`), RLS por loja, índice único por loja e RPC `persist_order_draft`.

## PWA e uso offline

- **Shell** em precache (Workbox, `registerType: 'prompt'`); navegação e **catálogo** em `NetworkFirst` (TTL 7d).
- **Espelho local** (IndexedDB): catálogo, pedidos, itens, sugestões, última contagem, relatório e perfil — a app abre offline com os dados da última sincronização.
- **Fila de ações**: o autosave offline é enfileirado e reenviado quando a rede volta (banner "X alterações aguardando sincronização" + botões **Sincronizar**/**Descartar**).
- O módulo `/management` (vendedores/histórico) **exige rede** — fora da fila offline.

## Rotas

| Rota | Tela |
| --- | --- |
| `/orders` | Pedidos: contagem, digitação, cadastro de produtos e comparativo. |
| `/management` | Gestão: vendedores (cadastro no banco), lançamento de vendas com cálculo em tempo real e histórico. |

A navbar (`TopNav`) navega entre as seções declaradas em `src/lib/sections.ts`.

## Fluxo de uso

1. **Contagem** (`count`): digita quantidades por produto, com sugestões e autosave; salvar manual à parte.
2. **Concluir**: pedido muda para `Concluido` e o app vai para a Digitação.
3. **Digitação** (`entry`): lista os itens do pedido e marca `isEnteredInLegacy`.
4. **Comparativo** (`comparativo`): compara a contagem corrente com a última e mostra relatórios.

## Documentação técnica

- `AGENTS.md` — contexto de trabalho para agentes (convenções, arquitetura, invariantes).
- `docs/architecture.md` — mecânica dos hooks e fluxos.
- `docs/data-model.md` — schema do banco e regras de domínio.
