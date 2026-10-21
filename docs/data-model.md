# Modelo de dados

Schema e regras de domínio. Fontes: `src/types/database.ts` (tipos) e o banco Postgres/Supabase. Consulte `architecture.md` para a mecânica de escrita.

## Tipos e generic do Supabase

- `types/database.ts` declara interfaces por tabela (`Row`) + `Insert`/`Update`, e a interface `Database` usada no `createClient<Database>()` de `lib/supabase.ts`.
- Interfaces não têm index signature implícita; o supabase-js exige `Record<string, unknown>`. Padrão do repo: `type Recordish<T> = T & Record<string, unknown>` aplicado em todas as `Row/Insert/Update`. **Ao criar novos tipos `Insert`, siga esse padrão.**

## Conjuntos de dados

> Módulo de vendas (`/management`): **não usa tabelas** — meta e vendedores são informados no formulário e calculados em memória (`src/lib/salesMetrics.ts`, DTOs em `src/types/sales.ts`).

### stores
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| code | text null |
| name | text |
| is_active | boolean |
| created_at | timestamptz |

### categories
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| name | text |
| display_order | int |
| created_at | timestamptz |

### products
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| category_id | uuid FK → categories |
| code | text null (PLU/SKU) |
| name | text |
| unit_type | text |
| is_active | boolean |
| display_order | int (ordem dentro da categoria) |
| created_at | timestamptz |

- Ordens de exibição: categorias por `display_order`; produtos ordenados por `display_order` e depois `name` dentro de cada categoria (query da carga em `useCatalog`).

### product_variations
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| product_id | uuid FK → products |
| name | text |
| weight_label | text null |
| sku_code | text null |
| price | numeric |
| is_available | boolean |
| created_at | timestamptz |

### orders
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| store_id | uuid null FK → stores |
| requester_name | text |
| status | enum: `Rascunho` / `Concluido` / `Lancado` |
| total_items | int |
| notes | text null |
| created_at | timestamptz |
| updated_at | timestamptz |

- **status**: `Rascunho` → `Concluido` → `Lancado`. "Concluido" sem acento (valor exato do banco); UI exibe "Concluído".
- Lista por loja: máx. 25, `updated_at desc` (limite aplicado na query da carga).

### order_items
| coluna | tipo |
| --- | --- |
| id | uuid PK |
| order_id | uuid FK → orders |
| product_id | uuid null FK → products |
| product_variation_id | uuid null FK → product_variations |
| product_code | text null |
| product_name | text |
| variation_name | text null |
| quantity | int |
| is_entered_in_legacy | boolean |
| created_at | timestamptz |

- **Estratégia de escrita**: a cada persist do rascunho → `update` em `orders` e reescrita integral de `order_items` (**delete + insert**, via `toOrderItemRows`, que filtra `quantity > 0`). Não incrementa linhas; é uma decisão base de concorrência.
- `product_code`/`product_name`/`variation_name` são desnormalizados para o pedido não perder contexto se o catálogo mudar.
- São inseridos apenas itens com `quantity > 0` — itens zerados somem da base.

### profiles
| coluna | tipo |
| --- | --- |
| id | uuid PK (referência a `auth.users`) |
| email | text null (desnormalizado p/ listar usuários — `auth.users` não é consultável no client) |
| username | text null, único (login alternativo; cadastro obrigatório, minúsculo, sem espaços) |
| store_id | uuid null FK → stores |
| role | text: `admin` / `gerente` |
| full_name | text null |
| is_active | boolean (revogação de acesso) |
| created_at | timestamptz |

- Perfil consultado por `App.tsx` após o login (`select('*').eq('id', user.id).maybeSingle()`); define `profile`/`userRole` e faz `console.log("Dados do Perfil no Supabase:", profile, "Erro:", error)`. Sem perfil (ou falha de leitura), assume `gerente`; com `is_active = false`, `App.tsx` faz `signOut`.
- `role` (RBAC): `admin` acessa todas as abas (Contagem, Digitação, Cadastro & Produtos, Comparativo) e o seletor de qualquer loja. `gerente` acessa só Contagem e Digitação e fica vinculado à `store_id`.
- `store_id` vira a loja selecionada automaticamente (`preferredStoreId` na carga da sessão).
- Login: `LoginScreen` aceita e-mail completo ou username. Se o texto não tem `@`, resolve o e-mail via `select('email').eq('username', <lowercase>).maybeSingle()` e chama `signInWithPassword` com o e-mail achado.
- Cadastro/edição: `CollaboratorsBoard` cria o usuário via `supabase.auth.signUp` com `options.data` (`username`/`full_name`/`store_id`/`role`); o trigger `handle_new_user` do banco cria o perfil automaticamente a partir dos metadados. Se algum dado precisar de ajuste, um `profiles.update().eq('id', data.user.id)` enviado logo após o signUp faz a reconciliação — sem bloquear o formulário e sem `upsert`. E-mail é opcional — se vazio, gera `${username}@sistema.local`. Se o signUp trocar a sessão, restaura a sessão do admin via `setSession`. Revogação = `is_active = false`.

### vw_product_suggestions (view)
| coluna | tipo |
| --- | --- |
| store_id | uuid |
| product_id | uuid |
| product_variation_id | uuid null |
| suggested_quantity | int |
| last_ordered_at | timestamptz |

