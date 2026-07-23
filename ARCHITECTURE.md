# Arquitetura — RotaVenda

Documento técnico do sistema em produção na D'Lucri: visão de componentes,
modelagem de dados, os fluxos que concentram a complexidade do domínio e os
trade-offs assumidos.

As decisões formais estão registradas em [`docs/adr/`](docs/adr/).

---

## 1 · Visão de componentes

```mermaid
flowchart TB
    subgraph Campo["Uso em campo"]
        Tablet["Tablet do vendedor<br/>rede móvel instável"]
        Balcao["Balcão da loja"]
    end

    subgraph Front["Next.js 15 · App Router"]
        Pages["Páginas<br/>segmento autenticado e público"]
        Query["TanStack Query v5<br/>cache e invalidação"]
        Http["Camada HTTP<br/>Axios + interceptors"]
        Mw["Middleware<br/>gating de rota por papel"]
    end

    subgraph Api["FastAPI · /api/v1"]
        Routers["Routers finos<br/>autenticação e contrato"]
        Services["Services<br/>toda a regra de negócio"]
        Models["Models SQLAlchemy"]
    end

    Alembic["Alembic<br/>migrations reversíveis"]
    DB[("PostgreSQL 16")]

    Tablet --> Pages
    Balcao --> Pages
    Pages --> Query --> Http
    Pages -.-> Mw
    Http -->|"Bearer + cookie httpOnly"| Routers
    Routers --> Services --> Models --> DB
    Alembic --> DB
```

**Princípio estrutural.** Os routers são finos: extraem o request, chamam um
service e devolvem o modelo de resposta. Toda decisão de negócio — validação de
invariantes, cálculo de totais, alocação FIFO, regras de bloqueio — mora na
camada de serviço. Nenhum router contém condicional de domínio.

Isso não é preferência estética. O sistema tem três superfícies que precisam
aplicar as mesmas regras (API HTTP, scripts de migração do acervo e seeds
operacionais); regra em router só funcionaria na primeira.

---

## 2 · Modelo de dados

```mermaid
erDiagram
    USER ||--o{ ROUTE : opera
    USER ||--o{ SALE : registra
    USER ||--o{ PAYMENT : recebe

    CLIENT ||--o{ CLIENT_STREET : "reside em"
    STREET ||--o{ CLIENT_STREET : agrupa

    ROUTE ||--o{ ROUTE_STREET : "tem parada"
    STREET ||--o{ ROUTE_STREET : "é visitada em"
    ROUTE_STREET ||--o{ ROUTE_STOP_CLIENT : "atende"
    CLIENT ||--o{ ROUTE_STOP_CLIENT : "é atendido em"

    ROUTE_TEMPLATE ||--o{ ROUTE_TEMPLATE_STREET : define
    ROUTE_TEMPLATE_STREET ||--o{ ROUTE_TEMPLATE_STOP_CLIENT : aloca

    CLIENT ||--o{ SALE : compra
    SALE ||--o{ SALE_ITEM : contém
    PRODUCT ||--o{ SALE_ITEM : "referenciado por"
    SALE ||--o{ SALE_INSTALLMENT : parcela

    CLIENT ||--o{ PAYMENT : paga
    PAYMENT ||--o{ INSTALLMENT_PAYMENT : aloca
    SALE_INSTALLMENT ||--o{ INSTALLMENT_PAYMENT : "recebe baixa"

    CLIENT ||--o{ CREDIT_APPLICATION : "tem crédito"
    SALE ||--o{ CREDIT_APPLICATION : "abatido por"
```

**Notas de modelagem**

- **Chaves.** UUID em todas as entidades. Identificador sequencial vazaria
  volume de negócio e complicaria a consolidação de lotes da migração.
- **`sale_items` é snapshot.** Preço e descrição são copiados no momento da
  venda. Alterar o catálogo hoje não pode reescrever o histórico de crédito de
  ninguém.
