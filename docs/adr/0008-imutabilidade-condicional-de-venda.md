# ADR 0008 — Imutabilidade condicional na edição de venda

## Status

Aceita, julho de 2026.

## Contexto

Vendas são registradas com pressa, em campo. Erros acontecem: quantidade
trocada, produto errado, desconto esquecido. A capacidade de corrigir é
requisito real — sem ela, o vendedor abandona o sistema e volta ao papel.

Mas editar uma venda **que já recebeu pagamento** é destrutivo de um modo não
óbvio. Os pagamentos foram alocados nas parcelas por ordem de vencimento
(ver [ADR 0002 do domínio de crédito](0001-saldo-calculado.md) e o fluxo FIFO
descrito em `ARCHITECTURE.md`). Alterar o total da venda muda os valores das
parcelas — e invalida retroativamente alocações que já foram feitas contra os
valores antigos.

O resultado seria uma parcela com valor pago maior que o próprio valor, ou
crédito surgindo do nada. Silenciosamente.

As duas saídas fáceis são ruins:

- **Bloquear toda edição** após a criação. Inutiliza a correção de erros
  triviais e empurra o usuário para fora do sistema.
- **Permitir tudo e recalcular** as alocações. Reescreve histórico financeiro
  já registrado, o que destrói a auditabilidade que justifica o sistema existir.

## Decisão

**A edição é livre enquanto ninguém pagou nada; trava parcialmente a partir do
primeiro pagamento.**

- Se **nenhuma parcela** tem valor pago: itens, desconto, parcelamento e
  observação são editáveis. O total é recalculado no servidor.
- Se **alguma parcela** tem valor pago: itens e desconto ficam bloqueados, e a
  API recusa a alteração com erro explícito. Campos que não afetam o valor —
  observação, por exemplo — seguem editáveis.

O caminho alternativo é explícito e oferecido na própria mensagem: **estornar e
relançar**. O estorno reverte as alocações e devolve as parcelas ao estado
anterior, deixando rastro de que houve correção.

A regra é aplicada no **servidor**. A interface a antecipa, desabilitando os
campos e exibindo o aviso, mas isso é conveniência — não é onde a garantia mora.

## Consequências

**Positivas**

- Converte um defeito silencioso de consistência em uma mensagem clara, no
  momento certo, com uma alternativa acionável.
- Preserva a integridade do histórico financeiro sem proibir correção.
- A regra é explicável em uma frase para o usuário final: *"depois que entra
  dinheiro, o valor não muda mais — se precisar, estorne."*

**Negativas**

- Estornar e relançar dá mais trabalho que editar. Aceito: é a operação
  minoritária, e o rastro que ela deixa é desejável.
- A condição depende de estado em tempo de execução — nenhum sistema de tipos a
  captura. A garantia vem de teste, e há cobertura dedicada para os dois lados
  da regra.
- Cria uma assimetria que precisa ser ensinada: alguns campos editam, outros
  não, dependendo de algo que não está visível na tela de edição. Mitigado com
  aviso em linha explicando o porquê.
