import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_gerente
from app.models.user import User
from app.schemas.route import RouteCreate, RouteResponse, RouteUpdate
from app.services import route_service

router = APIRouter(prefix="/routes", tags=["Rotas"])


@router.get("", response_model=list[RouteResponse])
def list_routes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    route_date: Optional[str] = Query(None),
    route_status: Optional[str] = Query(None, alias="status"),
    archived: bool = Query(False, description="Se True, retorna APENAS rotas arquivadas. Se False, retorna ativas."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.list_routes(
        db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        route_date=route_date,
        route_status=route_status,
        include_archived=archived,
    )


@router.post("", response_model=RouteResponse, status_code=201)
def create_route(
    body: RouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.create_route(db, body, seller_id=current_user.id)


@router.get("/{route_id}", response_model=RouteResponse)
def get_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.get_route(db, route_id, current_user)


@router.put("/{route_id}", response_model=RouteResponse)
def update_route(
    route_id: uuid.UUID,
    body: RouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.update_route(db, route_id, body, current_user)


@router.delete("/{route_id}", status_code=204)
def delete_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    route_service.delete_route(db, route_id)


@router.post("/{route_id}/start", response_model=RouteResponse)
def start_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.start_route(db, route_id, current_user)


@router.post("/{route_id}/complete", response_model=RouteResponse)
def complete_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.complete_route(db, route_id, current_user)

@router.post("/{route_id}/archive", response_model=RouteResponse)
def archive_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.archive_route(db, route_id, current_user)


@router.post("/{route_id}/unarchive", response_model=RouteResponse)
def unarchive_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return route_service.unarchive_route(db, route_id, current_user)
