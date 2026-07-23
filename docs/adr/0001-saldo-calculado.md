# ADR 0001 — Saldo do cliente calculado em runtime

## Status

Aceita. Revisada em julho de 2026 — a fórmula foi corrigida e unificada.

## Contexto

O RotaVenda administra crédito a prazo: um cliente acumula dezenas de vendas em
aberto e dezenas de pagamentos aplicados em ordem FIFO. O saldo aparece em quase
todas as telas — listagem de clientes, extrato, tela do vendedor na rota,
cabeçalho da nova venda.

A escolha óbvia seria materializar uma coluna `saldo` e atualizá-la a cada venda
e pagamento. Foi assim que o sistema começou, e duas situações produziram
divergência entre o valor armazenado e a realidade:

1. A exclusão lógica de uma venda parcialmente quitada deixou o saldo
   desatualizado, porque o caminho de reversão ainda não existia.
2. Uma edição de vencimento de parcela disparou recálculo parcial que subtraiu
   o valor duas vezes.

Ambos seriam impossíveis se o saldo fosse derivado a cada leitura. O agravante:
nenhum dos dois emitiu erro. O número simplesmente ficou errado, e só seria
descoberto por alguém conferindo à mão — que é precisamente o trabalho que o
sistema veio eliminar.

## Decisão

**O saldo nunca é armazenado.** Não existe coluna `saldo` na tabela de clientes.
Toda leitura deriva o valor:

```
saldo_líquido = débito − crédito

débito  = Σ (parcela.valor − parcela.valor_pago)
          sobre parcelas de vendas a prazo ativas

crédito = Σ pagamentos ativos − Σ alocações em parcelas
          (o excedente que ainda não abateu dívida)
```

Saldo negativo significa crédito a favor do cliente.

A fórmula tem **uma única implementação canônica**, em um serviço dedicado de
saldo, com duas entradas: uma para um cliente e uma variante em lote para
listagens. Todos os demais serviços delegam a ela — nenhum reimplementa a
agregação.

## Consequências

**Positivas**

- Elimina uma classe inteira de defeitos de sincronização.
- Os caminhos de venda, pagamento, estorno e exclusão ficam mais simples: não
  precisam "lembrar" de atualizar nada.
- O saldo permanece correto mesmo após intervenção manual no banco — o que
  importou durante a migração do acervo em papel, quando correções via SQL foram
  necessárias.

**Negativas**

- Cada leitura paga uma agregação. Mitigado com o cálculo em lote nas listagens
  e com descarte antecipado de registros inativos.
- Se a base crescer em uma ordem de grandeza, será necessário cache ou visão
  materializada. Isso viria como camada **acima** do dado fonte, jamais em
  substituição a ele.

## Nota de revisão

A primeira versão desta ADR registrava a fórmula como
`vendas a prazo − pagamentos + saldo_inicial`, apoiada em uma coluna de saldo
inicial na tabela de clientes. Estava incorreta em dois pontos:

1. **Omitia o crédito não alocado.** Pagamento que excede a dívida gera sobra, e
   ignorá-la fazia o saldo de clientes com crédito aparecer inflado.
2. **A coluna de saldo inicial foi removida.** Saldo herdado do caderno passou a
   ser representado como uma venda a prazo comum, com um produto interno próprio
   — o que o submete às mesmas regras de parcelamento, baixa e estorno de
   qualquer outra dívida, em vez de ser um caso especial.

A correção também eliminou uma duplicação real: a fórmula estava reimplementada
em quatro pontos do código, e a divergência entre eles era questão de tempo.