- **`installment_payments` é a tabela central do domínio.** Ela materializa
  *quanto de cada pagamento foi para cada parcela* — é o que torna a baixa FIFO
  auditável e o estorno reversível.
- **Exclusão lógica** via sinalizador de atividade em vendas, pagamentos e
  clientes. Registro financeiro não é apagado fisicamente.
- **Bloqueio ≠ exclusão.** Cliente bloqueado continua visível e operável à
  vista; apenas o crédito novo é negado. São dois conceitos distintos, com
  colunas distintas — confundi-los foi um erro corrigido cedo.

---

## 3 · O fluxo central: venda a prazo e baixa FIFO

Este é o núcleo do sistema. Tudo o mais orbita em torno dele.

```mermaid
sequenceDiagram
    participant V as Vendedor
    participant API as FastAPI
    participant S as sale/payment service
    participant DB as PostgreSQL

    Note over V,DB: Venda a prazo
    V->>API: POST /sales (itens, parcelas, chave de idempotência)
    API->>S: create_sale
    S->>S: valida cliente não bloqueado
    S->>S: total = Σ(qtd × preço) − desconto
    S->>S: valida Σ(parcelas) == total
    S->>DB: grava venda + itens + parcelas
    API-->>V: venda criada

    Note over V,DB: Recebimento, dias depois
    V->>API: POST /payments (valor, chave de idempotência)
    API->>S: create_payment
    S->>DB: parcelas em aberto, ordenadas por vencimento
    loop enquanto sobrar valor
        S->>S: aloca min(saldo restante, saldo da parcela)
        S->>DB: grava alocação e atualiza a parcela
    end
    alt sobra após quitar tudo
        S->>S: excedente permanece como crédito do cliente
    end
    API-->>V: pagamento registrado
```

**Por que o total é recalculado no servidor.** O cliente HTTP envia itens e
quantidades, nunca o valor. Se enviasse, uma requisição adulterada — ou
simplesmente um bug de arredondamento no frontend — inscreveria uma dívida
incorreta no nome de uma pessoa real.

**Por que o excedente vira crédito e não erro.** Na operação real o cliente
frequentemente arredonda para cima. Rejeitar o pagamento obrigaria o vendedor a
recusar dinheiro na porta da casa. O excedente é retido como crédito e aplicado
explicitamente em compra futura, com registro próprio.

### Cálculo de saldo

```
saldo_líquido = débito − crédito

débito  = Σ (parcela.valor − parcela.valor_pago)   sobre vendas a prazo ativas
crédito = Σ pagamentos ativos − Σ alocações em parcelas
```

Saldo negativo significa crédito a favor do cliente. A fórmula tem **uma única
implementação canônica**, com variante em lote para listagens; os demais
serviços delegam a ela. Essa unificação foi uma dívida técnica identificada e
paga — a regra havia se duplicado em quatro pontos, e a divergência entre eles
era questão de tempo.

---

## 4 · Rota como sequência de paradas

A primeira modelagem tratava rota como *lista de ruas*. A operação real
desmentiu o modelo: o vendedor percorre a mesma via na ida e na volta,
atendendo clientes diferentes em cada passagem — e o modelo original tinha uma
restrição de unicidade que tornava isso impossível de representar.

```mermaid
flowchart LR
    T["Template de rota<br/>blueprint reutilizável"] -->|clonagem| R["Rota do dia"]
    R --> P1["Parada 1<br/>Rua A · ida"]
    R --> P2["Parada 2<br/>Rua B"]
    R --> P3["Parada 3<br/>Rua A · volta"]
    P1 --> C1["clientes alocados"]
    P2 --> C2["clientes alocados"]
    P3 --> C3["clientes alocados"]
```

**O que mudou.** A restrição de unicidade foi removida, cada parada ganhou
rótulo próprio e a alocação de clientes passou a pertencer à parada, não à rua.
O template carrega a divisão de clientes e é **clonado** — não referenciado — a
cada nova rota, de modo que reorganizar o template não reescreve o histórico de
rotas já executadas.

