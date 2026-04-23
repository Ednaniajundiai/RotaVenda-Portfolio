import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.client_street import ClientStreet
from app.models.payment import Payment
from app.models.route import Route, RouteStatus
from app.models.route_street import RouteStreet, RouteStreetStatus
from app.models.route_template import RouteTemplateStreet
from app.models.sale import PaymentMode, Sale
from app.models.street import Street
from app.models.user import User, UserRole
from app.schemas.route import (
    RouteCreate,
    RouteStreetCreate,
    RouteStreetReorderRequest,
    RouteUpdate,
)


# ─── helpers ────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _rs_to_dict(rs: RouteStreet) -> dict:
    street = rs.street
    return {
        "id": str(rs.id),
        "street_id": str(rs.street_id),
        "street_name": street.name if street else "",
        "street_neighborhood": street.neighborhood if street else None,
        "visit_order": rs.visit_order,
        "status": rs.status.value,
        "started_at": rs.started_at,
        "completed_at": rs.completed_at,
    }


def _route_to_dict(route: Route) -> dict:
    return {
        "id": str(route.id),
        "name": route.name,
        "seller_id": str(route.seller_id),
        "seller_name": route.seller.name if route.seller else "",
        "route_date": route.route_date,
        "status": route.status.value,
        "started_at": route.started_at,
        "completed_at": route.completed_at,
        "notes": route.notes,
        "is_active": route.is_active,
        "created_at": route.created_at,
        "updated_at": route.updated_at,
        "route_streets": [_rs_to_dict(rs) for rs in (route.route_streets or [])],
    }


def _load_route(db: Session, route_id: uuid.UUID) -> Route:
    route = (
        db.query(Route)
        .options(
            joinedload(Route.route_streets).joinedload(RouteStreet.street),
            joinedload(Route.seller),
        )
        .filter(Route.id == route_id)
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rota não encontrada"
        )
    return route


def _load_rs(db: Session, route_id: uuid.UUID, rs_id: uuid.UUID) -> RouteStreet:
    rs = (
        db.query(RouteStreet)
        .options(joinedload(RouteStreet.street))
        .filter(RouteStreet.id == rs_id, RouteStreet.route_id == route_id)
        .first()
    )
    if not rs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rua da rota não encontrada",
        )
    return rs


# ─── rotas ──────────────────────────────────────────────────────────────────


def list_routes(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 50,
    route_date: Optional[str] = None,
    route_status: Optional[str] = None,
    include_archived: bool = False,
) -> list[dict]:
    query = db.query(Route).options(
        joinedload(Route.route_streets).joinedload(RouteStreet.street),
        joinedload(Route.seller),
    )

    if include_archived:
        query = query.filter(Route.is_active == False)
    else:
        query = query.filter(Route.is_active == True)

    if current_user.role == UserRole.VENDEDOR:
        query = query.filter(Route.seller_id == current_user.id)

    if route_date:
        query = query.filter(Route.route_date == route_date)
    if route_status:
        try:
            query = query.filter(Route.status == RouteStatus(route_status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Status inválido")

    routes = query.order_by(Route.route_date.desc()).offset(skip).limit(limit).all()
    return [_route_to_dict(r) for r in routes]


def get_route(db: Session, route_id: uuid.UUID, current_user: User) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão para acessar esta rota")
    return _route_to_dict(route)


def create_route(
    db: Session, data: RouteCreate, seller_id: uuid.UUID
) -> dict:
    route = Route(
        seller_id=seller_id,
        name=data.name.strip(),
        route_date=data.route_date,
        notes=data.notes,
    )
    db.add(route)
    try:
        db.flush()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Já existe uma rota para este vendedor nesta data",
        )

    if data.template_id:
        template_streets = (
            db.query(RouteTemplateStreet)
            .filter(RouteTemplateStreet.template_id == data.template_id)
            .order_by(RouteTemplateStreet.visit_order)
            .all()
        )
        for ts in template_streets:
            db.add(
                RouteStreet(
                    route_id=route.id,
                    street_id=ts.street_id,
                    visit_order=ts.visit_order,
                )
            )

    db.commit()
    return get_route_by_id(db, route.id)


def get_route_by_id(db: Session, route_id: uuid.UUID) -> dict:
    return _route_to_dict(_load_route(db, route_id))


def update_route(
    db: Session, route_id: uuid.UUID, data: RouteUpdate, current_user: User
) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    db.commit()
    return _route_to_dict(_load_route(db, route_id))


def archive_route(db: Session, route_id: uuid.UUID, current_user: User) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão")
    route.is_active = False
    db.commit()
    return _route_to_dict(_load_route(db, route_id))


def unarchive_route(db: Session, route_id: uuid.UUID, current_user: User) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão")
    route.is_active = True
    db.commit()
    return _route_to_dict(_load_route(db, route_id))


def delete_route(db: Session, route_id: uuid.UUID) -> None:
    route = _load_route(db, route_id)
    db.delete(route)
    db.commit()


def start_route(db: Session, route_id: uuid.UUID, current_user: User) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão")
    if route.status != RouteStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Rota precisa estar com status DRAFT para ser iniciada",
        )
    route.status = RouteStatus.IN_PROGRESS
    route.started_at = _now()
    db.commit()
    return _route_to_dict(_load_route(db, route_id))


