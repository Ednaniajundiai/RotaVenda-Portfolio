"""Teste de conectividade com o banco de dados configurado em DATABASE_URL."""

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


def test_database_url_is_configured():
    """Verifica se DATABASE_URL foi carregada corretamente do .env."""
    assert settings.DATABASE_URL, "DATABASE_URL não está definida no .env"
    assert settings.DATABASE_URL.startswith("postgresql"), (
        f"DATABASE_URL inesperada: {settings.DATABASE_URL}"
    )


def test_database_connection():
    """Verifica se é possível abrir uma conexão e executar uma query simples."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        row = result.fetchone()
        assert row[0] == 1, "Query de validação retornou valor inesperado"


def test_database_version():
    """Loga a versão do PostgreSQL para confirmar que o servidor está acessível."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        assert "PostgreSQL" in version, f"Versão inesperada do banco: {version}"
        print(f"\nVersão do banco: {version}")
