import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.route_template import RouteTemplate, RouteTemplateStreet
from app.models.street import Street
from app.schemas.route_template import (
    RouteTemplateCreate,
    RouteTemplateStreetAdd,
    RouteTemplateStreetReorderRequest,
    RouteTemplateUpdate,
)


# ─── helpers ────────────────────────────────────────────────────────────────


def _rts_to_dict(rts: RouteTemplateStreet) -> dict:
    street = rts.street
    return {
        "id": str(rts.id),
        "street_id": str(rts.street_id),
        "street_name": street.name if street else "",
        "street_neighborhood": street.neighborhood if street else None,
        "visit_order": rts.visit_order,
    }


def _template_to_dict(template: RouteTemplate) -> dict:
    return {
        "id": str(template.id),
        "name": template.name,
        "description": template.description,
        "is_active": template.is_active,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "streets": [_rts_to_dict(s) for s in (template.streets or [])],
    }


def _load_template(db: Session, template_id: uuid.UUID) -> RouteTemplate:
    template = (
        db.query(RouteTemplate)
        .options(
            joinedload(RouteTemplate.streets).joinedload(RouteTemplateStreet.street)
        )
        .filter(RouteTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template de rota não encontrado",
        )
    return template


# ─── templates ──────────────────────────────────────────────────────────────


def list_templates(db: Session, only_active: bool = True) -> list[dict]:
    query = db.query(RouteTemplate).options(
        joinedload(RouteTemplate.streets).joinedload(RouteTemplateStreet.street)
    )
    if only_active:
        query = query.filter(RouteTemplate.is_active == True)  # noqa: E712
    templates = query.order_by(RouteTemplate.name).all()
    return [_template_to_dict(t) for t in templates]


def get_template(db: Session, template_id: uuid.UUID) -> dict:
    return _template_to_dict(_load_template(db, template_id))


def create_template(db: Session, data: RouteTemplateCreate) -> dict:
    existing = (
        db.query(RouteTemplate).filter(RouteTemplate.name == data.name).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um template com este nome",
        )
    template = RouteTemplate(name=data.name, description=data.description)
    db.add(template)
    db.commit()
    return _template_to_dict(_load_template(db, template.id))


def update_template(
    db: Session, template_id: uuid.UUID, data: RouteTemplateUpdate
) -> dict:
    template = _load_template(db, template_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    db.commit()
    return _template_to_dict(_load_template(db, template_id))


def delete_template(db: Session, template_id: uuid.UUID) -> None:
    template = _load_template(db, template_id)
    db.delete(template)
    db.commit()


# ─── ruas do template ────────────────────────────────────────────────────────


def add_street_to_template(
    db: Session, template_id: uuid.UUID, data: RouteTemplateStreetAdd
) -> dict:
    _load_template(db, template_id)

    street = (
        db.query(Street)
        .filter(Street.id == data.street_id, Street.is_active == True)  # noqa: E712
        .first()
    )
    if not street:
        raise HTTPException(status_code=404, detail="Rua não encontrada")

    existing = (
        db.query(RouteTemplateStreet)
        .filter(
            RouteTemplateStreet.template_id == template_id,
            RouteTemplateStreet.street_id == data.street_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Rua já está no template")

    if data.visit_order is None:
        max_order = (
            db.query(func.max(RouteTemplateStreet.visit_order))
            .filter(RouteTemplateStreet.template_id == template_id)
            .scalar()
        ) or 0
        visit_order = max_order + 1
    else:
        visit_order = data.visit_order

    rts = RouteTemplateStreet(
        template_id=template_id,
        street_id=data.street_id,
        visit_order=visit_order,
    )
    db.add(rts)
    db.commit()
    return get_template(db, template_id)


def remove_street_from_template(
    db: Session, template_id: uuid.UUID, rts_id: uuid.UUID
) -> dict:
    rts = (
        db.query(RouteTemplateStreet)
        .filter(
            RouteTemplateStreet.id == rts_id,
            RouteTemplateStreet.template_id == template_id,
        )
        .first()
    )
    if not rts:
        raise HTTPException(status_code=404, detail="Rua não encontrada no template")
    db.delete(rts)
    db.commit()
    return get_template(db, template_id)


def reorder_template_streets(
    db: Session, template_id: uuid.UUID, data: RouteTemplateStreetReorderRequest
) -> dict:
    _load_template(db, template_id)
    for item in data.items:
        rts = (
            db.query(RouteTemplateStreet)
            .filter(
                RouteTemplateStreet.id == item.id,
                RouteTemplateStreet.template_id == template_id,
            )
            .first()
        )
        if not rts:
            raise HTTPException(
                status_code=404, detail=f"Rua {item.id} não encontrada no template"
            )
        rts.visit_order = item.visit_order
    db.commit()
    return get_template(db, template_id)