def complete_route(db: Session, route_id: uuid.UUID, current_user: User) -> dict:
    route = _load_route(db, route_id)
    if (
        current_user.role == UserRole.VENDEDOR
        and route.seller_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sem permissão")
    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Rota precisa estar em andamento para ser concluída",
        )
    route.status = RouteStatus.COMPLETED
    route.completed_at = _now()
    db.commit()
    return _route_to_dict(_load_route(db, route_id))


# ─── ruas da rota ───────────────────────────────────────────────────────────


def list_route_streets(db: Session, route_id: uuid.UUID) -> list[dict]:
    _load_route(db, route_id)
    route_streets = (
        db.query(RouteStreet)
        .options(joinedload(RouteStreet.street))
        .filter(RouteStreet.route_id == route_id)
        .order_by(RouteStreet.visit_order)
        .all()
    )
    return [_rs_to_dict(rs) for rs in route_streets]


def add_street_to_route(
    db: Session, route_id: uuid.UUID, data: RouteStreetCreate
) -> dict:
    route = _load_route(db, route_id)
    if route.status == RouteStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Não é possível adicionar rua a uma rota concluída",
        )

    street = (
        db.query(Street)
        .filter(Street.id == data.street_id, Street.is_active == True)  # noqa: E712
        .first()
    )
    if not street:
        raise HTTPException(status_code=404, detail="Rua não encontrada")

    existing = (
        db.query(RouteStreet)
        .filter(
            RouteStreet.route_id == route_id,
            RouteStreet.street_id == data.street_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Rua já está na rota")

    if data.visit_order is None:
        max_order = (
            db.query(func.max(RouteStreet.visit_order))
            .filter(RouteStreet.route_id == route_id)
            .scalar()
        ) or 0
        visit_order = max_order + 1
    else:
        visit_order = data.visit_order

    rs = RouteStreet(
        route_id=route_id,
        street_id=data.street_id,
        visit_order=visit_order,
    )
    db.add(rs)
    db.commit()

    rs = (
        db.query(RouteStreet)
        .options(joinedload(RouteStreet.street))
        .filter(RouteStreet.id == rs.id)
        .first()
    )
    return _rs_to_dict(rs)


def remove_street_from_route(
    db: Session, route_id: uuid.UUID, rs_id: uuid.UUID
) -> None:
    rs = _load_rs(db, route_id, rs_id)
    db.delete(rs)
    db.commit()


def reorder_route_streets(
    db: Session, route_id: uuid.UUID, data: RouteStreetReorderRequest
) -> list[dict]:
    _load_route(db, route_id)
    for item in data.items:
        rs = (
            db.query(RouteStreet)
            .filter(
                RouteStreet.id == item.id, RouteStreet.route_id == route_id
            )
            .first()
        )
        if not rs:
            raise HTTPException(
                status_code=404, detail=f"Rua {item.id} não encontrada na rota"
            )
        rs.visit_order = item.visit_order
    db.commit()
    return list_route_streets(db, route_id)


def get_route_street_detail(
    db: Session, route_id: uuid.UUID, rs_id: uuid.UUID
) -> dict:
    rs = (
        db.query(RouteStreet)
        .options(joinedload(RouteStreet.street))
        .filter(RouteStreet.id == rs_id, RouteStreet.route_id == route_id)
        .first()
    )
    if not rs:
        raise HTTPException(
            status_code=404, detail="Rua da rota não encontrada"
        )

    client_streets = (
        db.query(ClientStreet)
        .options(joinedload(ClientStreet.client))
        .join(Client, ClientStreet.client_id == Client.id)
        .filter(
            ClientStreet.street_id == rs.street_id,
            Client.is_active == True,  # noqa: E712
        )
        .order_by(ClientStreet.display_order, Client.name)
        .all()
    )

    clients_data = []
    for cs in client_streets:
        total_fiado = (
            db.query(func.coalesce(func.sum(Sale.amount), 0))
            .filter(
                Sale.client_id == cs.client_id,
                Sale.payment_mode == PaymentMode.FIADO,
                Sale.is_active == True,  # noqa: E712
            )
            .scalar()
        )
        total_paid = (
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                Payment.client_id == cs.client_id,
                Payment.is_active == True,  # noqa: E712
            )
            .scalar()
        )
        balance = float(total_fiado - total_paid)

        clients_data.append(
            {
                "client_street_id": str(cs.id),
                "client_id": str(cs.client_id),
                "name": cs.client.name,
                "phone": cs.client.phone,
                "house_number": cs.house_number,
                "reference": cs.reference,
                "display_order": cs.display_order,
                "balance": balance,
            }
        )

    street = rs.street
    return {
        "id": str(rs.id),
        "route_id": str(rs.route_id),
        "street_id": str(rs.street_id),
        "street_name": street.name if street else "",
        "street_neighborhood": street.neighborhood if street else None,
        "visit_order": rs.visit_order,
        "status": rs.status.value,
        "started_at": rs.started_at,
        "completed_at": rs.completed_at,
        "clients": clients_data,
    }


def start_route_street(
    db: Session, route_id: uuid.UUID, rs_id: uuid.UUID
) -> dict:
    rs = _load_rs(db, route_id, rs_id)
    if rs.status != RouteStreetStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Rua precisa estar pendente para ser iniciada",
        )
    rs.status = RouteStreetStatus.IN_PROGRESS
    rs.started_at = _now()
    db.commit()
    return _rs_to_dict(_load_rs(db, route_id, rs_id))


def complete_route_street(
    db: Session, route_id: uuid.UUID, rs_id: uuid.UUID
) -> dict:
    rs = _load_rs(db, route_id, rs_id)
    if rs.status != RouteStreetStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Rua precisa estar em andamento para ser concluída",
        )
    rs.status = RouteStreetStatus.COMPLETED
    rs.completed_at = _now()
    db.commit()
    return _rs_to_dict(_load_rs(db, route_id, rs_id))


def skip_route_street(
    db: Session, route_id: uuid.UUID, rs_id: uuid.UUID
) -> dict:
    rs = _load_rs(db, route_id, rs_id)
    if rs.status == RouteStreetStatus.COMPLETED:
        raise HTTPException(
            status_code=400, detail="Rua já foi concluída"
        )
    rs.status = RouteStreetStatus.SKIPPED
    rs.completed_at = _now()
    db.commit()
    return _rs_to_dict(_load_rs(db, route_id, rs_id))
