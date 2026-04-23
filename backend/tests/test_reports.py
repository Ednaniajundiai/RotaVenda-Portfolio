"""Testes de integração para os endpoints de relatórios."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.payment import Payment
from app.models.sale import PaymentMode, Sale, SaleType
from app.models.user import User


@pytest.fixture
def cliente(db: Session) -> Client:
    c = Client(name="Cliente Relatório Teste", phone="11999990000")
    db.add(c)
    db.flush()
    return c


@pytest.fixture
def venda_fiado(db: Session, gerente: User, cliente: Client) -> Sale:
    s = Sale(
        client_id=cliente.id,
        seller_id=gerente.id,
        sale_date=date.today(),
        amount=150.00,
        sale_type=SaleType.LOJA,
        payment_mode=PaymentMode.FIADO,
    )
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def venda_a_vista(db: Session, gerente: User, cliente: Client) -> Sale:
    s = Sale(
        client_id=cliente.id,
        seller_id=gerente.id,
        sale_date=date.today(),
        amount=80.00,
        sale_type=SaleType.ROTA,
        payment_mode=PaymentMode.A_VISTA,
    )
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def pagamento(db: Session, gerente: User, cliente: Client) -> Payment:
    p = Payment(
        client_id=cliente.id,
        seller_id=gerente.id,
        payment_date=date.today(),
        amount=50.00,
    )
    db.add(p)
    db.flush()
    return p


class TestSalesReport:
    def test_gerente_acessa_relatorio(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
    ):
        resp = api_client.get("/api/v1/reports/vendas", headers=gerente_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total_count" in body
        assert "total_amount" in body
        assert "total_a_vista" in body
        assert "total_fiado" in body
        assert body["total_count"] >= 1

    def test_vendedor_nao_acessa_relatorio(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.get("/api/v1/reports/vendas", headers=vendedor_headers)
        assert resp.status_code == 403

    def test_sem_autenticacao_retorna_401(self, api_client: TestClient):
        resp = api_client.get("/api/v1/reports/vendas")
        assert resp.status_code == 401

    def test_filtro_por_data_retorna_venda_de_hoje(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
    ):
        hoje = date.today().isoformat()
        resp = api_client.get(
            f"/api/v1/reports/vendas?date_from={hoje}&date_to={hoje}",
            headers=gerente_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_count"] >= 1
        assert body["total_fiado"] >= 150.0

    def test_filtro_data_futura_retorna_zero(
        self,
        api_client: TestClient,
        gerente_headers: dict,
    ):
        futuro = (date.today() + timedelta(days=365)).isoformat()
        resp = api_client.get(
            f"/api/v1/reports/vendas?date_from={futuro}",
            headers=gerente_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 0

    def test_filtro_payment_mode_fiado(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
        venda_a_vista: Sale,
    ):
        resp = api_client.get(
            "/api/v1/reports/vendas?payment_mode=FIADO",
            headers=gerente_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert item["payment_mode"] == "FIADO"
        assert body["total_a_vista"] == 0.0

    def test_filtro_sale_type_loja(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
    ):
        resp = api_client.get(
            "/api/v1/reports/vendas?sale_type=LOJA",
            headers=gerente_headers,
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["sale_type"] == "LOJA"

    def test_totais_consistentes(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
        venda_a_vista: Sale,
    ):
        hoje = date.today().isoformat()
        resp = api_client.get(
            f"/api/v1/reports/vendas?date_from={hoje}&date_to={hoje}",
            headers=gerente_headers,
        )
        body = resp.json()
        assert abs(body["total_amount"] - (body["total_a_vista"] + body["total_fiado"])) < 0.01


class TestPaymentsReport:
    def test_gerente_acessa_pagamentos(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        pagamento: Payment,
    ):
        resp = api_client.get("/api/v1/reports/pagamentos", headers=gerente_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total_count" in body
        assert body["total_count"] >= 1

    def test_vendedor_nao_acessa_pagamentos(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.get(
            "/api/v1/reports/pagamentos", headers=vendedor_headers
        )
        assert resp.status_code == 403

    def test_filtro_data_pagamentos(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        pagamento: Payment,
    ):
        hoje = date.today().isoformat()
        resp = api_client.get(
            f"/api/v1/reports/pagamentos?date_from={hoje}&date_to={hoje}",
            headers=gerente_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_count"] >= 1
        assert body["total_amount"] >= 50.0


class TestSummary:
    def test_resumo_retorna_todos_os_campos(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
        pagamento: Payment,
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=gerente_headers)
        assert resp.status_code == 200
        body = resp.json()
        campos = [
            "total_sales",
            "total_sales_count",
            "total_a_vista",
            "total_fiado",
            "total_payments",
            "total_payments_count",
            "saldo_devedor_total",
            "top_clients",
        ]
        for campo in campos:
            assert campo in body, f"Campo ausente: {campo}"

    def test_resumo_vendedor_nao_acessa(
        self, api_client: TestClient, vendedor_headers: dict
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=vendedor_headers)
        assert resp.status_code == 403

    def test_resumo_saldo_devedor_com_dados(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
        pagamento: Payment,
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=gerente_headers)
        body = resp.json()
        # Fiado = 150, pagamento = 50, saldo mínimo esperado = 100
        assert body["saldo_devedor_total"] >= 100.0

    def test_resumo_top_clients_e_lista(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        venda_fiado: Sale,
    ):
        resp = api_client.get("/api/v1/reports/resumo", headers=gerente_headers)
        body = resp.json()
        assert isinstance(body["top_clients"], list)
        if body["top_clients"]:
            assert "client_name" in body["top_clients"][0]
            assert "total_fiado" in body["top_clients"][0]
