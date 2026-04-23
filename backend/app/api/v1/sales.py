import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_gerente
from app.models.user import User
from app.schemas.installment import InstallmentResponse
from app.schemas.sale import SaleCreate, SaleResponse, SaleUpdate
from app.services import installment_service, sale_service

router = APIRouter(prefix="/sales", tags=["Vendas"])


@router.get("", response_model=list[SaleResponse])
def list_sales(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    client_id: Optional[str] = Query(None),
    route_street_id: Optional[str] = Query(None),
    sale_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return sale_service.list_sales(
        db,
        skip=skip,
        limit=limit,
        client_id=client_id,
        route_street_id=route_street_id,
        sale_date=sale_date,
    )


@router.post("", response_model=SaleResponse, status_code=201)
def create_sale(
    body: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return sale_service.create_sale(db, body, seller_id=current_user.id)


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return sale_service.get_sale(db, sale_id)


@router.put("/{sale_id}", response_model=SaleResponse)
def update_sale(
    sale_id: uuid.UUID,
    body: SaleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return sale_service.update_sale(db, sale_id, body)


@router.delete("/{sale_id}", status_code=204)
def delete_sale(
    sale_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    sale_service.delete_sale(db, sale_id)


@router.get("/{sale_id}/installments", response_model=list[InstallmentResponse])
def list_sale_installments(
    sale_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sale_service.get_sale(db, sale_id)  # garante 404 se não existe
    return installment_service.get_sale_installments(db, sale_id)
