import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.route import (
    RouteStreetCreate,
    RouteStreetDetail,
    RouteStreetReorderRequest,
    RouteStreetSummary,
)
from app.services import route_service

router = APIRouter(prefix="/routes", tags=["Ruas da Rota"])


@router.get("/{route_id}/streets", response_model=list[RouteStreetSummary])
def list_route_streets(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.list_route_streets(db, route_id)


@router.post(
    "/{route_id}/streets", response_model=RouteStreetSummary, status_code=201
)
def add_street_to_route(
    route_id: uuid.UUID,
    body: RouteStreetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.add_street_to_route(db, route_id, body)


@router.patch(
    "/{route_id}/streets/reorder", response_model=list[RouteStreetSummary]
)
def reorder_route_streets(
    route_id: uuid.UUID,
    body: RouteStreetReorderRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.reorder_route_streets(db, route_id, body)


@router.get("/{route_id}/streets/{rs_id}", response_model=RouteStreetDetail)
def get_route_street_detail(
    route_id: uuid.UUID,
    rs_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.get_route_street_detail(db, route_id, rs_id)


@router.delete(
    "/{route_id}/streets/{rs_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_street_from_route(
    route_id: uuid.UUID,
    rs_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    route_service.remove_street_from_route(db, route_id, rs_id)


@router.post(
    "/{route_id}/streets/{rs_id}/start", response_model=RouteStreetSummary
)
def start_route_street(
    route_id: uuid.UUID,
    rs_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.start_route_street(db, route_id, rs_id)


@router.post(
    "/{route_id}/streets/{rs_id}/complete", response_model=RouteStreetSummary
)
def complete_route_street(
    route_id: uuid.UUID,
    rs_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.complete_route_street(db, route_id, rs_id)


@router.post(
    "/{route_id}/streets/{rs_id}/skip", response_model=RouteStreetSummary
)
def skip_route_street(
    route_id: uuid.UUID,
    rs_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_service.skip_route_street(db, route_id, rs_id)
