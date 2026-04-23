# Contribuindo para o RotaVenda

Obrigado pelo interesse no projeto. Este documento descreve o fluxo de trabalho,
convenções de código e checklist esperado para contribuições.

## Fluxo de trabalho

1. Faça um fork do repositório.
2. Crie uma branch a partir de `main`: `git checkout -b feat/nome-curto`.
3. Implemente a mudança (ver convenções abaixo).
4. Rode a checklist local antes de abrir o PR.
5. Abra um Pull Request descrevendo **o quê** e **por quê**.

Nunca faça commit direto em `main` — a branch é protegida e toda mudança passa
por PR.

## Convenções de commit

Este projeto segue [Conventional Commits](https://www.conventionalcommits.org/)
em português:

```
tipo(escopo): descrição curta em português, sem ponto final
```

**Tipos aceitos:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`.

**Escopos comuns:** `auth`, `users`, `streets`, `clients`, `routes`, `sales`,
`payments`, `products`, `dashboard`, `vendas`, `infra`, `db`.

**Exemplos:**

```
feat(sales): adicionar edição de parcelas no extrato da venda
fix(payments): corrigir FIFO quando há parcela vencida com pagamento parcial
docs(readme): incluir GIF do fluxo principal
```

## Convenções de código

### Backend (Python 3.11)

- Formatação: `black` (line-length 88) + `isort` (profile `black`). Rode antes
  de cada commit.
- Nomes: classes em `PascalCase`, funções/variáveis em `snake_case`, constantes
  em `SCREAMING_SNAKE_CASE`.
- Roteadores FastAPI **nunca** carregam lógica de negócio — toda regra vai em
  `app/services/`.
- Banco: sempre via ORM. UUID como PK. Soft-delete via `is_active = False` para
  entidades principais.
- Migrations: `upgrade()` e `downgrade()` sempre implementados.

### Frontend (Next.js 15 + TypeScript)

- Sem `any`. Crie uma `interface` ou use `unknown`.
- Estado do servidor: sempre via TanStack Query. Nunca use `useState` para
  dados da API.
- HTTP: exclusivamente pela instância Axios em `lib/api.ts`.
- Forms: `react-hook-form` + Zod.
- Estilização: Tailwind. Use `cn()` de `lib/utils.ts` para classes condicionais.
- Query keys: sempre importadas de `lib/constants.ts`.

## Testes

Os testes de integração em `backend/tests/` usam o mesmo banco do `.env` e
rodam em transações revertidas (sem poluir o banco). Execute:

```bash
make test
```

Para um arquivo específico:

```bash
docker compose exec backend pytest tests/test_sale_service.py -v
```

## Checklist antes de abrir o PR

- [ ] `make format` sem alterações pendentes (black + isort).
- [ ] `make test` passando.
- [ ] `make lint` sem erros.
- [ ] Nenhum `console.log` no frontend ou `print()` de debug no backend.
- [ ] Se a mudança envolve schema: nova migration com `downgrade()` implementado.
- [ ] Se há novas variáveis de ambiente: documentadas em `backend/.env.example`
      ou `frontend/.env.local.example`.
- [ ] Commit segue Conventional Commits.

## Reportando bugs

Abra uma issue com:

- Passos para reproduzir.
- Comportamento esperado e observado.
- Versões (SO, Docker, navegador se for frontend).
- Logs relevantes (remova dados sensíveis).

## Licença

Ao contribuir você concorda que seu código será distribuído sob a licença MIT
do projeto.
