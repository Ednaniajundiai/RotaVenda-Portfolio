import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_gerente
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentUpdate
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["Pagamentos"])


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    client_id: Optional[str] = Query(None),
    route_street_id: Optional[str] = Query(None),
    payment_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return payment_service.list_payments(
        db,
        skip=skip,
        limit=limit,
        client_id=client_id,
        route_street_id=route_street_id,
        payment_date=payment_date,
    )


@router.post("", response_model=PaymentResponse, status_code=201)
def create_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return payment_service.create_payment(db, body, seller_id=current_user.id)


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return payment_service.get_payment(db, payment_id)


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: uuid.UUID,
    body: PaymentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return payment_service.update_payment(db, payment_id, body)


@router.delete("/{payment_id}", status_code=204)
def delete_payment(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    payment_service.delete_payment(db, payment_id)
