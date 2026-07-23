# ADR 0005 — Templates de rota como blueprint clonado

## Status

**Parcialmente substituída** pela [ADR 0006](0006-rota-por-paradas.md), de julho
de 2026.

A decisão de separar *template* de *instância*, registrada aqui, continua
válida e em vigor. O que mudou foi a **unidade** que o template descreve: deixou
de ser uma lista de ruas e passou a ser uma sequência de paradas, cada uma com
seus próprios clientes. Leia esta ADR pelo princípio; leia a 0006 para o modelo
atual.

## Contexto

O vendedor repete a mesma rota na maior parte dos dias. Ao mesmo tempo, a rota
executada em um dia específico acumula estado efêmero que não pertence a um
molde reutilizável: status de progresso, horários de início e fim, e o vínculo
das vendas e pagamentos feitos naquela passagem.

A tentação inicial é uma única tabela com um sinalizador `é_template`. Isso
falha por dois motivos: o template passa a carregar campos de execução que não
significam nada nele, e editar o template depois de usado corromperia o
histórico das rotas que derivaram dele.

## Decisão

**Duas entidades separadas.**

- **Template** — blueprint reutilizável. Contém nome, descrição e a sequência
  planejada. **Não possui estado de execução.** É tratado como imutável do ponto
  de vista das rotas já criadas.
- **Rota** — instância de um dia. Criada por **clonagem** do template, ganhando
  vida própria a partir daí. Status, horários e vínculos com vendas e pagamentos
  vivem aqui.

O ponto central é que a rota **copia** o template em vez de referenciá-lo.
Reorganizar o molde para amanhã não reescreve o que aconteceu ontem.

## Consequências

**Positivas**

- Editar o template não afeta rotas passadas nem a rota em andamento —
  imutabilidade de referência.
- Os dados do dia ficam limpos, sem campos de execução vazios poluindo
  listagens de template.
- O vínculo de uma venda com a parada é inequívoco: aponta para um lugar
  específico em um dia específico.

**Negativas**

- Duplicação de dados: cada rota copia a estrutura do template. Nos volumes
  reais da operação é desprezível.
- Uma entidade a mais para quem estuda o domínio. O ganho é semântica explícita
  — molde e instância — em vez de um sinalizador implícito.
- Não há versionamento histórico de templates. Não foi priorizado: na operação
  real, templates mudam raramente.
