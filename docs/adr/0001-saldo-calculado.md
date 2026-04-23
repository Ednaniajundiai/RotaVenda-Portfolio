# ADR 0001 — Saldo do cliente calculado em runtime

## Status

Aceita.

## Contexto

O RotaVenda é um sistema de **fiado**: cada cliente pode ter dezenas de
vendas em aberto e dezenas de pagamentos aplicados em ordem FIFO. O saldo
devedor (`saldo = vendas fiado − pagamentos + opening_balance`) aparece em
quase todas as telas: listagem de clientes, extrato do cliente, tela do
vendedor na rota, cabeçalho da nova venda.

A escolha óbvia seria materializar `clients.saldo` e atualizar por trigger ou
por código da aplicação a cada venda/pagamento. Foi exatamente assim que o
sistema começou, e duas situações causaram divergência entre o saldo
materializado e a soma real de `sales − payments`:

1. *Soft-delete* de uma venda fiado quitada parcialmente deixou o saldo
   desatualizado porque o código de *undelete* não existia ainda.
2. Uma edição de parcela (mudança de `due_date`) acabou disparando
   recálculo parcial que subtraiu o valor duas vezes.

Ambos os bugs teriam sido impossíveis se o saldo fosse derivado em cada leitura.

## Decisão

**O saldo nunca é armazenado.** A coluna `clients.saldo` não existe. Sempre
que um endpoint precisa do saldo, [`client_service.py`](../../backend/app/services/client_service.py)
executa uma query agregada:

```sql
saldo =  COALESCE(SUM(sale_installments.amount) filtered by ativa, 0)
       - COALESCE(SUM(sale_installments.paid_amount), 0)
       + clients.opening_balance
```

O `opening_balance` cobre dívida pré-existente quando o cliente foi
importado do caderno físico — essa é a única parcela de dívida materializada.

## Consequências

**Positivas:**

- Elimina uma classe inteira de bugs de sincronização.
- Código de venda, pagamento e soft-delete fica mais simples — não precisa
  "lembrar" de atualizar o saldo.
- O saldo está sempre certo, mesmo depois de operações manuais no banco
  (e.g., correção de importação via SQL).

**Negativas:**

- Custo de leitura maior — cada listagem de cliente roda agregação.
  Mitigamos com índice em `sale_installments(sale_id)` e filtrando
  `sales.is_active = True` para descartar soft-deletes cedo. Em produção com
  ~500 clientes ativos, a listagem responde em <100 ms.
- Se a base crescer para dezenas de milhares de clientes, pode ser
  necessário cache (Redis) ou *materialized view* atualizada em lote — mas
  isso vira uma camada **acima** do dado fonte, nunca substitui ele.
