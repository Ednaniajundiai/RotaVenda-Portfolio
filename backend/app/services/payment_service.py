import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.payment import Payment
from app.models.route_street import RouteStreet
from app.schemas.payment import PaymentCreate, PaymentUpdate
from app.services import installment_service


def _payment_to_dict(payment: Payment) -> dict:
    return {
        "id": str(payment.id),
        "client_id": str(payment.client_id),
        "client_name": payment.client.name if payment.client else "",
        "seller_id": str(payment.seller_id),
        "seller_name": payment.seller.name if payment.seller else "",
        "route_street_id": (
            str(payment.route_street_id) if payment.route_street_id else None
        ),
        "payment_date": payment.payment_date,
        "amount": float(payment.amount),
        "notes": payment.notes,
        "created_at": payment.created_at,
    }


def _load_payment(db: Session, payment_id: uuid.UUID) -> Payment:
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.seller))
        .filter(
            Payment.id == payment_id, Payment.is_active == True  # noqa: E712
        )
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado",
        )
    return payment


def list_payments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    client_id: Optional[str] = None,
    route_street_id: Optional[str] = None,
    payment_date: Optional[str] = None,
) -> list[dict]:
    query = (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.seller))
        .filter(Payment.is_active == True)  # noqa: E712
    )
    if client_id:
        query = query.filter(Payment.client_id == uuid.UUID(client_id))
    if route_street_id:
        query = query.filter(Payment.route_street_id == uuid.UUID(route_street_id))
    if payment_date:
        query = query.filter(Payment.payment_date == payment_date)
    payments = (
        query.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_payment_to_dict(p) for p in payments]


def get_payment(db: Session, payment_id: uuid.UUID) -> dict:
    return _payment_to_dict(_load_payment(db, payment_id))


def create_payment(
    db: Session, data: PaymentCreate, seller_id: uuid.UUID
) -> dict:
    client = (
        db.query(Client)
        .filter(
            Client.id == uuid.UUID(data.client_id),
            Client.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    route_street_id = None
    if data.route_street_id:
        rs = db.query(RouteStreet).filter(
            RouteStreet.id == uuid.UUID(data.route_street_id)
        ).first()
        if not rs:
            raise HTTPException(status_code=404, detail="Rua da rota não encontrada")
        route_street_id = rs.id

    payment_date = data.payment_date or date.today()
    payment = Payment(
        client_id=uuid.UUID(data.client_id),
        seller_id=seller_id,
        route_street_id=route_street_id,
        payment_date=payment_date,
        amount=data.amount,
        notes=data.notes,
    )
    db.add(payment)
    db.flush()

    installment_service.apply_payment_to_installments(
        db,
        payment.id,
        data.amount,
        data.installment_applications,
        payment_date,
    )
    db.commit()

    return _payment_to_dict(_load_payment(db, payment.id))


def update_payment(
    db: Session, payment_id: uuid.UUID, data: PaymentUpdate
) -> dict:
    payment = _load_payment(db, payment_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(payment, field, value)
    db.commit()
    return _payment_to_dict(_load_payment(db, payment_id))


def delete_payment(db: Session, payment_id: uuid.UUID) -> None:
    payment = _load_payment(db, payment_id)
    payment.is_active = False
    db.commit()
