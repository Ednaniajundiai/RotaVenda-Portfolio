"""Testes de integração para sale_service — Fix 3.2 do PLANO_QA.md.

Cobre os cenários críticos:
- Criação de venda com itens
- Edição bloqueada quando há parcelas pagas (1.2 e 1.3)
- Edição de payment_mode bloqueada quando há parcelas pagas (1.2)
- Soft-delete (is_active = False)
- Data futura rejeitada (2.4)
"""
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.product import Product
from app.models.sale import PaymentMode, Sale, SaleType
from app.models.sale_installment import SaleInstallment
from app.models.user import User


# ── Fixtures locais ──────────────────────────────────────────────────────────


@pytest.fixture
def client_obj(db: Session, gerente: User) -> Client:
    c = Client(
        name="Cliente Teste",
        phone="11999990000",
        opening_balance=0,
    )
    db.add(c)
    db.flush()
    return c


@pytest.fixture
def product_obj(db: Session) -> Product:
    p = Product(
        name="Produto Teste QA",
        category="Limpeza",
        unit_measure="Unidade",
        price=10.00,
        current_stock=100,
        min_stock=5,
    )
    db.add(p)
    db.flush()
    return p


# ── Helpers ──────────────────────────────────────────────────────────────────


def _sale_payload(client_id: str, product_id: str, payment_mode: str = "A_VISTA") -> dict:
    return {
        "client_id": client_id,
        "sale_type": "LOJA",
        "payment_mode": payment_mode,
        "items": [{"product_id": product_id, "quantity": 2, "unit_price": 10.0}],
        "discount": 0,
    }


def _fiado_payload(client_id: str, product_id: str) -> dict:
    payload = _sale_payload(client_id, product_id, "FIADO")
    payload["installments"] = [
        {
            "number": 1,
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "amount": 20.0,
        }
    ]
    return payload


# ── Testes ───────────────────────────────────────────────────────────────────


class TestCreateSale:
    def test_cria_venda_avista(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
        product_obj: Product,
    ):
        resp = api_client.post(
            "/api/v1/sales",
            json=_sale_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["amount"] == 20.0
        assert body["payment_mode"] == "A_VISTA"
        assert len(body["items"]) == 1

    def test_cria_venda_fiado_com_parcela(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
        product_obj: Product,
    ):
        resp = api_client.post(
            "/api/v1/sales",
            json=_fiado_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["payment_mode"] == "FIADO"
        assert len(body["installments"]) == 1
        assert body["installments"][0]["amount"] == 20.0

    def test_rejeita_data_futura(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
        product_obj: Product,
    ):
        payload = _sale_payload(str(client_obj.id), str(product_obj.id))
        payload["sale_date"] = (date.today() + timedelta(days=1)).isoformat()
        resp = api_client.post("/api/v1/sales", json=payload, headers=gerente_headers)
        assert resp.status_code == 422

    def test_rejeita_sem_itens(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
    ):
        resp = api_client.post(
            "/api/v1/sales",
            json={"client_id": str(client_obj.id), "sale_type": "LOJA",
                  "payment_mode": "A_VISTA", "items": []},
            headers=gerente_headers,
        )
        assert resp.status_code in (400, 422)


class TestUpdateSale:
    def test_bloqueia_edicao_itens_com_parcela_paga(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        client_obj: Client,
        product_obj: Product,
    ):
        """Fix 1.2+1.3: edição de itens deve falhar se parcela tem paid_amount > 0."""
        # Cria venda FIADO
        resp = api_client.post(
            "/api/v1/sales",
            json=_fiado_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        sale_id = resp.json()["id"]

        # Simula pagamento parcial na parcela
        inst = db.query(SaleInstallment).filter(
            SaleInstallment.sale_id == uuid.UUID(sale_id)
        ).first()
        assert inst is not None
        inst.paid_amount = 5.0
        db.flush()

        # Tenta editar itens → deve bloquear
        resp2 = api_client.put(
            f"/api/v1/sales/{sale_id}",
            json={"items": [{"product_id": str(product_obj.id), "quantity": 3, "unit_price": 10.0}]},
            headers=gerente_headers,
        )
        assert resp2.status_code == 400
        assert "parcela" in resp2.json()["detail"].lower()

    def test_bloqueia_mudanca_payment_mode_com_parcela_paga(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        client_obj: Client,
        product_obj: Product,
    ):
        """Fix 1.2: mudar payment_mode deve falhar se há parcelas pagas."""
        resp = api_client.post(
            "/api/v1/sales",
            json=_fiado_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        sale_id = resp.json()["id"]

        inst = db.query(SaleInstallment).filter(
            SaleInstallment.sale_id == uuid.UUID(sale_id)
        ).first()
        inst.paid_amount = 5.0
        db.flush()

        resp2 = api_client.put(
            f"/api/v1/sales/{sale_id}",
            json={"payment_mode": "A_VISTA"},
            headers=gerente_headers,
        )
        assert resp2.status_code == 400

    def test_permite_edicao_description_com_parcela_paga(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        db: Session,
        client_obj: Client,
        product_obj: Product,
    ):
        """Campos neutros (description) devem ser editáveis mesmo com parcelas pagas."""
        resp = api_client.post(
            "/api/v1/sales",
            json=_fiado_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        sale_id = resp.json()["id"]

        inst = db.query(SaleInstallment).filter(
            SaleInstallment.sale_id == uuid.UUID(sale_id)
        ).first()
        inst.paid_amount = 5.0
        db.flush()

        resp2 = api_client.put(
            f"/api/v1/sales/{sale_id}",
            json={"description": "Obs alterada"},
            headers=gerente_headers,
        )
        assert resp2.status_code == 200
        assert resp2.json()["description"] == "Obs alterada"


class TestSoftDeleteSale:
    def test_soft_delete_oculta_venda(
        self,
        api_client: TestClient,
        gerente_headers: dict,
        client_obj: Client,
        product_obj: Product,
    ):
        resp = api_client.post(
            "/api/v1/sales",
            json=_sale_payload(str(client_obj.id), str(product_obj.id)),
            headers=gerente_headers,
        )
        assert resp.status_code == 201
        sale_id = resp.json()["id"]

        # Soft-delete
        del_resp = api_client.delete(
            f"/api/v1/sales/{sale_id}", headers=gerente_headers
        )
        assert del_resp.status_code == 204

        # Não deve aparecer na listagem
        list_resp = api_client.get("/api/v1/sales", headers=gerente_headers)
        ids = [s["id"] for s in list_resp.json()]
        assert sale_id not in ids

        # Não deve ser acessível diretamente
        get_resp = api_client.get(f"/api/v1/sales/{sale_id}", headers=gerente_headers)
        assert get_resp.status_code == 404
