# ADR 0007 — Idempotência em escritas financeiras

## Status

Aceita, julho de 2026.

## Contexto

O vendedor registra vendas e pagamentos a partir de um tablet, em campo, sob
rede móvel de qualidade variável. O padrão de falha observado é sempre o mesmo:
a requisição chega ao servidor e é processada, mas a resposta se perde no
caminho de volta. Da perspectiva de quem está na porta da casa do cliente, a
operação "não funcionou" — e a reação natural é tocar no botão de novo.

Sem proteção, o resultado é uma venda duplicada inscrita no crédito de uma
pessoa real, ou um pagamento contado duas vezes. Nenhum dos dois emite erro.
Ambos só apareceriam no fechamento do mês, já sem rastro da causa — e em um
sistema cuja proposta é ser mais confiável que um caderno, "o sistema cobrou
duas vezes" é uma falha que custa a confiança do negócio inteiro.

Tentativa de resolver no cliente HTTP — desabilitar o botão após o toque — não
resolve. Não cobre recarregar a página, reenviar de outro aparelho, nem o caso
em que o próprio usuário insiste porque a tela travou.

## Decisão

**Os endpoints de criação de venda e de pagamento aceitam uma chave de
idempotência**, enviada em cabeçalho.

- O cliente HTTP gera um identificador único **por tentativa de envio** — não
  por sessão nem por formulário.
- O servidor registra a chave junto ao recurso criado, com unicidade garantida
  no banco por escopo de operação.
- Uma segunda requisição com a mesma chave **retorna o recurso original**, sem
  criar nada novo e sem erro.

A garantia é dada pelo banco, não por verificação prévia em código: consultar
antes de inserir apenas estreita a janela de corrida, não a fecha.

Chaves são retidas por sete dias — muito além de qualquer janela realista de
nova tentativa, e curto o bastante para o volume não importar.

## Consequências

**Positivas**

- Repetir o envio é seguro. O vendedor pode insistir sem risco.
- A proteção vale para qualquer cliente da API, não só para a interface — o que
  importou nos scripts de migração do acervo, que reprocessam lotes.
- Torna viável uma futura fila offline: a retentativa automática já é segura por
  construção.

**Negativas**

- Uma tabela e um índice de unicidade a mais para manter.
- Sem rotina de limpeza automática das chaves expiradas. Decisão consciente
  diante do volume real; vira dívida registrada se a escala mudar.
- A responsabilidade de gerar a chave corretamente é do cliente HTTP. Reaproveitar
  a mesma chave entre operações distintas causaria comportamento errado — risco
  mitigado por gerar o identificador no ato do envio.
