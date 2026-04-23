import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_gerente
from app.models.user import User
from app.schemas.client import (
    ClientBalance,
    ClientCreate,
    ClientResponse,
    ClientStatement,
    ClientStreetCreate,
    ClientUpdate,
    StreetInClientResponse,
    StreetSummary,
)
from app.services import client_service

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("/neighborhoods", response_model=list[str])
def list_neighborhoods(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.list_client_neighborhoods(db)


@router.get("/streets", response_model=list[StreetSummary])
def list_streets_with_clients(
    neighborhood: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.list_client_streets(db, neighborhood=neighborhood)


@router.get("", response_model=list[ClientResponse])
def list_clients(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    saldo_filter: Optional[Literal["com_debito", "quitados"]] = Query(None),
    neighborhood: Optional[str] = Query(None),
    street_id: Optional[uuid.UUID] = Query(None),
    sort: Optional[Literal["nome", "saldo_desc", "saldo_asc", "recente"]] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total, total_saldo = client_service.list_clients_with_saldo(
        db,
        skip=skip,
        limit=limit,
        search=search,
        saldo_filter=saldo_filter,
        neighborhood=neighborhood,
        street_id=street_id,
        sort=sort,
        include_inactive=include_inactive,
    )
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Total-Saldo"] = str(total_saldo)
    return items


@router.post("", response_model=ClientResponse, status_code=201)
def create_client(
    body: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.create_client(db, body)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.get_client(db, client_id)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.update_client(db, client_id, body)


@router.delete("/{client_id}", response_model=ClientResponse)
def deactivate_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return client_service.deactivate_client(db, client_id)


@router.get("/{client_id}/balance", response_model=ClientBalance)
def get_client_balance(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    saldo = client_service.get_client_balance(db, client_id)
    return ClientBalance(client_id=client_id, saldo=saldo)


@router.get("/{client_id}/statement", response_model=ClientStatement)
def get_client_statement(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.get_client_statement(db, client_id)


@router.get("/{client_id}/streets", response_model=list[StreetInClientResponse])
def get_client_streets(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.get_client_streets(db, client_id)


@router.post(
    "/{client_id}/streets", response_model=StreetInClientResponse, status_code=201
)
def add_street_to_client(
    client_id: uuid.UUID,
    body: ClientStreetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return client_service.add_client_to_street(db, client_id, body)


@router.delete("/{client_id}/streets/{street_id}", status_code=204)
def remove_street_from_client(
    client_id: uuid.UUID,
    street_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    client_service.remove_client_from_street(db, client_id, street_id)
