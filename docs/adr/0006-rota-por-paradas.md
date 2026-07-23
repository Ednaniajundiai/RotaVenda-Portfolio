# ADR 0006 — Rota como sequência de paradas

## Status

Aceita, julho de 2026. Substitui parcialmente a
[ADR 0005](0005-templates-imutaveis-de-rota.md).

## Contexto

O modelo original tratava a rota como uma **lista ordenada de ruas**, com uma
restrição de unicidade garantindo que cada rua aparecesse uma única vez por
rota. Parecia correto no papel.

A operação real desmentiu o modelo. O vendedor percorre um trecho de rua na ida,
dobra a esquina e volta pelo outro lado — atendendo **clientes diferentes em
cada passagem**. Também é comum atravessar uma via principal duas vezes em
momentos distintos do dia. A restrição de unicidade tornava isso impossível de
representar, e a consequência prática era que o vendedor mantinha parte do
itinerário na cabeça, fora do sistema.

Havia ainda um problema de granularidade: os clientes pertenciam à **rua**, não
à visita. Como a rua aparecia uma vez só, todos os moradores caíam na mesma
parada — inclusive os que ficavam do lado oposto, a serem atendidos só no
retorno.

## Decisão

**A rota passa a ser uma sequência de paradas.** A rua deixa de ser a unidade de
percurso e passa a ser um atributo da parada.

- A restrição de unicidade foi removida: **a mesma rua pode compor várias
  paradas** da mesma rota.
- Cada parada recebe um **rótulo** próprio, para o vendedor distinguir "ida" de
  "volta" na interface.
- **A alocação de clientes pertence à parada, não à rua.** Duas paradas na mesma
  via atendem conjuntos distintos de pessoas.
- O cliente tem estado dentro da parada: pendente, atendido ou pulado. "Atendido"
  é **derivado** da existência de venda ou pagamento naquela visita, não
  armazenado — mesma disciplina da [ADR 0001](0001-saldo-calculado.md).
- O template acompanha a mudança: guarda a divisão de clientes por parada e é
  clonado integralmente ao criar a rota do dia.

**Execução guiada.** A interface apresenta uma parada por vez, com avanço
automático ao concluir. O vendedor não navega entre telas escolhendo onde está;
o sistema o conduz.

## Consequências

**Positivas**

- O modelo passa a representar o percurso real. O itinerário sai da cabeça do
  vendedor e entra no sistema.
- A carga cognitiva de quem opera em pé, na rua, com uma mão, cai
  substancialmente — há uma tela e uma pergunta por vez.
- O gestor ganha uma visão consolidada parada → rua → cliente, que antes não
  existia.

**Negativas**

- Migração de esquema não trivial: soltar uma restrição de unicidade, introduzir
  duas tabelas de alocação e preencher os dados existentes. Feito com caminho de
  volta implementado, como todas as demais.
- Mais tabelas no domínio de rota. O custo é real, mas é o preço de representar
  o percurso como ele é.
- Um detalhe de implementação exigiu cuidado: os modelos-filho precisam ser
  carregados após a definição do pai para que o mapeamento resolva as relações
  declaradas por nome — armadilha silenciosa que só aparece em tempo de execução.

## Alternativas descartadas

- **Manter a unicidade e criar ruas duplicadas** ("Rua A - ida", "Rua A - volta")
  como cadastros separados. Rejeitada: polui o cadastro de endereços, quebra o
  vínculo do cliente com sua rua real e transfere para o usuário um problema de
  modelagem.
- **Ordenar clientes dentro da rua por um campo de sequência**, sem paradas.
  Rejeitada: resolve a ordem, mas não representa que a visita acontece em dois
  momentos distintos do dia, com vendas e pagamentos separados.
