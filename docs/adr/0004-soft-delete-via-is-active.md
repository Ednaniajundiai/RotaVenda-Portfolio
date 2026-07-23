# ADR 0004 — Soft-delete via `is_active`

## Status

Aceita.

## Contexto

O RotaVenda guarda histórico financeiro de clientes: vendas, parcelas,
pagamentos aplicados. Algumas dessas entidades precisam ser "apagadas" no
uso diário:

- Venda registrada com cliente errado.
- Pagamento duplicado.
- Cliente que saiu do bairro.

*Hard delete* (`DELETE FROM sales WHERE id = ?`) tem dois problemas sérios
num sistema financeiro:

1. **Perda de auditoria.** Depois que sai, não volta. Se alguém questionar
   "onde foi parar aquele pagamento?", não há resposta.
2. **Efeito cascata inesperado.** `DELETE` de um cliente com dezenas de
   vendas e pagamentos pode acionar `ON DELETE CASCADE` e limpar meses de
   histórico sem aviso.

## Decisão

**Entidades principais nunca são apagadas fisicamente.** Usamos soft-delete
via coluna `is_active: bool`, default `True`. O `delete_*` do service só
faz:

```python
entity.is_active = False
db.commit()
```

Toda query de leitura filtra `WHERE is_active = True`. Os endpoints de
listagem e de `get by id` retornam 404 para entidades inativas.

Aplicável a: `User`, `Client`, `Street`, `Product`, `Route`,
`RouteTemplate`, `Sale`, `Payment`. Tabelas associativas
(`client_streets`, `route_streets`, `sale_items`, `sale_installments`,
`installment_payments`) seguem o soft-delete do seu *dono* — não têm
`is_active` próprio.

## Consequências

**Positivas:**

- Possibilidade de *undelete* trivial (flip `is_active` de volta a `True`).
- Auditoria: a linha continua no banco para investigação pós-incidente.
- Saldo do cliente ([ADR 0001](0001-saldo-calculado.md)) filtra
  `is_active = True` — soft-delete de uma venda zera automaticamente seu
  impacto no saldo.

**Negativas:**

- Toda query precisa lembrar do filtro. Esquecer disso é o bug clássico
  desse padrão. Mitigamos com convenção consistente nos services e com
  testes que criam entidades, fazem *soft delete* e checam que somem das
  listagens — criam a entidade, aplicam a exclusão lógica e verificam que ela some das
  listagens e retorna "não encontrado" no acesso direto.
- Tabela cresce indefinidamente. No uso atual não é problema (volumes
  baixos), mas se crescer, há o plano de arquivar registros inativos >1 ano
  em tabela separada.
- Uniqueness constraints precisam ser condicionais a `is_active = True` se
  quisermos permitir reutilizar um identificador (e.g., email). Na prática
  optamos por não permitir — um usuário deletado libera o slot somente após
  renomear o email manualmente.
