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

- Hooks: `useAuth` (sessão Supabase), `useCatalog` (catálogo + reload/refresh), `useFlash` (toast; `notify` é estável), `useStoreReports` (relatório/última contagem), `useStoreSession` (sessão da contagem corrente).
- `App.tsx` é o **gate de autenticação**: `useAuth` decide entre `LoginScreen` (anônimo) e `Dashboard` (logado). Após o login, o próprio `App.tsx` consulta `public.profiles` (`maybeSingle()` por `user.id`, falha de leitura não bloqueia), define `userRole` (`profile?.role || 'gerente'`) e faz `console.log("Dados do Perfil no Supabase:", profile, "Erro:", error)` para depuração. `Dashboard` é o orquestrador que **compõe hooks** e renderiza telas.
- `useStoreSession` (~394 linhas) **é dono dos estados** e compõe dois sub-hooks: `useDraftPersistence` (autosave/persistência) e `useRealtimeOrder` (subscription Supabase). Contrato de retorno (~24 campos) deve permanecer intacto — `App.tsx` destrutura tudo.
- Boards (`components/`): `CountingBoard`, `DataEntryBoard`, `CatalogBoard`, `ComparisonBoard` — sem estado próprio de sessão, recebem props.
- Camada pura: `lib/orders.ts` concentra regras de contagem/pedidos (sem dependência de React). Utils genéricos em `lib/utils.ts` (`getErrorMessage`).
- Tipos: `types/app.ts` (domínio da UI/sessão) e `types/database.ts` (linhas do banco + `Database` para o supabase-js).

### Mapa de módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Gate de autenticação: `useAuth` decide entre `LoginScreen` (anônimo) e `Dashboard` (logado); consulta `public.profiles`, define `userRole` e desloga perfil `is_active = false` |
| `src/hooks/useAuth.ts` | Sessão Supabase (`getSession` + `onAuthStateChange`), `signIn`/`signOut` |
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
| `src/components/Dashboard.tsx` | Conteúdo autenticado: compõe hooks de sessão/catálogo e renderiza telas; aplica RBAC por cargo |
| `src/components/LoginScreen.tsx` | Tela de login (email/senha via `signInWithPassword`), erros visuais e indicador de carregamento |
| `src/components/CollaboratorsBoard.tsx` | Gestão de usuários (visível só p/ `admin`): cadastra gerente (`auth.signUp` + `profiles`, restaurando a sessão do admin) e lista/edita loja, cargo e acesso. Cards colapsáveis com cabeçalho no mesmo estilo do `Section` do `CatalogBoard` |
| `src/components/AppHeader.tsx` | Cabeçalho: seletor loja/pedido, "Nova contagem", indicador `saving`, nome do usuário (toque abre popover breve ~2,5s com o nome completo) + badge de cargo + Sair (`signOut`) |
| `src/components/AppNav.tsx` | Tabs + botão "Concluir Pedido" logo à direita da aba "Contagem" (habilita via `canFinish`; `finishing`/`totalCounted` para estado) |
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
| Header | `AppHeader` | Troca loja (`selectStore`, seletor só p/ `admin`, escolha lembrada em `localStorage`), escolhe pedido (`selectOrder`), nova contagem (`newCount`), indicador `saving`, nome do usuário (toque mostra o nome completo em popover ~2,5s) + badge de cargo (ADMIN/GERENTE) + botão Sair (`signOut`) |
| Navegação | `AppNav` | Tabs + botão "Concluir Pedido" à direita da aba "Contagem" (`handleFinishOrder` → `finishOrder` + `bumpReport`) se `canFinish` |
| Barra de status | `MobileStatusBar` | Resumo: loja, total contado, pedido corrente |
| Toast | `FlashToast` | Notificações via `useFlash` (`notify`) |

- `locksOrder` = `currentOrder !== null && currentOrder.status !== 'Rascunho'` — trava edição quando o pedido não é rascunho.
- Concluir um pedido navega para `entry` ("Modo Digitação"); em seguida o `comparativo` compara com a última contagem.

## Regras de domínio (resumo)

