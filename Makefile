.PHONY: help up down clean test seed format lint migrate logs ps shell-backend shell-db

help:           ## Lista os targets disponíveis
	@awk 'BEGIN {FS = ":.*##"; printf "\nTargets disponíveis:\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

up:             ## Sobe o ambiente completo (db + backend + frontend)
	docker compose up --build

down:           ## Para e remove containers (preserva volumes)
	docker compose down

clean:          ## Remove containers e volumes (reset total do banco)
	docker compose down -v

test:           ## Roda a suíte de testes do backend
	docker compose exec backend pytest

seed:           ## Popula o banco com dados sintéticos de demonstração
	docker compose exec backend python -m app.db.seed_demo

format:         ## Formata o código do backend (black + isort)
	docker compose exec backend bash -c "black . && isort ."

lint:           ## Executa o lint do frontend
	docker compose exec frontend npm run lint

migrate:        ## Aplica migrations pendentes
	docker compose exec backend alembic upgrade head

logs:           ## Acompanha os logs do backend
	docker compose logs -f backend

ps:             ## Lista os containers em execução
	docker compose ps

shell-backend:  ## Abre um shell interativo no container backend
	docker compose exec backend bash

shell-db:       ## Abre um psql no banco
	docker compose exec db psql -U rotavenda -d rotavenda
