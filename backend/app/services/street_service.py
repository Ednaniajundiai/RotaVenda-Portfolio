import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.client_street import ClientStreet
from app.models.street import Street
from app.schemas.street import ReorderItem, StreetCreate, StreetUpdate


def list_streets(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    include_inactive: bool = False,
) -> list[Street]:
    query = db.query(Street)
    if not include_inactive:
        query = query.filter(Street.is_active == True)  # noqa: E712
    if search:
        query = query.filter(
            or_(
                Street.name.ilike(f"%{search}%"),
                Street.neighborhood.ilike(f"%{search}%"),
                Street.cep.ilike(f"%{search}%"),
            )
        )
    return query.order_by(Street.neighborhood, Street.name).offset(skip).limit(limit).all()


def get_street(db: Session, street_id: uuid.UUID) -> Street:
    street = db.query(Street).filter(Street.id == street_id).first()
    if not street:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rua não encontrada",
        )
    return street


def create_street(db: Session, data: StreetCreate) -> Street:
    street = Street(**data.model_dump())
    db.add(street)
    db.commit()
    db.refresh(street)
    return street


def update_street(db: Session, street_id: uuid.UUID, data: StreetUpdate) -> Street:
    street = get_street(db, street_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(street, field, value)
    db.commit()
    db.refresh(street)
    return street


def deactivate_street(db: Session, street_id: uuid.UUID) -> Street:
    street = get_street(db, street_id)
    street.is_active = False
    db.commit()
    db.refresh(street)
    return street


def get_street_clients(db: Session, street_id: uuid.UUID) -> list[ClientStreet]:
    get_street(db, street_id)
    return (
        db.query(ClientStreet)
        .options(joinedload(ClientStreet.client))
        .join(Client, ClientStreet.client_id == Client.id)
        .filter(
            ClientStreet.street_id == street_id,
            Client.is_active == True,  # noqa: E712
        )
        .order_by(ClientStreet.display_order, Client.name)
        .all()
    )


def reorder_street_clients(
    db: Session, street_id: uuid.UUID, items: list[ReorderItem]
) -> list[ClientStreet]:
    get_street(db, street_id)
    for item in items:
        cs = (
            db.query(ClientStreet)
            .filter(
                ClientStreet.id == item.client_street_id,
                ClientStreet.street_id == street_id,
            )
            .first()
        )
        if cs:
            cs.display_order = item.display_order
    db.commit()
    return get_street_clients(db, street_id)