- Sugestões por loja, montadas em `SuggestionsMap` na carga (`itemKey` → `suggested_quantity`).

### sellers (módulo de Gestão)
| coluna | tipo |
| --- | --- |
| id | uuid pk |
| name | text not null (único por loja e entre os ativos) |
| store_id | uuid null → `stores.id` (loja selecionada; `null` = global/legado) |
| is_active | boolean default true (false = desativado, histórico preservado) |
| created_by | uuid null → `auth.users.id` (default `auth.uid()`) |
| updated_by | uuid null → `auth.users.id` (trigger `sellers_touch_audit`) |
| updated_at | timestamptz default now() (trigger) |
| created_at | timestamptz default now() |

- Cadastro de vendedores **vinculado à loja** (`store_id`): o cadastro usa a loja selecionada na tela `/management`; a listagem mostra os vendedores da loja + os globais (`store_id is null`, os criados antes da migration). Nome único **por loja e entre os ativos** (`sellers_name_store_active_unique`); **desativar** (`is_active = false`) tira o vendedor da lista mas preserva o histórico e os lançamentos já registrados.
- **RLS**: `admin` acessa todas as lojas; `gerente` só a loja do seu perfil (`store_id = public.current_user_store_id()`), além dos vendedores globais (leitura). Exclusão física é só do `admin`.

### sales_calculations (histórico de consolidações)
| coluna | tipo |
| --- | --- |
| id | uuid pk |
| store_id | uuid null → `stores.id` |
| reference_date | date default current_date |
| total_sold | numeric(14,2) |
| effective_base_total | numeric(14,2) |
| custom_total_base | numeric(14,2) null (meta informada) |
| average_ticket | numeric(14,2) |
| record_count | int |
| target_achievement_percentage | numeric(7,2) null |
| top_sale | jsonb null (`{ id, name, value }`) |
| created_at | timestamptz default now() |
| created_by | uuid null → `auth.users.id` (default `auth.uid()`) |

- **Snapshot** de cada cálculo registrado: base para análises futuras (tendência, meta atingida, ranking). `store_id` guarda a loja selecionada no registro; a listagem do histórico filtra pela loja atual (inclui os lançamentos legados com `store_id is null`). Excluir a consolidação remove em cascata as vendas vinculadas (`sales_records.calculation_id`).
- **RLS**: `admin` acessa todas as consolidações; `gerente` só as da loja do perfil. As vendas por vendedor (`sales_records`) herdam o escopo da consolidação (`public.can_access_calculation`).

### sales_records (vendas por vendedor)
| coluna | tipo |
| --- | --- |
| id | uuid pk |
| calculation_id | uuid null → `sales_calculations.id` (cascade) |
| seller_id | uuid → `sellers.id` (cascade) |
| seller_name | text not null (cópia do nome no momento do lançamento) |
| amount | numeric(14,2) not null (check `>= 0`) |
| percentage | numeric(7,2) default 0 |
| reference_date | date default current_date |
| created_at | timestamptz default now() |
| created_by | uuid null → `auth.users.id` (default `auth.uid()`) |

- Uma linha por vendedor lançado em cada consolidação; `percentage` guarda a participação individual daquela consolidação. `seller_name` é a **cópia** do nome no momento do lançamento — renomear o vendedor não altera o histórico.

- **DDL**: `supabase/migrations/20261003000100_management_sales.sql` (tabelas + índices + RLS liberado para `authenticated`), `20261003000200_sellers_store.sql` (`sellers.store_id`), `20261003000300_sellers_unique_per_store.sql` (índice único por loja/ativos) e `20261003000400_management_rls.sql` (RLS por loja + auditoria). O schema real vive no Supabase — aplicar as migrations antes de usar a tela.

## Regras de domínio

- **`itemKey`**: `` `${productId}::${variationId}` `` (`itemKey(productId, variationId)` em `types/app.ts`); campo `CountedItem.key`.
- **Variação sintética**: produtos cadastrados sem variações usam `SYNTHETIC_VARIATION_ID = ''`; `defaultVariationForProduct(product)` gera `{ id: '', product_id, name: 'Unidade', weight_label: unit_type, sku_code: code, price: 0, is_available: true }`. Na persistência, `product_variation_id` vira `null` quando `variation.id` é `''`.
- **`CountedItem`** (sessão): `{ key, product, variation, quantity, isEnteredInLegacy }` — quantidade e flag são o estado de digitação; o restante é referência do catálogo (reconciliado quando o catálogo muda).
- **Comparação de conteúdo**: `sameCountedList` compara `key`/`quantity`/`isEnteredInLegacy` (lista local vs. servidor no realtime). `orderDisplayEquals` compara `status`/`total_items`/`requester_name`/`notes` para mesclar pedidos preservando identidade e evitando re-render.
- **Mescla de pedidos**: `mergeOrdersList` funde versão sincronizada na lista de pedidos da sessão, devolvendo o array original quando nada muda.
- **Rótulo no seletor de pedidos** (`orderLabel` em `lib/orders.ts`): rascunho sem itens → "Novo rascunho · dd/mm"; senão "Status · N itens · dd/mm" (status traduzido para exibição).
- **Ordenação da digitação** (`compareByEntryCode` em `types/app.ts`): código PLU/SKU (numérico pt-BR) e depois nome da variação — critério da listagem do Modo Digitação e do resumo em texto.
