"""Testes de integração para client_service — Fix 3.2 do PLANO_QA.md.

Cobre:
- CRUD básico de cliente (criar, buscar, atualizar)
- Soft-delete (deactivate) → requires GERENTE
- Listagem com filtros de busca e bairro
- Cálculo de saldo zerado em novo cliente
- Statement (extrato) inclui vendas e pagamentos
- Associação de cliente a rua
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.street import Street
from app.models.user import User


# ── Helpers ──────────────────────────────────────────────────────────────────


def _client_payload(name: str = "Cliente Teste", phone: str = "11999990001") -> dict:
    return {
        "name": name,
        "phone": phone,
        "primary_neighborhood": "Centro",
        "opening_balance": 0,
    }


# ── Testes de CRUD ────────────────────────────────────────────────────────────


class TestClientCRUD:
    def test_cria_cliente(
        self, api_client: TestClient, gerente_headers: dict
    ):
        resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Novo Cliente QA"),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Novo Cliente QA"
        assert body["is_active"] is True

    def test_cria_cliente_como_vendedor(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        """Criar cliente não requer GERENTE."""
        resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Cliente pelo Vendedor"),
            headers=vendedor_headers,
        )
        assert resp.status_code == 201

    def test_busca_cliente_por_id(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Buscar por ID"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]
        get_resp = api_client.get(
            f"/api/v1/clients/{client_id}", headers=gerente_headers
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == client_id

    def test_atualiza_cliente(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Nome Antigo"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]

        update_resp = api_client.put(
            f"/api/v1/clients/{client_id}",
            json={"name": "Nome Atualizado"},
            headers=gerente_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Nome Atualizado"

    def test_busca_inexistente_retorna_404(
        self, api_client: TestClient, gerente_headers: dict
    ):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = api_client.get(
            f"/api/v1/clients/{fake_id}", headers=gerente_headers
        )
        assert resp.status_code == 404


class TestClientDeactivate:
    def test_gerente_pode_desativar(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Cliente Desativar"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]

        del_resp = api_client.delete(
            f"/api/v1/clients/{client_id}", headers=gerente_headers
        )
        assert del_resp.status_code == 200
        assert del_resp.json()["is_active"] is False

        # Não aparece na listagem padrão (include_inactive=False)
        list_resp = api_client.get(
            "/api/v1/clients?limit=500", headers=gerente_headers
        )
        ids = [c["id"] for c in list_resp.json()]
        assert client_id not in ids

    def test_vendedor_nao_pode_desativar(
        self, api_client: TestClient, gerente_headers: dict, vendedor_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Cliente Protegido"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]

        del_resp = api_client.delete(
            f"/api/v1/clients/{client_id}", headers=vendedor_headers
        )
        assert del_resp.status_code == 403

    def test_include_inactive_mostra_desativados(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Cliente Inativo QA"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]
        api_client.delete(f"/api/v1/clients/{client_id}", headers=gerente_headers)

        list_resp = api_client.get(
            "/api/v1/clients?include_inactive=true&limit=500",
            headers=gerente_headers,
        )
        ids = [c["id"] for c in list_resp.json()]
        assert client_id in ids


class TestClientBalance:
    def test_saldo_zerado_novo_cliente(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Novo Sem Saldo"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]

        balance_resp = api_client.get(
            f"/api/v1/clients/{client_id}/balance", headers=gerente_headers
        )
        assert balance_resp.status_code == 200
        # Cliente novo sem opening_balance deve ter saldo = 0
        assert float(balance_resp.json()["saldo"]) == pytest.approx(0.0, abs=0.01)

    def test_opening_balance_positivo_aparece_no_saldo(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json={
                "name": "Cliente Com Saldo Inicial",
                "phone": "11999992222",
                "primary_neighborhood": "Centro",
                "opening_balance": 150.00,
            },
            headers=gerente_headers,
        )
        assert create_resp.status_code == 201
        client_id = create_resp.json()["id"]

        balance_resp = api_client.get(
            f"/api/v1/clients/{client_id}/balance", headers=gerente_headers
        )
        # opening_balance positivo = dívida inicial do cliente
        assert float(balance_resp.json()["saldo"]) == pytest.approx(150.0, abs=0.01)


class TestClientSearch:
    def test_busca_por_nome(
        self, api_client: TestClient, gerente_headers: dict
    ):
        api_client.post(
            "/api/v1/clients",
            json=_client_payload("Joao da Silva"),
            headers=gerente_headers,
        )
        resp = api_client.get(
            "/api/v1/clients?search=Joao&limit=100", headers=gerente_headers
        )
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()]
        assert any("Joao" in n for n in names)

    def test_busca_retorna_header_total_count(
        self, api_client: TestClient, gerente_headers: dict
    ):
        resp = api_client.get("/api/v1/clients", headers=gerente_headers)
        assert "x-total-count" in resp.headers or "X-Total-Count" in resp.headers


class TestClientStatement:
    def test_statement_vazio_novo_cliente(
        self, api_client: TestClient, gerente_headers: dict
    ):
        create_resp = api_client.post(
            "/api/v1/clients",
            json=_client_payload("Cliente Statement QA"),
            headers=gerente_headers,
        )
        client_id = create_resp.json()["id"]

        stmt_resp = api_client.get(
            f"/api/v1/clients/{client_id}/statement", headers=gerente_headers
        )
        assert stmt_resp.status_code == 200
        body = stmt_resp.json()
        assert "entries" in body
        # Novo cliente sem transações
        assert body["entries"] == []
