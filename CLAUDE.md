# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sistema de gestão de vendas e fiado (caso de uso: loja de bairro, produtos de limpeza). Substitui caderno físico de controle de fiado. Dois canais: **rota** (vendedor móvel) e **loja** (balcão). Vendas de loja são registradas em `/vendas/nova` (wizard de 3 passos: cliente → produtos → pagamento) — não existe rota `/loja` separada. A página `/vendas` exibe apenas o histórico/analytics.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Python 3.11 · FastAPI + SQLAlchemy (sync/psycopg2) + Alembic |
| Banco | PostgreSQL 16 |
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Estado | TanStack Query v5 |
| Forms | react-hook-form + zod |
| HTTP | Axios com interceptors |
| Infra | Docker Compose |

## Comandos

### Ambiente completo (Docker)

```bash
docker-compose up --build          # sobe db + backend + frontend
docker-compose up -d db backend    # sobe só o backend
```

Frontend: <http://localhost:3000> | Docs da API: <http://localhost:8000/docs>

### Backend (dentro de `backend/`)

```bash
# Ativar venv (Windows)
.\venv\Scripts\Activate.ps1

# Formatar antes de commitar
black . && isort .

# Migrations
alembic upgrade head                                   # aplica todas as migrations
alembic revision --autogenerate -m "descricao"         # nova migration (rev atual: 012)
alembic downgrade -1                                   # reverte última migration

# Seed sintético (popula ruas, produtos, usuários, clientes, rota, vendas e pagamentos)
python -m app.db.seed_demo                             # dados de demonstração

# Testes (requerem banco rodando — usa DATABASE_URL do .env)
pytest                                                 # todos os testes
pytest tests/test_auth.py                              # arquivo específico
pytest tests/test_auth.py::test_login_success          # teste específico
pytest -x                                              # para no primeiro erro
```

### Frontend (dentro de `frontend/`)

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run lint       # eslint

