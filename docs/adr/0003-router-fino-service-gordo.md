# ADR 0003 — Router fino, service gordo

## Status

Aceita.

## Contexto

FastAPI não impõe uma organização de código. É comum ver projetos que
misturam validação, regra de negócio e acesso ao banco dentro do próprio
*path operation function* — tudo "mais próximo do endpoint". Isso funciona
em uma aplicação com 3 rotas, mas degrada conforme o projeto cresce:

- A mesma regra passa a ser duplicada em dois endpoints diferentes.
- Testar a regra exige montar um `TestClient`, serializar request e
  deserializar response — é custoso para testar um invariante simples.
- O endpoint mistura HTTP (códigos de status, headers) com lógica de
  domínio, dificultando a leitura de qualquer um dos dois.

O RotaVenda tem regras não-triviais: recálculo de `amount` a partir de
`sale_items`, matching FIFO de pagamentos, imutabilidade condicional na
edição de venda. Precisam de casa adequada.

## Decisão

**Os routers em [`app/api/v1/`](../../backend/app/api/v1/) contêm apenas:**

1. Validação de input via schema Pydantic (injeção do FastAPI).
2. Extração de dependências (`get_db`, `get_current_user`, `require_gerente`).
3. Chamada a um único método de service.
4. Retorno do `response_model`.

**Os services em [`app/services/`](../../backend/app/services/) contêm
toda a lógica de negócio:**

1. Orquestração de consultas ao ORM.
2. Validações de invariantes (soma das parcelas, conflitos de status, regras
   de imutabilidade).
3. Cálculos derivados (total, saldo, FIFO matching).
4. `db.commit()` — o service decide quando a transação fecha.

Um router típico tem 3–8 linhas. Um service tem dezenas ou centenas.

## Consequências

**Positivas:**

- Testes de regra usam a função do service direto (import e chamada), sem
  passar por HTTP. Rápido e sem ruído.
- A mesma regra é reaproveitada entre endpoints sem duplicação (ex.: cálculo
  de saldo usado tanto em `GET /clients/:id/balance` quanto no wizard de
  nova venda).
- Se migrarmos de FastAPI para outro framework (improvável, mas), os
  services vão junto praticamente intactos.

**Negativas:**

- Um camada extra para quem está começando — precisa lembrar que "não vai no
  router, vai no service".
- Existe o risco do service virar um *God object*. Mitigamos com um service
  por recurso (`sale_service`, `payment_service`, `installment_service`...) e
  funções puras quando dá.
- Services retornam **dicts** em vez de objetos ORM quando precisam agregar
  campos computados (`seller_name`, `client_name`). FastAPI valida contra o
  `response_model` normalmente — mas é uma convenção que precisa ser
  respeitada para não quebrar o schema.
