# Modelo de dados

Schema e regras de domínio. Fontes: `src/types/database.ts` (tipos) e o banco Postgres/Supabase. Consulte `architecture.md` para a mecânica de escrita.

## Tipos e generic do Supabase

- `types/database.ts` declara interfaces por tabela (`Row`) + `Insert`/`Update`, e a interface `Database` usada no `createClient<Database>()` de `lib/supabase.ts`.
- Interfaces não têm index signature implícita; o supabase-js exige `Record<string, unknown>`. Padrão do repo: `type Recordish<T> = T & Record<string, unknown>` aplicado em todas as `Row/Insert/Update`. **Ao criar novos tipos `Insert`, siga esse padrão.**

## Conjuntos de dados

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
| created_at | timestamptz |

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

### vw_product_suggestions (view)
| coluna | tipo |
| --- | --- |
| store_id | uuid |
| product_id | uuid |
| product_variation_id | uuid null |
| suggested_quantity | int |
| last_ordered_at | timestamptz |

- Sugestões por loja, montadas em `SuggestionsMap` na carga (`itemKey` → `suggested_quantity`).

## Regras de domínio

- **`itemKey`**: `` `${productId}::${variationId}` `` (`itemKey(productId, variationId)` em `types/app.ts`); campo `CountedItem.key`.
- **Variação sintética**: produtos cadastrados sem variações usam `SYNTHETIC_VARIATION_ID = ''`; `defaultVariationForProduct(product)` gera `{ id: '', product_id, name: 'Unidade', weight_label: unit_type, sku_code: code, price: 0, is_available: true }`. Na persistência, `product_variation_id` vira `null` quando `variation.id` é `''`.
- **`CountedItem`** (sessão): `{ key, product, variation, quantity, isEnteredInLegacy }` — quantidade e flag são o estado de digitação; o restante é referência do catálogo (reconciliado quando o catálogo muda).
- **Comparação de conteúdo**: `sameCountedList` compara `key`/`quantity`/`isEnteredInLegacy` (lista local vs. servidor no realtime). `orderDisplayEquals` compara `status`/`total_items`/`requester_name`/`notes` para mesclar pedidos preservando identidade e evitando re-render.
- **Mescla de pedidos**: `mergeOrdersList` funde versão sincronizada na lista de pedidos da sessão, devolvendo o array original quando nada muda.
- **Rótulo no seletor de pedidos** (`orderLabel` em `lib/orders.ts`): rascunho sem itens → "Novo rascunho · dd/mm"; senão "Status · N itens · dd/mm" (status traduzido para exibição).
- **Ordenação da digitação** (`compareByEntryCode` em `types/app.ts`): código PLU/SKU (numérico pt-BR) e depois nome da variação — critério da listagem do Modo Digitação e do resumo em texto.
