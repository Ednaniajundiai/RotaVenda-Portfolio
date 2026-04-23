# ADR 0002 — Refresh token em cookie `httpOnly`

## Status

Aceita.

## Contexto

O frontend precisa manter o usuário logado por semanas sem exigir login a
cada 30 minutos — o vendedor usa o celular em campo o dia inteiro. A
abordagem padrão é um par access + refresh token:

- **Access token:** JWT curto (30 min), enviado em `Authorization: Bearer`.
- **Refresh token:** credencial longa (7 dias), trocada por um novo access
  quando o atual expira.

O ponto sensível é *onde* guardar o refresh token no browser. As opções
usualmente consideradas são:

| Lugar | Acessível via JS | Enviado automaticamente | Risco principal |
| --- | --- | --- | --- |
| `localStorage` | Sim | Não | Vulnerável a XSS |
| `sessionStorage` | Sim | Não | Vulnerável a XSS + perde na aba fechada |
| Cookie normal | Sim | Sim | Vulnerável a XSS + CSRF |
| Cookie `httpOnly` | **Não** | Sim | CSRF |

Um XSS refletido no frontend que conseguisse ler o refresh token do
`localStorage` daria ao atacante 7 dias de sessão válida — bem pior que
roubar um access de 30 min.

## Decisão

**Dois lugares, dois escopos:**

- **Access token → `localStorage`.** Curto (30 min), reexpõe-se a toda hora,
  risco baixo se vazado, e o JS precisa acessá-lo para montar o header
  `Authorization` em cada request via Axios interceptor.
- **Refresh token → cookie `httpOnly` + `Secure` + `SameSite=Lax`.**
  Enviado automaticamente só para o endpoint `/auth/refresh` (via
  `path=/api/v1/auth/refresh` restrito). JavaScript do browser não consegue
  ler. `SameSite=Lax` mitiga CSRF em requisições *cross-site*.

A implementação vive em [`core/security.py`](../../backend/app/core/security.py)
e [`api/v1/auth.py`](../../backend/app/api/v1/auth.py) no backend; no
frontend, [`lib/api.ts`](../../frontend/src/lib/api.ts) faz o refresh
automático no interceptor 401.

## Consequências

**Positivas:**

- XSS no frontend não consegue exfiltrar o refresh token — a sessão longa
  permanece segura.
- UX de login "infinito" sem abrir mão de defesa em profundidade.

**Negativas:**

- Precisamos de `credentials: "include"` no fetch do `/auth/refresh` e
  `ALLOWED_ORIGINS` corretamente configurado em produção (CORS +
  `allow_credentials=True`).
- Em ambiente de desenvolvimento com `http://localhost`, o flag `Secure` é
  desabilitado, o que é aceitável porque o risco é local; em produção o
  flag é obrigatório (validação em `config.py` força `ENVIRONMENT=production`
  a ter HTTPS).
- Um CSRF ainda é teoricamente possível no endpoint de refresh; mitigamos
  com `SameSite=Lax`, que cobre todos os navegadores modernos.
