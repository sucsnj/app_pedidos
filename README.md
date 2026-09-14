# pedidos-abastecimento

App web mobile-first para contagem e pedidos de abastecimento por loja. Uma **contagem** é um pedido (`orders`) com itens (`order_items`): o usuário digita quantidades, finaliza o pedido (`Concluido`) e depois há o lançamento (`Lancado`).

Stack: React 19, TypeScript 5.6 (strict), Vite 6, Tailwind 4 e Supabase (Postgres + Realtime). Sem testes automatizados.

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

## Estrutura

- `src/App.tsx` — composição de hooks e roteamento de telas.
- `src/hooks/` — `useStoreSession` (sessão/orquestrador), `useDraftPersistence` (persistência/autosave), `useRealtimeOrder` (subscription), `useCatalog`, `useFlash`, `useStoreReports`.
- `src/components/` — header, nav, telas de loading/erro, toast, status bar e boards (`CountingBoard`, `DataEntryBoard`, `CatalogBoard`, `ComparisonBoard`).
- `src/lib/` — lógica pura de pedidos (`orders.ts`), resumo em texto (`orderText.ts`), utilitários e cliente Supabase.
- `src/types/` — domínio da UI (`app.ts`) e tipos do banco (`database.ts`).

## Fluxo de uso

1. **Contagem** (`count`): digita quantidades por produto, com sugestões e autosave; salvar manual à parte.
2. **Concluir**: pedido muda para `Concluido` e o app vai para a Digitação.
3. **Digitação** (`entry`): lista os itens do pedido e marca `isEnteredInLegacy`.
4. **Comparativo** (`comparativo`): compara a contagem corrente com a última e mostra relatórios.

## Documentação técnica

- `AGENTS.md` — contexto de trabalho para agentes (convenções, arquitetura, invariantes).
- `docs/architecture.md` — mecânica dos hooks e fluxos.
- `docs/data-model.md` — schema do banco e regras de domínio.
