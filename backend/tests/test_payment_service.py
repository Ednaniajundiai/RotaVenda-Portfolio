"""Testes de integração para payment_service.

Cobre:
- Criação de pagamento válido
- Rejeição de valor zero/negativo (schema Pydantic)
- Aplicação em parcelas (installment_applications)
- Soft-delete (is_active = False) — pagamento some da listagem
- Verificação de saldo: venda FIADO + pagamento = saldo atualizado
- Apenas GERENTE pode deletar pagamento (403 para vendedor)
- Matching FIFO: quitação exata, múltiplas parcelas, parcial, excedente
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.product import Product
from app.models.sale_installment import SaleInstallment
from app.models.user import User


# ── Fixtures locais ──────────────────────────────────────────────────────────


@pytest.fixture
def client_obj(db: Session) -> Client:
    c = Client(
        name="Cliente Pagamento Teste",
        phone="11999991111",
        opening_balance=100,
    )
    db.add(c)
    db.flush()
    return c


@pytest.fixture
def fiado_client(db: Session) -> Client:
    """Cliente com opening_balance = 0, ideal para testar FIFO em isolamento."""
    c = Client(
        name="Cliente FIFO",
        phone="11999992222",
        opening_balance=0,
    )
    db.add(c)
    db.flush()
    return c


@pytest.fixture
def product_obj(db: Session) -> Product:
    p = Product(
        name="Produto Pagamento QA",
        category="Limpeza",
        unit_measure="Unidade",
        price=50.00,
        current_stock=100,
        min_stock=5,
    )
    db.add(p)
    db.flush()
    return p


def _create_fiado_sale(
    api_client: TestClient,
    headers: dict,
    client_id: str,
    product_id: str,
    amount: float = 50.0,
) -> dict:
    """Helper: cria uma venda FIADO com uma parcela e retorna o body."""
    resp = api_client.post(
        "/api/v1/sales",
        json={
            "client_id": client_id,
            "sale_type": "LOJA",
            "payment_mode": "FIADO",
            "items": [{"product_id": product_id, "quantity": 1, "unit_price": amount}],
            "discount": 0,
            "installments": [
                {
                    "number": 1,
                    "due_date": (date.today() + timedelta(days=30)).isoformat(),
                    "amount": amount,
                }
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Testes ───────────────────────────────────────────────────────────────────


class TestCreatePayment:
    def test_cria_pagamento_basico(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "30.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert float(body["amount"]) == 30.0
        assert body["client_id"] == str(client_obj.id)

    def test_rejeita_valor_zero(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "0.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 422

    def test_rejeita_valor_negativo(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "-10.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 422

    def test_pagamento_sem_autenticacao_recebe_401(
        self,
        api_client: TestClient,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "10.00",
                "payment_date": date.today().isoformat(),
            },
        )
        assert resp.status_code == 401

    def test_cria_pagamento_com_nota(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "25.00",
                "payment_date": date.today().isoformat(),
                "notes": "Pagamento em dinheiro",
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["notes"] == "Pagamento em dinheiro"

    def test_vendedor_pode_criar_pagamento(
        self,
        api_client: TestClient,
        vendedor_headers: dict,
        client_obj: Client,
    ):
        """Pagamento não requer GERENTE — vendedor pode registrar."""
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "15.00",
                "payment_date": date.today().isoformat(),
            },
            headers=vendedor_headers,
        )
        assert resp.status_code == 201


class TestDeletePayment:
    def test_gerente_pode_deletar(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        # Cria
        create_resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "20.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        payment_id = create_resp.json()["id"]

        # Deleta
        del_resp = api_client.delete(
            f"/api/v1/payments/{payment_id}", headers=gerente_headers
        )
        assert del_resp.status_code == 204

        # Verifica que sumiu da listagem
        list_resp = api_client.get(
            f"/api/v1/payments?client_id={client_obj.id}", headers=gerente_headers
        )
        ids = [p["id"] for p in list_resp.json()]
        assert payment_id not in ids

    def test_vendedor_nao_pode_deletar(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        vendedor_headers: dict,
        client_obj: Client,
    ):
        """Deletar pagamento requer GERENTE (require_gerente)."""
        create_resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "10.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        payment_id = create_resp.json()["id"]

        del_resp = api_client.delete(
            f"/api/v1/payments/{payment_id}", headers=vendedor_headers
        )
        assert del_resp.status_code == 403


class TestPaymentBalanceImpact:
    def test_pagamento_reduz_saldo_fiado(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        client_obj: Client,
        product_obj: Product,
    ):
        """Após venda FIADO de R$ 50, um pagamento de R$ 30 → saldo = R$ 20."""
        # Venda fiado R$ 50
        _create_fiado_sale(
            api_client, gerente_headers, str(client_obj.id), str(product_obj.id), 50.0
        )

        # Saldo antes
        balance_before = api_client.get(
            f"/api/v1/clients/{client_obj.id}/balance", headers=gerente_headers
        ).json()
        assert float(balance_before["saldo"]) == pytest.approx(150.0, abs=0.01)

        # Pagamento R$ 30
        api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "30.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )

        # Saldo após
        balance_after = api_client.get(
            f"/api/v1/clients/{client_obj.id}/balance", headers=gerente_headers
        ).json()
        assert float(balance_after["saldo"]) == pytest.approx(120.0, abs=0.01)

    def test_pagamento_excedente_gera_erro(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
        product_obj: Product,
    ):
        """Pagamento maior que a dívida → erro 400."""
        # Venda fiado R$ 30
        _create_fiado_sale(
            api_client, gerente_headers, str(client_obj.id), str(product_obj.id), 30.0
        )

        # Tenta pagar R$ 500 (tem 100 de opening balance + 30 de venda = 130 de dívida total)
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(client_obj.id),
                "amount": "500.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 400
        assert "excede" in resp.json()["detail"].lower()


class TestFifoMatching:
    """Pagamento sem `installment_applications` deve amortizar parcelas na
    ordem FIFO (`due_date` ASC, `number` ASC), conforme
    `installment_service.apply_payment_to_installments`.
    """

    def test_paga_parcela_exata_marca_como_quitada(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        fiado_client: Client,
        product_obj: Product,
    ):
        """Pagamento do valor exato da parcela → paid_amount == amount e paid_at preenchido."""
        sale = _create_fiado_sale(
            api_client,
            gerente_headers,
            str(fiado_client.id),
            str(product_obj.id),
            50.0,
        )

        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(fiado_client.id),
                "amount": "50.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 201

        inst = (
            db.query(SaleInstallment)
            .filter(SaleInstallment.sale_id == sale["id"])
            .first()
        )
        db.refresh(inst)
        assert float(inst.paid_amount) == pytest.approx(50.0, abs=0.01)
        assert inst.paid_at is not None

        balance = api_client.get(
            f"/api/v1/clients/{fiado_client.id}/balance", headers=gerente_headers
        ).json()
        assert float(balance["saldo"]) == pytest.approx(0.0, abs=0.01)

    def test_paga_multiplas_parcelas_em_ordem_fifo(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        fiado_client: Client,
        product_obj: Product,
    ):
        """Pagamento que cobre 2 parcelas deve quitar a mais antiga e ir para a seguinte."""
        today = date.today()

        # Venda 1: R$ 30, vence hoje+10 dias (mais antiga)
        sale1 = api_client.post(
            "/api/v1/sales",
            json={
                "client_id": str(fiado_client.id),
                "sale_type": "LOJA",
                "payment_mode": "FIADO",
                "items": [
                    {"product_id": str(product_obj.id), "quantity": 1, "unit_price": 30.0}
                ],
                "discount": 0,
                "installments": [
                    {
                        "number": 1,
                        "due_date": (today + timedelta(days=10)).isoformat(),
                        "amount": 30.0,
                    }
                ],
            },
            headers=gerente_headers,
        ).json()

        # Venda 2: R$ 40, vence hoje+20 dias (mais nova)
        sale2 = api_client.post(
            "/api/v1/sales",
            json={
                "client_id": str(fiado_client.id),
                "sale_type": "LOJA",
                "payment_mode": "FIADO",
                "items": [
                    {"product_id": str(product_obj.id), "quantity": 1, "unit_price": 40.0}
                ],
                "discount": 0,
                "installments": [
                    {
                        "number": 1,
                        "due_date": (today + timedelta(days=20)).isoformat(),
                        "amount": 40.0,
                    }
                ],
            },
            headers=gerente_headers,
        ).json()

        # Paga R$ 50: deve quitar toda sale1 (30) e aplicar 20 em sale2
        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(fiado_client.id),
                "amount": "50.00",
                "payment_date": today.isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 201

        inst1 = (
            db.query(SaleInstallment)
            .filter(SaleInstallment.sale_id == sale1["id"])
            .first()
        )
        inst2 = (
            db.query(SaleInstallment)
            .filter(SaleInstallment.sale_id == sale2["id"])
            .first()
        )
        db.refresh(inst1)
        db.refresh(inst2)

        # Parcela mais antiga: totalmente quitada
        assert float(inst1.paid_amount) == pytest.approx(30.0, abs=0.01)
        assert inst1.paid_at is not None
        # Parcela mais nova: parcialmente amortizada
        assert float(inst2.paid_amount) == pytest.approx(20.0, abs=0.01)
        assert inst2.paid_at is None

    def test_pagamento_parcial_deixa_saldo_na_parcela(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        fiado_client: Client,
        product_obj: Product,
    ):
        """Pagamento menor que a parcela → parcela fica com paid_amount parcial e paid_at=None."""
        sale = _create_fiado_sale(
            api_client,
            gerente_headers,
            str(fiado_client.id),
            str(product_obj.id),
            100.0,
        )

        resp = api_client.post(
            "/api/v1/payments",
            json={
                "client_id": str(fiado_client.id),
                "amount": "40.00",
                "payment_date": date.today().isoformat(),
            },
            headers=gerente_headers,
        )
        assert resp.status_code == 201

        inst = (
            db.query(SaleInstallment)
            .filter(SaleInstallment.sale_id == sale["id"])
            .first()
        )
        db.refresh(inst)
        assert float(inst.paid_amount) == pytest.approx(40.0, abs=0.01)
        assert inst.paid_at is None

        balance = api_client.get(
            f"/api/v1/clients/{fiado_client.id}/balance", headers=gerente_headers
        ).json()
        assert float(balance["saldo"]) == pytest.approx(60.0, abs=0.01)
