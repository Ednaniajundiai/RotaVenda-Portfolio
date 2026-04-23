"""Fixtures compartilhadas para testes de integração.

Estratégia: cada teste roda dentro de uma transação que é revertida ao final,
mantendo o banco limpo sem precisar de um banco de dados dedicado para testes.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User, UserRole


@pytest.fixture(scope="session")
def db_engine():
    """Engine compartilhado por todos os testes da sessão."""
    engine = create_engine(settings.DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db(db_engine):
    """Sessão com transação envolvente revertida ao fim de cada teste.

    Usa join_transaction_mode='create_savepoint' para que session.commit()
    interno nos services libere o savepoint (não a transação externa),
    garantindo isolamento entre testes.
    """
    with db_engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
        )
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def api_client(db: Session):
    """TestClient com a dependência get_db sobrescrita para usar a sessão de teste."""

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def gerente(db: Session) -> User:
    """Usuário GERENTE criado para uso nos testes."""
    user = User(
        name="Gerente CI",
        email="gerente_ci@rotavenda.com",
        hashed_password=hash_password("senha123"),
        role=UserRole.GERENTE,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def vendedor(db: Session) -> User:
    """Usuário VENDEDOR criado para uso nos testes."""
    user = User(
        name="Vendedor CI",
        email="vendedor_ci@rotavenda.com",
        hashed_password=hash_password("senha123"),
        role=UserRole.VENDEDOR,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def gerente_headers(gerente: User) -> dict:
    """Headers de autorização com token JWT do gerente."""
    token = create_access_token({"sub": str(gerente.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def vendedor_headers(vendedor: User) -> dict:
    """Headers de autorização com token JWT do vendedor."""
    token = create_access_token({"sub": str(vendedor.id)})
    return {"Authorization": f"Bearer {token}"}
