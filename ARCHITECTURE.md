# Arquitetura — RotaVenda

Este documento descreve a arquitetura de alto nível do sistema, a modelagem de
dados e os fluxos mais importantes do ponto de vista de negócio.

Para decisões de design documentadas em detalhe, consulte [`docs/adr/`](docs/adr/).

---

## Visão de componentes

```mermaid
flowchart TB
    subgraph Client["Cliente"]
        Browser[Browser / Mobile PWA]
    end

    subgraph Frontend["Next.js 15 (App Router)"]
        Pages[Páginas segmentadas<br/>app/(app) · app/(auth)]
        Hooks[Hooks de dados<br/>TanStack Query]
        Axios[lib/api.ts<br/>Axios + interceptors]
    end

    subgraph Backend["FastAPI"]
        Routers[Routers /api/v1<br/>autenticação + validação]
        Services[Services<br/>regras de negócio]
        Models[Models SQLAlchemy]
        Alembic[Alembic<br/>migrations reversíveis]
    end

    DB[(PostgreSQL 16)]

    Browser -->|HTTPS| Pages
    Pages --> Hooks
    Hooks --> Axios
    Axios -->|JWT Bearer<br/>+ refresh cookie| Routers
    Routers --> Services
    Services --> Models
    Models --> DB
    Alembic --> DB
```

**Princípio:** os routers são finos — apenas extraem o request, chamam um
service e retornam o `response_model`. Toda decisão de negócio
(validação de invariantes, cálculo de totais, matching FIFO) mora em
[`app/services/`](backend/app/services/). Ver [ADR 0003](docs/adr/0003-router-fino-service-gordo.md).

---

## Diagrama de entidades

```mermaid
erDiagram
    USER ||--o{ ROUTE : "vende em"
    USER ||--o{ SALE : "registra"
    USER ||--o{ PAYMENT : "recebe"
    STREET ||--o{ CLIENT_STREET : "tem"
    CLIENT ||--o{ CLIENT_STREET : "mora em"
    ROUTE ||--o{ ROUTE_STREET : "visita"
    STREET ||--o{ ROUTE_STREET : "aparece em"
    ROUTE_TEMPLATE ||--o{ ROUTE_TEMPLATE_STREET : "define"
    STREET ||--o{ ROUTE_TEMPLATE_STREET : "listada em"
    CLIENT ||--o{ SALE : "compra"
    ROUTE_STREET ||--o{ SALE : "contém"
    SALE ||--o{ SALE_ITEM : "tem itens"
    PRODUCT ||--o{ SALE_ITEM : "vendido como"
    SALE ||--o{ SALE_INSTALLMENT : "dividido em"
    SALE_INSTALLMENT ||--o{ INSTALLMENT_PAYMENT : "amortizada por"
    PAYMENT ||--o{ INSTALLMENT_PAYMENT : "aplica em"
    CLIENT ||--o{ PAYMENT : "paga"

    USER {
        uuid id PK
        string email UK
        string hashed_password
        enum role "GERENTE | VENDEDOR"
        bool is_active
    }
    CLIENT {
        uuid id PK
        string name
        string phone
        numeric opening_balance
        bool is_active
    }
    SALE {
        uuid id PK
        uuid client_id FK
        uuid seller_id FK
        uuid route_street_id FK "NULL em venda LOJA"
        date sale_date
        numeric amount "SUM(items.subtotal) - discount"
        numeric discount
        enum sale_type "ROTA | LOJA"
        enum payment_mode "A_VISTA | FIADO"
        bool is_active
    }
    SALE_INSTALLMENT {
        uuid id PK
        uuid sale_id FK
        int number
        date due_date
        numeric amount
        numeric paid_amount
        datetime paid_at "nulo até quitar"
    }
    PAYMENT {
        uuid id PK
        uuid client_id FK
        uuid seller_id FK
        date payment_date
        numeric amount
        bool is_active
    }
    INSTALLMENT_PAYMENT {
        uuid id PK
        uuid installment_id FK
        uuid payment_id FK
        numeric amount
    }
```

### Notas sobre a modelagem

- **UUID como PK** em todas as tabelas — evita conflito em importação e
  permite gerar IDs no cliente sem *round trip*.
- **`CLIENT_STREET`** é uma tabela associativa com `house_number`,
  `reference` e `display_order` — suporta clientes com mais de um endereço.
- **`ROUTE_STREET`** representa a *instância* de uma rua numa rota do dia, com
  status próprio (`PENDING` → `IN_PROGRESS` → `COMPLETED`).
- **`ROUTE_TEMPLATE`** é *blueprint* reutilizável — o vendedor duplica no dia
  para criar uma rota. Ver [ADR 0005](docs/adr/0005-templates-imutaveis-de-rota.md).
- **Cliente não tem coluna `saldo`.** O saldo é derivado em tempo real:
  `SUM(sales FIADO ativas) − SUM(payments ativos) + opening_balance`.
  Ver [ADR 0001](docs/adr/0001-saldo-calculado.md).

---

## Fluxo 1 — Venda fiado com parcelas

```mermaid
sequenceDiagram
    autonumber
    participant U as Vendedor
    participant F as Frontend<br/>(wizard de venda)
    participant A as POST /sales
    participant S as sale_service
    participant I as installment_service
    participant DB as Postgres

    U->>F: Seleciona cliente, itens, desconto, modo=FIADO, parcelas
    F->>A: JSON {items, discount, payment_mode, installments}
    A->>S: create_sale(payload)
    S->>S: amount = SUM(items.subtotal) - discount
    S->>DB: INSERT sale + sale_items
    S->>I: create_installments_for_sale(sale, inputs)
    I->>I: valida SUM(installments) == sale.amount
    I->>DB: INSERT sale_installments
    S-->>A: SaleResponse com installments
    A-->>F: 201 Created
```

