# Architecture Decision Records

Registro curto (200–400 palavras) das decisões de arquitetura que moldam
o projeto. Cada ADR descreve o contexto, a decisão e as consequências —
positivas e negativas — da escolha.

| # | Título | Status |
| --- | --- | --- |
| [0001](0001-saldo-calculado.md) | Saldo do cliente calculado em runtime | Aceita |
| [0002](0002-refresh-token-cookie.md) | Refresh token em cookie `httpOnly` | Aceita |
| [0003](0003-router-fino-service-gordo.md) | Router fino, service gordo | Aceita |
| [0004](0004-soft-delete-via-is-active.md) | Soft-delete via `is_active` | Aceita |
| [0005](0005-templates-imutaveis-de-rota.md) | Templates imutáveis de rota | Aceita |

## Formato

Inspirado em [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

```md
# ADR 000X — Título curto

## Status
Aceita | Substituída por ADR YYYY | Descontinuada

## Contexto
O problema, as restrições e o que estava em jogo.

## Decisão
O que foi decidido, em voz ativa e no tempo presente.

## Consequências
O que fica mais fácil, o que fica mais difícil, o que vira dívida técnica.
```
