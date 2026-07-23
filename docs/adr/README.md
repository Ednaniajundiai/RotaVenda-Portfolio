# Architecture Decision Records

Registro curto das decisões de arquitetura que moldam o projeto. Cada ADR
descreve o contexto, a decisão e as consequências — positivas **e** negativas —
da escolha.

O critério de entrada é simples: só vira ADR a decisão que foi difícil, que tem
alternativa defensável e que alguém no futuro poderia querer reverter sem
entender por que foi tomada.

| # | Título | Status |
| --- | --- | --- |
| [0001](0001-saldo-calculado.md) | Saldo do cliente calculado em runtime | Aceita · revisada jul/2026 |
| [0002](0002-refresh-token-cookie.md) | Token de renovação em cookie `httpOnly` | Aceita |
| [0003](0003-router-fino-service-gordo.md) | Router fino, service gordo | Aceita |
| [0004](0004-soft-delete-via-is-active.md) | Exclusão lógica em vez de física | Aceita |
| [0005](0005-templates-imutaveis-de-rota.md) | Templates de rota como blueprint clonado | Parcialmente substituída pela 0006 |
| [0006](0006-rota-por-paradas.md) | Rota como sequência de paradas | Aceita |
| [0007](0007-idempotencia-em-escritas-financeiras.md) | Idempotência em escritas financeiras | Aceita |
| [0008](0008-imutabilidade-condicional-de-venda.md) | Imutabilidade condicional na edição de venda | Aceita |

## Sobre as revisões

Duas ADRs foram corrigidas em julho de 2026, e o registro dessa correção é
deliberado — uma ADR que envelhece em silêncio é pior que ADR nenhuma, porque
transmite confiança em informação errada.

- **0001** documentava uma fórmula de saldo que omitia o crédito não alocado e
  se apoiava em uma coluna que já havia sido removida do banco.
- **0005** descrevia a rota como lista de ruas, modelo que a
  [0006](0006-rota-por-paradas.md) substituiu ao confrontá-lo com o percurso
  real do vendedor.

## Formato

Inspirado em [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

```md
# ADR 000X — Título curto

## Status
Aceita | Substituída pela ADR YYYY | Descontinuada

## Contexto
O problema, as restrições e o que estava em jogo.

## Decisão
O que foi decidido, em voz ativa e no tempo presente.

## Consequências
O que fica mais fácil, o que fica mais difícil, o que vira dívida técnica.
```