**Invariantes garantidas pelo backend:**

- O campo `amount` recebido do cliente é ignorado em vendas com itens — o
  total é sempre recalculado a partir de `SUM(sale_items.subtotal) - discount`.
- A soma dos `installments.amount` precisa bater com `sale.amount` (tolerância
  de 1 centavo para erros de arredondamento decimal).
- `route_street_id` só é aceito para vendas de tipo `ROTA`.

---

## Fluxo 2 — Pagamento com matching FIFO

Quando o vendedor registra um pagamento **sem** indicar em quais parcelas
aplicar, o backend distribui o valor automaticamente na ordem
`due_date ASC, number ASC` — quita a mais antiga primeiro, consome o saldo,
e vai para a próxima. Se ainda sobrar valor depois que todas as parcelas
estão quitadas, amortiza o `opening_balance` do cliente. Se ainda sobrar,
retorna HTTP 400 (pagamento excede dívida).

```mermaid
sequenceDiagram
    autonumber
    participant U as Vendedor
    participant A as POST /payments
    participant PS as payment_service
    participant IS as installment_service
    participant DB as Postgres

    U->>A: {client_id, amount=R$50, sem applications}
    A->>PS: create_payment(payload)
    PS->>DB: INSERT payment
    PS->>IS: apply_payment_to_installments(...)
    IS->>DB: SELECT installments ORDER BY due_date, number<br/>WHERE paid_amount < amount<br/>FOR UPDATE
    loop Para cada parcela em aberto
        alt Valor restante >= saldo da parcela
            IS->>DB: INSERT installment_payment (amount=saldo)
            IS->>DB: UPDATE parcela SET paid_amount=amount, paid_at=now
        else Valor restante < saldo da parcela
            IS->>DB: INSERT installment_payment (amount=restante)
            IS->>DB: UPDATE parcela SET paid_amount += restante
            Note over IS: paid_at permanece NULL
        end
    end
    alt Sobrou valor após todas as parcelas
        IS->>DB: UPDATE client SET opening_balance -= resto
    end
    alt Ainda sobra após opening_balance
        IS-->>A: HTTP 400 "Pagamento excede saldo devedor"
    end
```

**Por que `FOR UPDATE`:** dois pagamentos simultâneos do mesmo cliente
poderiam ler o mesmo `paid_amount` e ambos considerar a parcela em aberto,
resultando em dupla amortização. O lock de linha na consulta evita isso.

Cobertura de testes deste fluxo em
[`test_payment_service.py::TestFifoMatching`](backend/tests/test_payment_service.py).

---

## Fluxo 3 — Edição de venda com imutabilidade condicional

Editar uma venda após quitação parcial é perigoso: o valor histórico das
parcelas já foi registrado em `installment_payments` e o saldo do cliente
depende dele. A regra adotada:

```mermaid
flowchart TD
    Start[PUT /sales/:id] --> Check{Alguma parcela<br/>com paid_amount > 0?}
    Check -->|Não| Allow[Permite alterar<br/>items, discount, installments, payment_mode]
    Check -->|Sim| Block{Campos solicitados?}
    Block -->|items ou discount| Reject[HTTP 400<br/>Bloqueio de integridade]
    Block -->|description apenas| Allow
    Allow --> Recalc[Se items/discount mudaram:<br/>amount = SUM(subtotal) - discount]
    Recalc --> Save[UPDATE sale]
```

Essa regra é testada em
[`test_sale_service.py::TestUpdateSale`](backend/tests/test_sale_service.py).

---

## Autenticação e autorização

- **Access token** — JWT curto (30 min por padrão), guardado em `localStorage`.
  Enviado em `Authorization: Bearer <token>`.
- **Refresh token** — JWT de 7 dias, guardado em cookie `httpOnly` para que
  JavaScript do browser não consiga ler (defesa contra XSS). Ver
  [ADR 0002](docs/adr/0002-refresh-token-cookie.md).
- **`get_current_user`** em [`api/deps.py`](backend/app/api/deps.py) é a única
  porta de autenticação; todos os routers protegidos dependem dela.
- **`require_gerente`** é a porta extra para endpoints restritos (criação de
  usuário, relatórios agregados, exclusão de pagamento).

---

## Estratégia de testes

- **Integração contra Postgres real** — usa o mesmo banco do `.env`.
- **Isolamento por savepoint** — cada teste abre uma transação externa e uma
  interna (via `join_transaction_mode="create_savepoint"`); `commit()` feito
  dentro do service libera o savepoint, e a transação externa é revertida no
  teardown. Zero poluição entre testes, zero teardown manual.
- **Fixtures** em `conftest.py` cobrem `gerente`, `vendedor` e headers com JWT.
- **CI** roda `black --check`, `isort --check-only`, `alembic upgrade head` e
  `pytest --cov`. Ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Operação

### Migrations

Toda mudança de schema passa por Alembic, com `upgrade()` e `downgrade()`
implementados. A migration mais recente é aplicada automaticamente no startup
do container backend (`alembic upgrade head` no `command` do `docker-compose.yml`).

### Seed sintético

[`backend/app/db/seed_demo.py`](backend/app/db/seed_demo.py) popula o banco
com dados 100% fictícios (`Faker` pt_BR + semente fixa `42`), cobrindo ruas,
produtos, usuários, clientes, template de rota, rota ativa, vendas mistas e
pagamentos FIFO. Idempotente — seguro rodar múltiplas vezes.

### Soft-delete

Entidades principais (`sales`, `payments`, `clients`, `users`, `products`)
nunca são apagadas fisicamente — `is_active` é flipado para `False`. Ver
[ADR 0004](docs/adr/0004-soft-delete-via-is-active.md).
