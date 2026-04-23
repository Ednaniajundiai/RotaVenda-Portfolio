"""Testes de integração para os endpoints de autenticação."""

from fastapi.testclient import TestClient

from app.models.user import User


class TestLogin:
    def test_login_sucesso(self, api_client: TestClient, gerente: User):
        resp = api_client.post(
            "/api/v1/auth/login",
            json={"email": gerente.email, "password": "senha123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_senha_errada(self, api_client: TestClient, gerente: User):
        resp = api_client.post(
            "/api/v1/auth/login",
            json={"email": gerente.email, "password": "errada"},
        )
        assert resp.status_code == 401

    def test_login_email_inexistente(self, api_client: TestClient):
        resp = api_client.post(
            "/api/v1/auth/login",
            json={"email": "inexistente@naoexiste.com", "password": "qualquer"},
        )
        assert resp.status_code == 401

    def test_me_autenticado_como_gerente(
        self, api_client: TestClient, gerente: User, gerente_headers: dict
    ):
        resp = api_client.get("/api/v1/auth/me", headers=gerente_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == gerente.email
        assert body["role"] == "GERENTE"

    def test_me_autenticado_como_vendedor(
        self, api_client: TestClient, vendedor: User, vendedor_headers: dict
    ):
        resp = api_client.get("/api/v1/auth/me", headers=vendedor_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == vendedor.email
        assert body["role"] == "VENDEDOR"

    def test_me_sem_token(self, api_client: TestClient):
        resp = api_client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_token_invalido(self, api_client: TestClient):
        resp = api_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer token.invalido.aqui"},
        )
        assert resp.status_code == 401
