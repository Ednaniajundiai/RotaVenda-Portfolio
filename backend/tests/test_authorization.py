"""Testes de autorização por role — Fix 3.2 do PLANO_QA.md.

Verifica que endpoints restritos a GERENTE retornam 403 para VENDEDOR.
"""
import pytest
from fastapi.testclient import TestClient

from app.models.user import User


class TestAuthorizationGerente:
    """Endpoints exclusivos do gerente devem retornar 403 para vendedor."""

    def test_listar_usuarios_vendedor_recebe_403(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.get("/api/v1/users", headers=vendedor_headers)
        assert resp.status_code == 403

    def test_criar_usuario_vendedor_recebe_403(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.post(
            "/api/v1/users",
            json={"name": "Novo", "email": "novo@example.com",
                  "password": "senha123", "role": "VENDEDOR"},
            headers=vendedor_headers,
        )
        assert resp.status_code == 403

    def test_relatorio_vendedor_recebe_403(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=vendedor_headers)
        assert resp.status_code == 403

    def test_listar_usuarios_gerente_recebe_200(
        self, api_client: TestClient, gerente_headers: dict
    ):
        resp = api_client.get("/api/v1/users", headers=gerente_headers)
        assert resp.status_code == 200

    def test_relatorio_gerente_recebe_200(
        self, api_client: TestClient, gerente_headers: dict
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=gerente_headers)
        assert resp.status_code == 200


class TestAuthorizationUnauthenticated:
    """Endpoints protegidos devem retornar 401 sem token."""

    def test_sales_sem_token(self, api_client: TestClient):
        resp = api_client.get("/api/v1/sales")
        assert resp.status_code == 401

    def test_clients_sem_token(self, api_client: TestClient):
        resp = api_client.get("/api/v1/clients")
        assert resp.status_code == 401

    def test_reports_sem_token(self, api_client: TestClient):
        resp = api_client.get("/api/v1/reports/resumo")
        assert resp.status_code == 401
