---
description: Carrega arquitetura e modelo de dados completos para tarefas que exigem profundidade no projeto.
agent: build
---

Antes de continuar, leia na íntegra e incorpore o contexto:

1. `AGENTS.md` — visão geral do projeto (já costuma estar em contexto).
2. `docs/architecture.md` — mecânica dos hooks, persistência (`useDraftPersistence`), realtime (`useRealtimeOrder`) e fluxos.
3. `docs/data-model.md` — schema do banco, status de pedido e regras de domínio.

Em seguida, confirme em 3–5 frases o que entendeu sobre: composição de hooks, invariantes de persistência (debounce 700ms, guard `saving || dirty || <1500ms`, delete+insert dos itens) e os status do pedido. Depois prossiga com a tarefa.

$ARGUMENTS
