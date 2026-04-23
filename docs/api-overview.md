# Visão geral da API

Todos os endpoints vivem sob o prefixo `/api/v1`. A fonte autoritativa é a
documentação interativa gerada pelo FastAPI em runtime:

- **Swagger UI** — <http://localhost:8000/docs>
- **ReDoc** — <http://localhost:8000/redoc>
- **OpenAPI JSON** — <http://localhost:8000/api/v1/openapi.json>

Este documento é uma visão de contexto, não substituto do Swagger. Use-o
para entender *como* a API está organizada; use o Swagger para ver *o que*
cada endpoint aceita e devolve.

---

## Autenticação

| Método | Path | Descrição |
| --- | --- | --- |
| `POST` | `/auth/login` | Recebe `email` e `password`, retorna `access_token` e grava `refresh_token` em cookie `httpOnly` |
| `POST` | `/auth/refresh` | Lê o `refresh_token` do cookie e retorna um novo `access_token` |
| `POST` | `/auth/logout` | Invalida o cookie de refresh |
| `GET`  | `/auth/me` | Retorna o usuário autenticado a partir do `access_token` |

Os endpoints protegidos exigem `Authorization: Bearer <access_token>`. A
dependência `get_current_user` em [`api/deps.py`](../backend/app/api/deps.py)
é a porta única de autenticação. Para endpoints restritos ao gerente, existe
`require_gerente`. Ver [ADR 0002](adr/0002-refresh-token-cookie.md).

---

## Usuários (`/users`)

Apenas GERENTE. CRUD completo com soft-delete.

| Método | Path | Papel |
| --- | --- | --- |
| `GET` | `/users` | GERENTE |
| `POST` | `/users` | GERENTE |
| `GET` | `/users/{id}` | GERENTE |
| `PUT` | `/users/{id}` | GERENTE |
| `DELETE` | `/users/{id}` | GERENTE |

---

## Ruas e clientes (`/streets`, `/clients`)

| Recurso | Observações |
| --- | --- |
| `/streets` | CRUD. `GET /streets/{id}/clients` lista clientes da rua |
| `/clients` | CRUD com vínculo many-to-many a ruas |
| `/clients/{id}/balance` | Retorna saldo calculado em runtime ([ADR 0001](adr/0001-saldo-calculado.md)) |
| `/clients/{id}/statement` | Extrato de vendas, parcelas e pagamentos |

Cada cliente pode estar em múltiplas ruas (tabela `client_streets` com
`house_number`, `reference`, `display_order`).

---

## Rotas (`/routes`, `/route-streets`, `/route-templates`)

Templates são blueprints reutilizáveis; rotas são instâncias do dia
derivadas de um template. Ver [ADR 0005](adr/0005-templates-imutaveis-de-rota.md).

| Método | Path | Descrição |
| --- | --- | --- |
| `GET` | `/route-templates` | Lista templates |
| `POST` | `/route-templates` | Cria template com ruas ordenadas |
| `PUT` | `/route-templates/{id}` | Edita template (não afeta rotas já criadas) |
| `POST` | `/routes` | Cria rota do dia (pode duplicar um template) |
| `GET` | `/routes/{id}` | Retorna rota com suas `route_streets` |
| `PATCH` | `/routes/{id}` | Atualiza status da rota |
| `PATCH` | `/route-streets/{id}` | Atualiza status de uma rua da rota |

---

## Produtos (`/products`)

Catálogo simples. `current_stock` é ajustado **manualmente** pelo gerente —
venda não movimenta estoque automaticamente (decisão consciente para ajuste
manual ao fim do dia).

| Método | Path | Papel |
| --- | --- | --- |
| `GET` | `/products` | Autenticado |
| `POST` | `/products` | GERENTE |
| `PUT` | `/products/{id}` | GERENTE |
| `DELETE` | `/products/{id}` | GERENTE (soft-delete) |

---

## Vendas (`/sales`)

| Método | Path | Descrição |
| --- | --- | --- |
| `GET` | `/sales` | Lista com filtros: cliente, período, tipo, modo, vendedor |
| `POST` | `/sales` | Cria venda com itens e (se FIADO) parcelas |
| `GET` | `/sales/{id}` | Retorna venda + itens + parcelas + desconto |
| `PUT` | `/sales/{id}` | Edita. Bloqueia itens/desconto se há parcela paga |
| `DELETE` | `/sales/{id}` | Soft-delete (GERENTE) |

**Invariantes do POST/PUT:**

- `amount` é sempre recalculado pelo backend: `SUM(items.subtotal) − discount`.
- `SUM(installments.amount)` deve bater com `amount` (tolerância 0,01).
- `route_street_id` só é aceito quando `sale_type == "ROTA"`.
- Em FIADO sem `installments`, backend cria 1 parcela com
  `due_date = sale_date + 30 dias`.

---

## Pagamentos (`/payments`)

| Método | Path | Descrição |
| --- | --- | --- |
| `GET` | `/payments` | Lista com filtros: cliente, rota, data |
| `POST` | `/payments` | Cria pagamento + aplica em parcelas |
| `PUT` | `/payments/{id}` | Edita campos neutros (notes, payment_date) |
| `DELETE` | `/payments/{id}` | Soft-delete (GERENTE) |

**Dois modos de aplicação:**

1. **Automático (FIFO).** Sem `installment_applications` no body — o
   backend aplica o valor na ordem `due_date ASC, number ASC` entre as
   parcelas em aberto do cliente. Se sobrar, amortiza `opening_balance`.
2. **Explícito.** Com `installment_applications: [{installment_id, amount}]`
   — útil quando o cliente quer quitar uma parcela específica (e.g., a de
   número 3, mesmo havendo pendências anteriores).

Detalhes do algoritmo FIFO em [ARCHITECTURE.md — Fluxo 2](../ARCHITECTURE.md#fluxo-2--pagamento-com-matching-fifo).

---

## Relatórios (`/reports`)

Apenas GERENTE. Agregações em SQL via `text()` com parâmetros nomeados.

| Path | Descrição |
| --- | --- |
| `/reports/resumo` | Totais de vendas e pagamentos do dia |
| `/reports/por-vendedor` | Desempenho por vendedor no período |
| `/reports/por-periodo` | Série histórica de vendas/pagamentos |

---

## Convenções gerais

- **Status codes:** `200` leitura, `201` criação, `204` exclusão sem corpo,
  `400` erro de regra de negócio, `401` não autenticado, `403` sem
  permissão, `404` não encontrado, `422` erro de validação (Pydantic).
- **Timestamps:** `created_at` e `updated_at` em timezone UTC, retornados
  como ISO 8601.
- **Datas:** `sale_date`, `payment_date`, `due_date` são `date` (sem hora).
- **Valores monetários:** retornados como `float` para compatibilidade com
  JSON, mas internamente são `Decimal(12, 2)`.
- **IDs:** UUID v4 em todas as tabelas.
- **Soft-delete:** entidades principais expõem `is_active`. Soft-deletes
  somem de `GET` de listagem e retornam 404 em `GET by id`. Ver
  [ADR 0004](adr/0004-soft-delete-via-is-active.md).
