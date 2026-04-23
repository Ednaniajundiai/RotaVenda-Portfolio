import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_gerente
from app.models.user import User
from app.schemas.street import (
    ClientInStreetResponse,
    ReorderRequest,
    StreetCreate,
    StreetResponse,
    StreetUpdate,
)
from app.services import street_service

router = APIRouter(prefix="/streets", tags=["Streets"])


@router.get("", response_model=list[StreetResponse])
def list_streets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return street_service.list_streets(db, skip=skip, limit=limit, search=search)


@router.post("", response_model=StreetResponse, status_code=201)
def create_street(
    body: StreetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return street_service.create_street(db, body)


@router.get("/{street_id}", response_model=StreetResponse)
def get_street(
    street_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return street_service.get_street(db, street_id)


@router.put("/{street_id}", response_model=StreetResponse)
def update_street(
    street_id: uuid.UUID,
    body: StreetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return street_service.update_street(db, street_id, body)


@router.delete("/{street_id}", response_model=StreetResponse)
def deactivate_street(
    street_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return street_service.deactivate_street(db, street_id)


@router.get("/{street_id}/clients", response_model=list[ClientInStreetResponse])
def get_street_clients(
    street_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return street_service.get_street_clients(db, street_id)


@router.patch("/{street_id}/clients/reorder", response_model=list[ClientInStreetResponse])
def reorder_street_clients(
    street_id: uuid.UUID,
    body: ReorderRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return street_service.reorder_street_clients(db, street_id, body.items)
