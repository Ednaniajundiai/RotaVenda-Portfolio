# ADR 0002 — Refresh token em cookie `httpOnly`

## Status

Aceita.

## Contexto

O vendedor usa o tablet em campo o dia inteiro, frequentemente sob rede
instável. Reautenticar no meio da rota — de pé, na porta de um cliente — é
inaceitável do ponto de vista operacional. A abordagem padrão é um par de
tokens:

- **Token de acesso:** enviado em `Authorization: Bearer` a cada requisição.
  Dimensionado para cobrir um turno de trabalho completo (~12 h), de modo que
  a renovação nunca caia no meio do expediente.
- **Token de renovação:** credencial longa (7 dias), trocada por um novo token
  de acesso quando o atual expira — inclusive em segundo plano.

O ponto sensível é *onde* guardar o refresh token no browser. As opções
usualmente consideradas são:

| Lugar | Acessível via JS | Enviado automaticamente | Risco principal |
| --- | --- | --- | --- |
| `localStorage` | Sim | Não | Vulnerável a XSS |
| `sessionStorage` | Sim | Não | Vulnerável a XSS + perde na aba fechada |
| Cookie normal | Sim | Sim | Vulnerável a XSS + CSRF |
| Cookie `httpOnly` | **Não** | Sim | CSRF |

Um XSS no frontend capaz de ler o token de renovação daria ao atacante 7 dias
de sessão válida, **renováveis indefinidamente**. É materialmente pior que
capturar um token de acesso, que expira sozinho e não se regenera.

## Decisão

**Dois lugares, dois escopos:**

- **Token de acesso → armazenamento do navegador.** Expira sozinho, não se
  regenera, e o JavaScript precisa lê-lo para montar o cabeçalho
  `Authorization` a cada requisição. Vazá-lo dá ao atacante uma janela
  limitada e que se fecha por conta própria.
- **Token de renovação → cookie `httpOnly` + `Secure` + `SameSite=Lax`.**
  Enviado automaticamente só para o endpoint `/auth/refresh` (via
  `path=/api/v1/auth/refresh` restrito). JavaScript do browser não consegue
  ler. `SameSite=Lax` mitiga CSRF em requisições *cross-site*.

No frontend, a renovação é automática: um interceptor detecta a resposta de não
autenticado, troca o token e reenvia a requisição original — de forma
transparente para quem está usando o sistema.

**A autorização efetiva nunca depende do cliente.** O papel do usuário é
resolvido no servidor a cada requisição. O frontend guarda o papel em um cookie
separado e não sensível, usado apenas para decidir o que renderizar e evitar
exibir uma tela que o usuário não poderia acessar — jamais como base de decisão
de acesso.

## Consequências

**Positivas:**

- XSS no frontend não consegue exfiltrar o refresh token — a sessão longa
  permanece segura.
- UX de login "infinito" sem abrir mão de defesa em profundidade.

**Negativas:**

- Exige envio explícito de credenciais na chamada de renovação e origens
  permitidas corretamente configuradas em produção.
- Em desenvolvimento sobre `http://localhost` o sinalizador `Secure` é
  desligado — aceitável porque o risco é local. Em produção ele é obrigatório,
  e a configuração falha na inicialização se o ambiente estiver marcado como
  produtivo sem HTTPS. A validação acontece na carga das configurações, não em
  tempo de requisição: erro de configuração deve impedir o processo de subir,
  não vazar silenciosamente para o usuário.
- Um CSRF ainda é teoricamente possível no endpoint de refresh; mitigamos
  com `SameSite=Lax`, que cobre todos os navegadores modernos.