# Adicionar componente shadcn/ui (NUNCA editar components/ui/ manualmente)
npx shadcn@latest add <componente>
```

## Arquitetura

### Backend

O router principal (`app/api/v1/router.py`) registra todos os sub-routers sob `/api/v1`. A lógica de negócio fica **exclusivamente** nos services — os routers apenas recebem a requisição, chamam o service e retornam o response_model.

```text
app/
├── api/
│   ├── deps.py          ← get_db, get_current_user, require_gerente
│   └── v1/              ← auth, users, streets, clients, routes, route_streets,
│                           route_templates, sales, payments, products, reports
├── core/
│   ├── config.py        ← Settings via pydantic-settings (lê .env)
│   └── security.py      ← JWT, hash de senha
├── db/
│   ├── session.py       ← SessionLocal, get_db
│   └── seed_demo.py     ← seed sintético (Faker pt_BR)
├── models/              ← SQLAlchemy ORM (PascalCase singular)
├── schemas/             ← Pydantic I/O (sufixos Create/Update/Response)
└── services/            ← toda a lógica de negócio
```

**Modelos existentes:** `User`, `Street`, `Client`, `ClientStreet` (many-to-many com `house_number`/`display_order`), `Route`, `RouteStreet`, `RouteTemplate`, `RouteTemplateStreet`, `Sale`, `SaleItem`, `SaleInstallment`, `InstallmentPayment`, `Payment`, `Product`.

**Saldo do cliente** é sempre calculado em runtime — nunca armazenado. Lógica em `client_service.py`: `saldo = SUM(sales FIADO) - SUM(payments)`.

**Produtos e itens de venda:** tabela `products` (catálogo com preço e estoque) + tabela `sale_items` (snapshot do item no momento da venda). O estoque **não é movimentado automaticamente** — o gerente ajusta manualmente via CRUD de produto. O `amount` da venda é sempre calculado pelo backend: `amount = SUM(qty × unit_price) − discount`.

**Parcelas (FIADO):** `sale_installments` é criada somente quando `payment_mode == "FIADO"`. Um `Payment` pode cobrir partes de múltiplas parcelas via `installment_payments` (FIFO matching). `route_street_id` é `NULL` em vendas de loja, não-`NULL` em vendas de rota.

**Edição de venda (`update_sale`):** aceita `items`, `installments`, `discount`, `payment_mode` e `description`. Regra de segurança: se qualquer parcela tiver `paid_amount > 0`, a edição de `items` e `discount` é bloqueada (HTTP 400). Quando `items` ou `discount` mudam, `amount` é sempre recalculado pelo backend (`SUM(subtotal) − discount`). Se `installments` não forem fornecidas mas o `amount` mudar em venda FIADO, uma parcela única é recriada automaticamente (due_date = sale_date + 30 dias).

**Templates de rota:** `route_templates` / `route_template_streets` são blueprints imutáveis — o gerente cria um template com ruas ordenadas e o vendedor duplica para criar a rota do dia.

**Autenticação:** access token em localStorage + refresh token em cookie httpOnly. A dependência `get_current_user` em `deps.py` é a porta de entrada de toda autorização — nunca contorná-la.

**Services** podem retornar dicts (não objetos ORM) quando precisam de campos computados como `seller_name` ou `client_name` — FastAPI valida normalmente contra o `response_model`.

### Testes de integração

Os testes em `backend/tests/` acessam o banco real (o mesmo do `.env`). Cada teste roda dentro de uma transação revertida ao final (`conftest.py` usa `join_transaction_mode="create_savepoint"`), mantendo o banco limpo sem seed ou banco separado.

### Frontend

```text
src/
├── app/(app)/           ← páginas autenticadas (layout com header + BottomNav)
│   ├── dashboard/       ← resumo do dia (vendas, pagamentos, rota ativa)
│   ├── vendas/          ← histórico/analytics (filtros por período, tipo, modo); botões editar/excluir por linha
│   │   ├── nova/        ← wizard de nova venda LOJA (3 passos: cliente → produtos → pagamento)
│   │   └── [saleId]/    ← extrato da venda: visualização + edição completa (itens, desconto, parcelas, obs.) + exclusão (GERENTE)
│   ├── clientes/        ← listagem, /novo, /[clientId] (extrato + saldo)
│   │   └── [clientId]/pagamento ← nova página combinada de venda/pagamento p/ cliente
│   ├── ruas/            ← listagem, /[streetId]
│   ├── produtos/        ← listagem, /novo, /[productId] (gerente; inclui ajuste de estoque)
│   ├── rota/            ← listagem, /nova, /templates, /[routeId],
│   │                       /[routeId]/rua/[routeStreetId] (tela principal de venda em rota)
│   └── gerente/         ← usuarios/, relatorios/ (acesso restrito a GERENTE)
├── app/(auth)/          ← login
├── components/
│   ├── rota/            ← SaleForm, PaymentForm, ClientCard, ProductPicker
│   ├── shared/          ← BottomNav
│   └── ui/              ← shadcn/ui (não editar manualmente)
├── hooks/               ← useClients, useRoutes, useSales, usePayments, useProducts,
│                           useUsers, useReports, useRouteTemplates, useDebounce
├── lib/
│   ├── api.ts           ← instância Axios com interceptors de token
│   ├── auth.ts          ← helpers de autenticação
│   ├── utils.ts         ← formatCurrency, formatDate, cn
│   └── constants.ts     ← QUERY_KEYS, ROLES, ROUTE_STATUS
├── providers/           ← AuthProvider, QueryProvider
└── types/               ← interfaces TypeScript por recurso
```

**Todas as query keys** ficam em `lib/constants.ts` — nunca criar strings de query key inline.

**`SaleForm`** é consumido exclusivamente em `ClientCard.tsx` (canal rota, `saleType="ROTA"`). O canal loja usa o wizard em `vendas/nova/page.tsx`, que implementa o mesmo schema Zod e lógica de cálculo diretamente na página (sem reutilizar o componente `SaleForm`). Recebe `saleType: "ROTA" | "LOJA"` e `routeStreetId` opcional.

**Extrato de venda (`vendas/[saleId]/page.tsx`):** página de dois modos — visualização (read-only) e edição (mesmo schema Zod e componentes de `nova/page.tsx`). Em modo edição: ProductPicker + carrinho editável, desconto, toggle A_VISTA/FIADO, parcelas editáveis, observação. Bloqueio automático de itens/desconto quando há parcelas pagas (aviso inline). Exclusão com confirmação inline visível apenas para GERENTE. O hook `useSale(id)` busca a venda individual via `GET /sales/:id`.

**Tela principal do vendedor:** `app/(app)/rota/[routeId]/rua/[routeStreetId]/page.tsx` — exibe os clientes da rua com `ClientCard` (que abre `SaleForm` e `PaymentForm`) em tempo real.

**SaleForm** não tem campo de valor livre. O total é calculado automaticamente a partir dos itens (`ProductPicker` + quantidade) menos desconto opcional. A validação de parcelas (FIADO) compara contra esse total calculado.

## Documentação de domínio

Os arquivos em `docs/` registram decisões de design que não estão visíveis no código:

- `docs/PLANO.md` — arquitetura geral, modelagem de dados, lista de endpoints, fases do projeto
- `docs/PLANO_ROTAS.md` — melhorias nas rotas, arquivamento, nomenclatura e reordenação de ruas nos templates
- `docs/PLANO_PRODUTOS.md` — catálogo de produtos, `SaleItem`, lógica de desconto, script de importação CSV
- `docs/PLANO_UX_VENDA.md` — redesign ERP-style do `SaleForm` (grid tabular, totalizador, parcelas, validação de estoque)

## Padrões Python (Backend)

**Formatação:** `black` (line-length = 88) + `isort` (profile = "black"). Rodar antes de commitar.

**Naming:**

- Classes: `PascalCase` | Funções/variáveis: `snake_case` | Constantes: `SCREAMING_SNAKE_CASE`
- Tabelas DB: `snake_case` plural | Models: `PascalCase` singular
- Schemas Pydantic: sufixo `Create`, `Update`, `Response`

**Banco:**

- ORM sempre (nunca SQL raw, exceto queries de relatório com `text()` e parâmetros nomeados)
- UUID como PK (nunca SERIAL)
- Soft-delete via `is_active = False` para entidades principais
- Toda migration tem `upgrade()` e `downgrade()`

## Padrões TypeScript/React (Frontend)

**Naming:**

- Componentes: `PascalCase` | Hooks: `use` + `camelCase` | Utilitários: `camelCase`
- Tipos/interfaces: `PascalCase` sem prefixo `I`

**Componentes:** `"use client"` explícito quando usa hooks ou eventos; Server Component por padrão. Props tipadas com `interface ComponentNameProps` no mesmo arquivo.

**Estado:** TanStack Query para todo estado do servidor (`useQuery` para leituras, `useMutation` para escritas). Nunca `useState` para dados da API. Após mutação: `queryClient.invalidateQueries()` nas queries afetadas.

**Estilização:** Tailwind exclusivamente; `cn()` de `lib/utils.ts` para classes condicionais; CVA para variantes.

**Forms:** `react-hook-form` + Zod sempre — nunca estado local para formulários.

## O que NUNCA fazer

### Backend

1. **NUNCA** colocar lógica de negócio nos routers — vai no service
2. **NUNCA** criar campo `saldo` na tabela `clients` — saldo é SEMPRE calculado
3. **NUNCA** deletar fisicamente `sales`, `payments`, `clients` — soft-delete ou estorno
4. **NUNCA** commitar `.env` — apenas `.env.example` no repositório
5. **NUNCA** retornar `hashed_password` em schemas `Response`
6. **NUNCA** fazer commit direto na branch `main`
7. **NUNCA** movimentar `current_stock` automaticamente na venda — estoque é ajustado manualmente pelo gerente
8. **NUNCA** recalcular `amount` da venda a partir do campo `amount` do input — usar sempre `SUM(sale_items.subtotal) − discount`

### Frontend

1. **NUNCA** usar `any` em TypeScript — criar interface ou usar `unknown`
2. **NUNCA** usar `fetch()` direto — sempre via `lib/api.ts` (Axios)
3. **NUNCA** armazenar o refresh_token em localStorage
4. **NUNCA** editar `components/ui/` manualmente — usar shadcn CLI
5. **NUNCA** criar query sem `queryKey` de `lib/constants.ts`
6. **NUNCA** exibir mensagens de erro técnicas da API — mapear para mensagem amigável

## Variáveis de Ambiente

### Backend (`backend/.env`)

```ini
DATABASE_URL=postgresql+psycopg2://rotavenda:rotavenda@db:5432/rotavenda
SECRET_KEY=          # mínimo 32 chars: openssl rand -hex 32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
FIRST_SUPERUSER_EMAIL=admin@example.com
FIRST_SUPERUSER_PASSWORD=admin123
FIRST_SUPERUSER_NAME=Gerente
```

### Frontend (`frontend/.env.local`)

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Regras de Commit (Conventional Commits)

Formato: `tipo(escopo): descrição em português, sem ponto final`

**Tipos:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`

**Escopos:** `auth`, `users`, `streets`, `clients`, `routes`, `sales`, `payments`, `products`, `dashboard`, `vendas`, `infra`, `db`

Nunca commitar direto na `main` — sempre via Pull Request.

## Checklist pré-Pull Request

- [ ] `black . && isort .` sem mudanças pendentes
- [ ] `pytest` passando
- [ ] Nenhum `console.log` no frontend / `print()` de debug no backend
- [ ] Nova migration tem `downgrade()` implementado
- [ ] Novas variáveis de ambiente documentadas no `.env.example`