- **status** do pedido: `Rascunho` → `Concluido` → `Lancado` (valores exatos do banco, sem acento em "Concluido").
- **Autenticação/perfil**: `useAuth` gerencia a sessão (`getSession` + `onAuthStateChange`); após o login, `App.tsx` consulta `public.profiles` (`id`, `email`, `username`, `full_name`, `store_id`, `role`, `is_active`) e define `userRole`. Login aceita username ou e-mail — sem `@`, o `LoginScreen` resolve o e-mail via `profiles.username`. Perfil ausente assume `gerente`; perfil com `is_active = false` é deslogado.
- **Cargos (RBAC)**: `admin` acessa todas as abas (Contagem, Digitação, Cadastro & Produtos, Comparativo) e o seletor de qualquer loja. `gerente` vê apenas Contagem e Digitação, fica vinculado à `store_id` do perfil (sem seletor de loja) e gerencia colaboradores nunca — cadastro/edição de usuários só na aba Cadastro, exclusiva do `admin`.
- **Cadastro de usuário**: `CollaboratorsBoard` (aba 3) usa `supabase.auth.signUp` (sem service_role) com `options.data` (`username`/`full_name`/`store_id`/`role`); o trigger `handle_new_user` cria o perfil e um `profiles.update().eq('id', data.user.id)` best-effort faz a reconciliação (sem `upsert`, não trava o formulário). Username é obrigatório (minúsculo, sem espaços); e-mail é opcional — se vazio, gera `${username}@sistema.local`. Se o Supabase trocar a sessão para o novo usuário, restaura a sessão do admin via `setSession`. Revogação = `profiles.is_active = false`.
- **`itemKey`** identifica um item contado: `` `${productId}::${variationId}` ``.
- **Variação sintética**: produtos sem variações cadastradas usam `id: ''` (`SYNTHETIC_VARIATION_ID`); `defaultVariationForProduct` gera essa variação na hora.
- **Variações do produto (Cadastro)**: o formulário de produto usa **chips** com nomes globais únicos de `product_variations` (busca no load + merge com `catalog.variations`). Salvar sincroniza vínculos do produto: cria variação faltante (`price: 0`, `is_available: true`), reativa (`is_available = true`) e **desmarcar só desativa** (`is_available = false`) — nunca deleta. Exclusão manual apenas na seção "Variações / Pesos" (lixeira, com `confirm`).
- **Persistência**: a cada save, atualiza o `orders` e reescreve os `order_items` (delete + insert) com `is_entered_in_legacy`.
- **Preferência de loja**: a troca manual de loja (`selectStore`, seletor só p/ `admin`) grava em `localStorage` (`pedidos:selectedStore:<userId>`) e a carga a respeita (validada contra o catálogo). `gerente` não grava — continua preso à `store_id` do perfil.
- **Sugestões**: vêm da view `vw_product_suggestions` por loja; `fetchSuggestions` recarrega ao trocar de loja e ao "nova contagem" (`newCount`) — sem precisar de F5; exibidas quando o item ainda não tem quantidade.
- **Ordenação da digitação**: `compareByEntryCode` — por código PLU/SKU (numérico) e depois nome da variação.
- **Resumo em texto**: `buildOrderSummary` (`lib/orderText.ts`) gera o pedido para colagem (WhatsApp/legado), com ordem PLU/SKU; `copyTextToClipboard` tem fallback via `document.execCommand`.
- **Lista de pedidos**: máx. 25 por loja, ordenada por `updated_at desc`.

## Fontes de verdade (onde procurar)

- **Schema/colunas**: `src/types/database.ts` — canônico (alimenta o generic do supabase-js). `docs/data-model.md` resume a semântica — se conflitar, vale o tipo.
- **Regras de contagem/pedidos**: `src/lib/orders.ts` (funções puras, sem React).
- **Resumo em texto / digitação**: `src/lib/orderText.ts` (formato ordenado por código) + `compareByEntryCode` em `types/app.ts`.
- **Utils genéricos**: `src/lib/utils.ts` (`getErrorMessage`, datas, `parseNumber`, `emptyText`).
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

- Branch: `agente` — modularização concluída (`App.tsx` é o gate de auth; `Dashboard.tsx` ~conteúdo autenticado; `useStoreSession` ~394).
- `HEAD`: `987acf9` ("melhorias para contexto de agentes e readme adicionado"). Autenticação B2B implementada (`useAuth`, `LoginScreen`, RBAC por cargo, `CollaboratorsBoard` com `auth.signUp` + restauração de sessão do admin + revogação) — alterações ainda não commitadas.
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
- Ao mexer em hooks, valide com `npm run typecheck` e `npm run build`.

## Receita para mudanças seguras

1. Leia este `AGENTS.md`; abra `docs/architecture.md` (mecânica) e `docs/data-model.md` (schema) quando o trecho for sensível (persistência, realtime, tipos).
2. Mantenha as convenções: sem comentários por padrão (sobrepujado por regras do framework ou boas práticas), newline final, mensagens de UI em pt-BR.
3. Não mude contrato de `useStoreSession`, debounce 700ms, guard do realtime nem delete+insert sem justificativa.
4. Não chame hooks condicionalmente; sub-hooks recebem estados/setters por parâmetro; callbacks estáveis para não re-subscribe do channel.
5. Faça a alteração e valide: `npm run typecheck` e `npm run build`. Smoke opcional: `npm run dev`.
6. Preserve re-exports e o padrão `Recordish` (`& Record<string, unknown>`) ao tocar em tipos `Insert`.
7. Se o domínio mudar, atualize `AGENTS.md`/`docs/` — contexto obsoleto custa leitura de código.
