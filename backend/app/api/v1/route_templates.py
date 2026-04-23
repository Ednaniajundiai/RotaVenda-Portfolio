import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_gerente, get_current_user
from app.models.user import User
from app.schemas.route_template import (
    RouteTemplateCreate,
    RouteTemplateResponse,
    RouteTemplateStreetAdd,
    RouteTemplateStreetReorderRequest,
    RouteTemplateUpdate,
)
from app.services import route_template_service

router = APIRouter(prefix="/route-templates", tags=["Templates de Rota"])


@router.get("", response_model=list[RouteTemplateResponse])
def list_templates(
    only_active: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_template_service.list_templates(db, only_active=only_active)


@router.post("", response_model=RouteTemplateResponse, status_code=201)
def create_template(
    data: RouteTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return route_template_service.create_template(db, data)


@router.get("/{template_id}", response_model=RouteTemplateResponse)
def get_template(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return route_template_service.get_template(db, template_id)


@router.patch("/{template_id}", response_model=RouteTemplateResponse)
def update_template(
    template_id: uuid.UUID,
    data: RouteTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return route_template_service.update_template(db, template_id, data)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    route_template_service.delete_template(db, template_id)


@router.post("/{template_id}/streets", response_model=RouteTemplateResponse)
def add_street(
    template_id: uuid.UUID,
    data: RouteTemplateStreetAdd,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return route_template_service.add_street_to_template(db, template_id, data)


@router.delete("/{template_id}/streets/{rts_id}", response_model=RouteTemplateResponse)
def remove_street(
    template_id: uuid.UUID,
    rts_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return route_template_service.remove_street_from_template(db, template_id, rts_id)


@router.put("/{template_id}/streets/reorder", response_model=RouteTemplateResponse)
def reorder_streets(
    template_id: uuid.UUID,
    data: RouteTemplateStreetReorderRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return route_template_service.reorder_template_streets(db, template_id, data)
