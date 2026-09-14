# AGENTS.md

Contexto imediato para agentes que trabalham neste repositório. Leia este arquivo; consulte `docs/architecture.md` (mecânica dos hooks/fluxos) e `docs/data-model.md` (schema do banco) quando precisar de profundidade — o comando `/context` injeta ambos de uma vez, e a skill `app-context` cobre tarefas de persistência/realtime/schema.

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
| `src/lib/orders.ts` | Regras puras: mapear itens, contar, mesclar pedidos, `orderLabel` |
| `src/lib/orderText.ts` | Resumo do pedido em texto p/ colar (legado/WhatsApp) — `buildOrderSummary` + `copyTextToClipboard` |
| `src/lib/utils.ts` | `getErrorMessage`, datas pt-BR (`formatDate`/`formatDateTime`), `parseNumber`, `emptyText` |
| `src/lib/supabase.ts` | Cliente Supabase tipado |
| `src/types/app.ts` | `Catalog`, `CountedItem`, `ItemKey`, `SuggestionsMap`, `TabId`, flash/report, `compareByEntryCode`, `SYNTHETIC_VARIATION_ID`/`defaultVariationForProduct` |
| `src/types/database.ts` | Tipos de tabelas + interface `Database` |
| `src/components/*` | Header, nav, telas (loading/error), toast, status bar, boards |

### Telas e fluxo de uso

`TabId`: `count` | `entry` | `catalog` | `comparativo`.

| Tab/screen | Componente | O que faz |
| --- | --- | --- |
| Contagem (`count`) | `CountingBoard` | Digita quantidades (+/− via `adjust`; digitação direta via `setQuantity`), nome/notas (`requesterName`/`notes`), salvar manual (`saveNow`), sugestões por item, indicadores `saving`/`savedAt`, última contagem |
| Digitação (`entry`) | `DataEntryBoard` | Lista itens com quantidade (ordenados por PLU/SKU via `compareByEntryCode`), progresso X/Y, alterna `isEnteredInLegacy` (`toggleEntered`) e "Copiar Resumo em Texto" (`buildOrderSummary`) |
| Catálogo (`catalog`) | `CatalogBoard` | Admin do catálogo: CRUD de lojas/categorias/produtos/variações gravando **direto no Supabase** (fora do `useStoreSession`); refresh via `refreshCatalog` |
| Comparativo (`comparativo`) | `ComparisonBoard` | Compara a contagem corrente com a última (`lastOrder`) e mostra o `report` (pedidos do mês, top produto, variação semanal, top produtos) — definições no `architecture.md` |
| Header | `AppHeader` | Troca loja (`selectStore`), escolhe pedido (`selectOrder`), nova contagem (`newCount`), indicador `saving` |
| Navegação | `AppNav` | Tabs + botão concluir (`handleFinishOrder` → `finishOrder` + `bumpReport`) se `canFinish` |
| Barra de status | `MobileStatusBar` | Resumo: loja, total contado, pedido corrente |
| Toast | `FlashToast` | Notificações via `useFlash` (`notify`) |

- `locksOrder` = `currentOrder !== null && currentOrder.status !== 'Rascunho'` — trava edição quando o pedido não é rascunho.
- Concluir um pedido navega para `entry` ("Modo Digitação"); em seguida o `comparativo` compara com a última contagem.

## Regras de domínio (resumo)

- **status** do pedido: `Rascunho` → `Concluido` → `Lancado` (valores exatos do banco, sem acento em "Concluido").
- **`itemKey`** identifica um item contado: `` `${productId}::${variationId}` ``.
- **Variação sintética**: produtos sem variações cadastradas usam `id: ''` (`SYNTHETIC_VARIATION_ID`); `defaultVariationForProduct` gera essa variação na hora.
- **Persistência**: a cada save, atualiza o `orders` e reescreve os `order_items` (delete + insert) com `is_entered_in_legacy`.
- **Sugestões**: vêm da view `vw_product_suggestions` por loja; exibidas quando o item ainda não tem quantidade.
- **Ordenação da digitação**: `compareByEntryCode` — por código PLU/SKU (numérico) e depois nome da variação.
- **Resumo em texto**: `buildOrderSummary` (`lib/orderText.ts`) gera o pedido para colagem (WhatsApp/legado), com ordem PLU/SKU; `copyTextToClipboard` tem fallback via `document.execCommand`.
- **Lista de pedidos**: máx. 25 por loja, ordenada por `updated_at desc`.

## Fontes de verdade (onde procurar)

- **Schema/colunas**: `src/types/database.ts` — canônico (alimenta o generic do supabase-js). `docs/data-model.md` resume a semântica — se conflitar, vale o tipo.
- **Regras de contagem/pedidos**: `src/lib/orders.ts` (funções puras, sem React).
- **Resumo em texto / digitação**: `src/lib/orderText.ts` (formato ordenado por código) + `compareByEntryCode` em `types/app.ts`.
- **Utils genéricos**: `src/lib/utils.ts` (`getErrorMessage`, datas, `parseNumber`, `emptyText`).
- **Comportamento da sessão**: `src/hooks/useStoreSession.ts` + sub-hooks (`useDraftPersistence`, `useRealtimeOrder`); `docs/architecture.md` resume fluxos/invariantes.
- **Catálogo/notificações/relatório**: `src/hooks/useCatalog.ts`, `useFlash.ts`, `useStoreReports.ts`.
- **Domínio da UI**: `src/types/app.ts` (`Catalog`, `CountedItem`, `SuggestionsMap`, `TabId`, flash/report).
- **Banco efetivo**: não há migrations no repositório; o schema real vive no Supabase — `types/database.ts` é o contrato da aplicação.

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

- Branch: `agente` — modularização concluída (`App.tsx` era 1082 linhas; hoje ~176; `useStoreSession` ~394).
- `HEAD`: `987acf9` ("melhorias para contexto de agentes e readme adicionado"). Árvore de trabalho limpa.
- Histórico relevante: "primeira etapa … fase final da refatoração de App" → "refatoração de hooks" → "contexto e memória para agentes" → "melhorias para contexto de agentes e readme adicionado".

## Vigilância: evite regressões de comportamento

- Não altere o contrato de retorno de `useStoreSession` sem ajustar `App.tsx`.
- Não mude o debounce (700ms), o guard do realtime (`saving || dirty || <1500ms`) nem a estratégia delete+insert dos itens sem motivo — são decisões base de concorrência.
- Ao mexer em hooks, valide com `npm run typecheck` e `npm run build`.

## Receita para mudanças seguras

1. Leia este `AGENTS.md`; abra `docs/architecture.md` (mecânica) e `docs/data-model.md` (schema) quando o trecho for sensível (persistência, realtime, tipos).
2. Mantenha as convenções: sem comentários, newline final, mensagens de UI em pt-BR.
3. Não mude contrato de `useStoreSession`, debounce 700ms, guard do realtime nem delete+insert sem justificativa.
4. Não chame hooks condicionalmente; sub-hooks recebem estados/setters por parâmetro; callbacks estáveis para não re-subscribe do channel.
5. Faça a alteração e valide: `npm run typecheck` e `npm run build`. Smoke opcional: `npm run dev`.
6. Preserve re-exports e o padrão `Recordish` (`& Record<string, unknown>`) ao tocar em tipos `Insert`.
7. Se o domínio mudar, atualize `AGENTS.md`/`docs/` — contexto obsoleto custa leitura de código.
