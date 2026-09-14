# AGENTS.md

Contexto imediato para agentes que trabalham neste repositório. Leia este arquivo; consulte `docs/architecture.md` (mecânica dos hooks/fluxos) e `docs/data-model.md` (schema do banco) quando precisar de profundidade.

## O que é

`pedidos-abastecimento`: app mobile-first de contagem e pedidos de abastecimento por loja. Uma contagem é um pedido (`orders`) com itens (`order_items`); o usuário digita quantidades, finaliza (`Concluido`) e depois há lançamento (`Lancado`).

## Stack e scripts

- React 19, TypeScript 5.6, Vite 6, Tailwind 4 (`@tailwindcss/vite`), `@supabase/supabase-js` (com generic tipado), `@supabase/ssr`, `lucide-react`.
- Sem teste automatizado. Sem config de ESLint (há `// eslint-disable` apenas de legado).
- Scripts (`npm run`):
  - `dev` — Vite dev server.
  - `build` — `tsc -b && vite build`.
  - `typecheck` / `lint` — `tsc -b --noEmit` (idênticos).
- Para rodar: `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (obrigatório, o `lib/supabase.ts` lança erro sem elas).

## Arquitetura (visão geral)

`src/App.tsx` (176 linhas) é o orquestrador que **compõe hooks** e renderiza telas:

- Hooks: `useCatalog` (catálogo + reload/refresh), `useFlash` (toast; `notify` é estável), `useStoreReports` (relatório/última contagem), `useStoreSession` (sessão da contagem corrente).
- `useStoreSession` (~394 linhas) **é dono dos estados** e compõe dois sub-hooks: `useDraftPersistence` (autosave/persistência) e `useRealtimeOrder` (subscription Supabase). Contrato de retorno (~24 campos) deve permanecer intacto — `App.tsx` destrutura tudo.
- Boards (`components/`): `CountingBoard`, `DataEntryBoard`, `CatalogBoard`, `ComparisonBoard` — sem estado próprio de sessão, recebem props.
- Camada pura: `lib/orders.ts` concentra regras de contagem/pedidos (sem dependência de React). Utils genéricos em `lib/utils.ts` (`getErrorMessage`).
- Tipos: `types/app.ts` (domínio da UI/sessão) e `types/database.ts` (linhas do banco + `Database` para o supabase-js).

### Mapa de módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Composição de hooks + roteamento de tabs + telas de loading/erro |
| `src/hooks/useStoreSession.ts` | Orquestrador: estados do pedido corrente, carga da loja, ações |
| `src/hooks/useDraftPersistence.ts` | Persistência/autosave: refs espelhadas, debounce 700ms, chain de persist |
| `src/hooks/useRealtimeOrder.ts` | Subscription Supabase por pedido + reload no guard |
| `src/hooks/useCatalog.ts`, `useFlash.ts`, `useStoreReports.ts` | Suporte: catálogo, notificações, relatório |
| `src/lib/orders.ts` | Regras puras: mapear itens, contar, mesclar pedidos |
| `src/lib/supabase.ts` | Cliente Supabase tipado |
| `src/types/app.ts` | `Catalog`, `CountedItem`, `ItemKey`, `SuggestionsMap`, `TabId`, flash/report |
| `src/types/database.ts` | Tipos de tabelas + interface `Database` |
| `src/components/*` | Header, nav, telas (loading/error), toast, status bar, boards |

## Regras de domínio (resumo)

- **status** do pedido: `Rascunho` → `Concluido` → `Lancado` (valores exatos do banco, sem acento em "Concluido").
- **`itemKey`** identifica um item contado: `` `${productId}::${variationId}` ``.
- **Variação sintética**: produtos sem variações cadastradas usam `id: ''` (`SYNTHETIC_VARIATION_ID`); `defaultVariationForProduct` gera essa variação na hora.
- **Persistência**: a cada save, atualiza o `orders` e reescreve os `order_items` (delete + insert) com `is_entered_in_legacy`.
- **Sugestões**: vêm da view `vw_product_suggestions` por loja.
- **Lista de pedidos**: máx. 25 por loja, ordenada por `updated_at desc`.

## Convenções do código

- **Sem comentários** (exceto se solicitado); mensagens de UI em pt-BR.
- **Newline final** obrigatório em todo arquivo.
- TypeScript `strict` com `noUnusedLocals` e `noUnusedParameters` — imports/símbolos não usados quebram o build.
- Lógica pura vai em `lib/`; tipos de domínio em `types/`; um arquivo por hook/componente.
- **Sub-hooks recebem estado/setters por parâmetro**; o orquestrador segue dono dos estados. Nunca chamar hooks condicionalmente.
- **Identidade de callbacks importa**: callbacks que só leem refs devem ser estáveis (`useCallback([])`, ex.: `shouldSkipSync`) — se variarem, o channel do realtime pode re-subscribe (efeito dependent).
- Interfaces de `types/database.ts` precisam de `& Record<string, unknown>` para satisfazer o generic do supabase-js (padrão `Recordish`) — ao criar novos tipos `Insert`, siga esse padrão.
- Re-exports são usados para compatibilidade (ex.: `CatalogBoard` reexporta `FlashKind`) — manter ao mover símbolos.

## Estado do repo

- Branch: `refactor` — 7 commits consolidando a modularização (`App.tsx` era 1082 linhas; hoje ~176).
- `HEAD`: `678234d` ("refatoração de hooks"). Árvore de trabalho limpa.
- Histórico relevante: "primeira etapa … quarta fase … fase final da refatoração de App" → "refatoração de hooks".

## Vigilância: evite regressões de comportamento

- Não altere o contrato de retorno de `useStoreSession` sem ajustar `App.tsx`.
- Não mude o debounce (700ms), o guard do realtime (`saving || dirty || <1500ms`) nem a estratégia delete+insert dos itens sem motivo — são decisões base de concorrência.
- Ao mexer em hooks, valide com `npm run typecheck` e `npm run build`.
