# ADR 0005 — Templates imutáveis de rota

## Status

Aceita.

## Contexto

Uma rota diária é uma sequência ordenada de ruas que o vendedor vai visitar
no dia. Na maior parte dos dias o vendedor repete a mesma rota (ex.: segunda
é sempre o bairro A, terça é sempre o bairro B). Mas dentro dessa rota do
dia, o vendedor precisa de estado *efêmero*:

- Status por rua (`PENDING`, `IN_PROGRESS`, `COMPLETED`).
- Timestamps de início e fim da visita.
- Vendas e pagamentos vinculados à instância daquela rua naquele dia.

Ao mesmo tempo, o gerente quer configurar "rotas-padrão" de forma reutilizável
e sem se preocupar em poluir histórico.

A tentação inicial é ter uma única tabela `routes` com um flag `is_template`.
Isso falha porque o template acumula estado (`started_at`, `completed_at`)
que não faz sentido ter em um template, e porque editar o template depois
de já ter sido usado em rotas passadas pode corromper o histórico.

## Decisão

**Duas entidades separadas:**

- **`route_templates` + `route_template_streets`** — blueprint reutilizável.
  Contém `name`, `description` e a sequência de ruas com `visit_order`. **Não
  tem estado de execução.** É tratado como *imutável* — alterar um template
  não altera rotas passadas que derivaram dele.
- **`routes` + `route_streets`** — instância do dia. Criada a partir da
  duplicação de um template (copia nome e ruas ordenadas) e ganha vida
  própria a partir daí. Status da rota, status por rua, timestamps e
  vínculos com vendas/pagamentos vivem aqui.

O fluxo do vendedor: escolhe um template → o backend duplica para uma nova
`route` daquele dia → a partir daí ele trabalha sobre `route_streets`.

## Consequências

**Positivas:**

- Editar o template para o próximo dia não afeta rotas passadas nem a rota
  em andamento. *Imutabilidade de referência*.
- Dados do dia ficam limpos — sem lixo de template (`started_at=NULL`,
  `completed_at=NULL`) poluindo listagens.
- A relação `sales.route_street_id` é inequívoca: aponta para uma rua
  específica em um dia específico, com seu `status` e `visit_order` do dia.

**Negativas:**

- Duplicação de dados: cada rota do dia copia as ruas do template. Em
  volumes baixos (uma rota por dia, ~5 ruas cada) é desprezível; em escala
  maior seria possível repensar.
- Mais uma tabela para quem está entendendo o domínio. O trade-off é que a
  semântica fica explícita (template vs. instância) em vez de implícita num
  flag.
- Se o gerente quiser uma "biblioteca de templates com versionamento"
  (e.g., "qual era o template tal em 2024?"), o modelo atual não cobre. Não
  foi priorizado porque o uso real só edita templates raramente.