**Execução guiada.** A interface apresenta uma parada por vez, com avanço
automático ao concluir. O vendedor não escolhe em qual tela está: o sistema o
conduz. Decisão de produto direta — reduzir carga cognitiva de quem opera em pé,
na rua, com uma mão.

---

## 5 · Migração do acervo em papel

O maior risco do projeto não era técnico, era de confiança: se um único cliente
aparecesse com dívida errada, o sistema perderia credibilidade e a operação
voltaria ao caderno.

```mermaid
flowchart LR
    F["Foto da folha"] --> T["Transcrição<br/>estruturada"]
    T --> V["Validação<br/>contra saldo declarado"]
    V --> L["Lote em revisão<br/>oculto ao vendedor"]
    L --> A{"Gestor<br/>aprova?"}
    A -->|sim| P["Promovido<br/>a produção"]
    A -->|não| T
```

**Decisões que sustentaram a confiança**

- Lote nasce **oculto**. Só o gestor enxerga até liberar — o vendedor nunca vê
  dado não conferido.
- Divergência entre a soma das linhas e o saldo declarado no caderno **bloqueia**
  a promoção do lote.
- Rasura, nome apagado e valor ambíguo têm regra de resolução documentada e
  aplicada de forma uniforme; não são decisão de quem digita.
- O processo é **idempotente**: reexecutar um lote não duplica registro.

Resultado: 160 folhas, 680 registros e cerca de R$ 31 mil em crédito
reconciliado sem contestação em produção.

---

## 6 · Resiliência e segurança

| Preocupação | Tratamento |
| --- | --- |
| Rede móvel instável | Chave de idempotência em criação de venda e pagamento; a repetição retorna o recurso original |
| Roubo de token via XSS | Renovação em cookie `httpOnly`; acesso de vida curta; autorização sempre reverificada no servidor |
| Escalada de privilégio | Papel resolvido no servidor a cada requisição; o cookie de papel serve apenas para decidir renderização |
| Força bruta em login | Limite de taxa aplicado seletivamente no endpoint exposto |
| Corrupção de histórico | Exclusão lógica, estorno reversível e trilha de auditoria imutável |
| Erro de esquema em produção | Todas as migrations implementam o caminho de volta |
| Perda de dados | Rotina de backup e restauração documentada e testada |

---

## 7 · Estratégia de testes

Trinta e uma suítes de integração cobrem o que dá prejuízo se quebrar:
consistência de saldo, alocação e estorno, idempotência, autorização por papel,
normalização de telefone, tratamento de datas e geração de exportações.

**Isolamento por savepoint.** Cada teste executa dentro de uma transação
revertida ao final. Não há banco dedicado, seed prévio nem rotina de limpeza —
e não se paga o custo de recriar o esquema a cada execução.

**O que é deliberadamente coberto por teste, não por tipo.** Regras temporais —
"não editar venda com parcela paga", "não vender a prazo para cliente
bloqueado" — dependem de estado em tempo de execução. Nenhum sistema de tipos as
captura; testes capturam.

---

## 8 · Dívidas conhecidas

Registrar o que ainda não está resolvido é parte da honestidade técnica do
projeto.

| Dívida | Situação |
| --- | --- |
| Sobrebusca no cliente HTTP penaliza tablets de menor capacidade | Diagnosticado: o gargalo é o número de requisições da interface, não o servidor. Consolidação de endpoints em andamento |
| Ausência de modo offline real | O vendedor depende de conectividade; especificação escrita, implementação não priorizada |
| Cobertura de teste do frontend | Concentrada no backend; a camada de interface é validada manualmente |
| Estoque não movimenta na venda | Decisão consciente do negócio no momento — o ajuste é manual pelo gestor |

---

<div align="center">
<sub>

Documento mantido junto ao sistema. Última revisão alinhada ao estado de
produção de julho de 2026.

</sub>
</div>
