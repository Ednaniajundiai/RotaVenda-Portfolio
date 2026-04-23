import uuid
from typing import Literal, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.client import Client
from app.models.client_street import ClientStreet
from app.models.street import Street
from app.schemas.client import ClientCreate, ClientStreetCreate, ClientUpdate


def list_clients(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    include_inactive: bool = False,
) -> list[Client]:
    query = db.query(Client)
    if not include_inactive:
        query = query.filter(Client.is_active == True)  # noqa: E712
    if search:
        query = query.filter(
            or_(
                Client.name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
            )
        )
    return query.order_by(Client.name).offset(skip).limit(limit).all()


def list_client_streets(
    db: Session, neighborhood: Optional[str] = None
) -> list[Street]:
    """Retorna ruas que possuem ao menos um cliente ativo vinculado."""
    query = (
        db.query(Street)
        .join(ClientStreet, ClientStreet.street_id == Street.id)
        .join(Client, Client.id == ClientStreet.client_id)
        .filter(
            Client.is_active == True,  # noqa: E712
            Street.is_active == True,  # noqa: E712
        )
        .distinct()
    )
    if neighborhood:
        query = query.filter(Street.neighborhood == neighborhood)
    return query.order_by(Street.name).all()


def list_client_neighborhoods(db: Session) -> list[str]:
    """Retorna lista de bairros distintos de clientes ativos."""
    rows = (
        db.query(Street.neighborhood)
        .join(ClientStreet, ClientStreet.street_id == Street.id)
        .join(Client, Client.id == ClientStreet.client_id)
        .filter(
            Client.is_active == True,  # noqa: E712
            Street.is_active == True,  # noqa: E712
            Street.neighborhood.isnot(None),
            Street.neighborhood != "",
        )
        .distinct()
        .order_by(Street.neighborhood)
        .all()
    )
    return [r.neighborhood for r in rows]


def list_clients_with_saldo(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    include_inactive: bool = False,
    saldo_filter: Optional[Literal["com_debito", "quitados"]] = None,
    neighborhood: Optional[str] = None,
    street_id: Optional[uuid.UUID] = None,
    sort: Optional[Literal["nome", "saldo_desc", "saldo_asc", "recente"]] = None,
) -> tuple[list[dict], int, float]:
    """Retorna clientes com saldo e bairro principal usando batch queries (sem N+1).

    Returns:
        Tupla de (lista de clientes, total de registros filtrados, soma total dos saldos filtrados).
    """
    from app.models.sale import PaymentMode, Sale
    from app.models.sale_installment import SaleInstallment

    saldo_subq = (
        db.query(
            Sale.client_id.label("client_id"),
            func.coalesce(
                func.sum(SaleInstallment.amount - SaleInstallment.paid_amount), 0
            ).label("saldo"),
        )
        .join(SaleInstallment, SaleInstallment.sale_id == Sale.id)
        .filter(
            Sale.payment_mode == PaymentMode.FIADO,
            Sale.is_active == True,  # noqa: E712
        )
        .group_by(Sale.client_id)
        .subquery()
    )

    query = db.query(Client).outerjoin(
        saldo_subq, Client.id == saldo_subq.c.client_id
    )

    if not include_inactive:
        query = query.filter(Client.is_active == True)  # noqa: E712
    if search:
        query = query.filter(
            or_(
                Client.name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
            )
        )
    if saldo_filter == "com_debito":
        query = query.filter(
            (func.coalesce(saldo_subq.c.saldo, 0) + Client.opening_balance) > 0
        )
    elif saldo_filter == "quitados":
        query = query.filter(
            (func.coalesce(saldo_subq.c.saldo, 0) + Client.opening_balance) <= 0
        )

    if neighborhood:
        neighborhood_subq = (
            db.query(ClientStreet.client_id)
            .join(Street, Street.id == ClientStreet.street_id)
            .filter(
                Street.neighborhood == neighborhood,
                Street.is_active == True,  # noqa: E712
            )
            .statement
        )
        query = query.filter(Client.id.in_(neighborhood_subq))

    if street_id:
        street_subq = (
            db.query(ClientStreet.client_id)
            .filter(ClientStreet.street_id == street_id)
            .statement
        )
        query = query.filter(Client.id.in_(street_subq))

    total = query.count()

    filtered_ids_select = query.with_entities(Client.id).statement
    total_installments_saldo = (
        db.query(
            func.coalesce(
                func.sum(SaleInstallment.amount - SaleInstallment.paid_amount), 0
            )
        )
        .join(Sale, Sale.id == SaleInstallment.sale_id)
        .filter(
            Sale.client_id.in_(filtered_ids_select),
            Sale.payment_mode == PaymentMode.FIADO,
            Sale.is_active == True,  # noqa: E712
        )
        .scalar()
    )
    total_opening_balance = (
        db.query(func.coalesce(func.sum(Client.opening_balance), 0))
        .filter(Client.id.in_(filtered_ids_select))
        .scalar()
    )
    total_saldo = float(total_installments_saldo or 0) + float(
        total_opening_balance or 0
    )

    if sort == "saldo_desc":
        order = (func.coalesce(saldo_subq.c.saldo, 0) + Client.opening_balance).desc()
    elif sort == "saldo_asc":
        order = (func.coalesce(saldo_subq.c.saldo, 0) + Client.opening_balance).asc()
    elif sort == "recente":
        order = Client.created_at.desc()
    else:
        order = Client.name

    clients = query.order_by(order).offset(skip).limit(limit).all()

    if not clients:
        return [], total, total_saldo

    client_ids = [c.id for c in clients]

    saldo_rows = (
        db.query(
            Sale.client_id,
            func.coalesce(
                func.sum(SaleInstallment.amount - SaleInstallment.paid_amount), 0
            ).label("saldo"),
        )
        .join(SaleInstallment, SaleInstallment.sale_id == Sale.id)
        .filter(
            Sale.client_id.in_(client_ids),
            Sale.payment_mode == PaymentMode.FIADO,
            Sale.is_active == True,  # noqa: E712
        )
        .group_by(Sale.client_id)
        .all()
    )
    saldo_map = {str(r.client_id): float(r.saldo) for r in saldo_rows}

    location_rows = (
        db.query(ClientStreet.client_id, Street.neighborhood, Street.name)
        .join(Street, Street.id == ClientStreet.street_id)
        .filter(
            ClientStreet.client_id.in_(client_ids),
            Street.is_active == True,  # noqa: E712
        )
        .distinct(ClientStreet.client_id)
        .order_by(ClientStreet.client_id, ClientStreet.display_order)
        .all()
    )
    neighborhood_map = {str(r.client_id): r.neighborhood for r in location_rows}
    street_map = {str(r.client_id): r.name for r in location_rows}

    result = [
        {
            **{
                col.name: getattr(c, col.name)
                for col in Client.__table__.columns
            },
            "saldo": saldo_map.get(str(c.id), 0.0) + float(c.opening_balance),
            "primary_neighborhood": neighborhood_map.get(str(c.id)),
            "primary_street": street_map.get(str(c.id)),
        }
        for c in clients
    ]
    return result, total, total_saldo


def get_client(db: Session, client_id: uuid.UUID) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado",
        )
    return client


def create_client(db: Session, data: ClientCreate) -> Client:
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client_id: uuid.UUID, data: ClientUpdate) -> Client:
    client = get_client(db, client_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


def deactivate_client(db: Session, client_id: uuid.UUID) -> Client:
    client = get_client(db, client_id)
    client.is_active = False
    db.commit()
    db.refresh(client)
    return client


def get_client_balance(db: Session, client_id: uuid.UUID) -> float:
    client = get_client(db, client_id)
    from sqlalchemy import func

    from app.models.sale import PaymentMode, Sale
    from app.models.sale_installment import SaleInstallment

    installments_saldo = (
        db.query(
            func.coalesce(
                func.sum(SaleInstallment.amount - SaleInstallment.paid_amount), 0
            )
        )
        .join(Sale, Sale.id == SaleInstallment.sale_id)
        .filter(
            Sale.client_id == client_id,
            Sale.payment_mode == PaymentMode.FIADO,
            Sale.is_active == True,  # noqa: E712
        )
        .scalar()
    )
    return float(client.opening_balance) + float(installments_saldo)


def get_client_statement(db: Session, client_id: uuid.UUID) -> dict:
    from sqlalchemy.orm import selectinload

    from app.models.payment import Payment
    from app.models.sale import Sale

    client = get_client(db, client_id)

    sales = (
        db.query(Sale)
        .options(selectinload(Sale.installments))
        .filter(Sale.client_id == client_id, Sale.is_active == True)  # noqa: E712
        .order_by(Sale.sale_date.desc(), Sale.created_at.desc())
        .all()
    )
    payments = (
        db.query(Payment)
        .filter(Payment.client_id == client_id, Payment.is_active == True)  # noqa: E712
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .all()
    )

    from datetime import date as date_type

    today = date_type.today()
    entries = []
    for s in sales:
        installments_count = len(s.installments)
        installments_pending = sum(
            1
            for i in s.installments
            if float(i.paid_amount) < float(i.amount)
        )
        entries.append(
            {
                "id": str(s.id),
                "type": "sale",
                "date": s.sale_date,
                "amount": float(s.amount),
                "description": s.description,
                "payment_mode": s.payment_mode.value,
                "created_at": s.created_at,
                "installments_count": installments_count if installments_count > 0 else None,
                "installments_pending": installments_pending if installments_count > 0 else None,
            }
        )
    for p in payments:
        entries.append(
            {
                "id": str(p.id),
                "type": "payment",
                "date": p.payment_date,
                "amount": float(p.amount),
                "description": p.notes,
                "payment_mode": None,
                "created_at": p.created_at,
                "installments_count": None,
                "installments_pending": None,
            }
        )

    entries.sort(key=lambda x: (x["date"], x["created_at"]), reverse=True)

    return {
        "client_id": str(client_id),
        "client_name": client.name,
        "saldo": get_client_balance(db, client_id),
        "entries": entries,
    }


def get_client_streets(db: Session, client_id: uuid.UUID) -> list[ClientStreet]:
    get_client(db, client_id)
    return (
        db.query(ClientStreet)
        .options(joinedload(ClientStreet.street))
        .join(Street, ClientStreet.street_id == Street.id)
        .filter(
            ClientStreet.client_id == client_id,
            Street.is_active == True,  # noqa: E712
        )
        .order_by(ClientStreet.display_order, Street.name)
        .all()
    )


def add_client_to_street(
    db: Session, client_id: uuid.UUID, data: ClientStreetCreate
) -> ClientStreet:
    get_client(db, client_id)

    street = (
        db.query(Street)
        .filter(Street.id == data.street_id, Street.is_active == True)  # noqa: E712
        .first()
    )
    if not street:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rua não encontrada",
        )

    existing = (
        db.query(ClientStreet)
        .filter(
            ClientStreet.client_id == client_id,
            ClientStreet.street_id == data.street_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cliente já está vinculado a essa rua",
        )

    cs = ClientStreet(client_id=client_id, **data.model_dump())
    db.add(cs)
    db.commit()

    return (
        db.query(ClientStreet)
        .options(joinedload(ClientStreet.street))
        .filter(ClientStreet.id == cs.id)
        .first()
    )


def remove_client_from_street(
    db: Session, client_id: uuid.UUID, street_id: uuid.UUID
) -> None:
    get_client(db, client_id)
    cs = (
        db.query(ClientStreet)
        .filter(
            ClientStreet.client_id == client_id,
            ClientStreet.street_id == street_id,
        )
        .first()
    )
    if not cs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vínculo cliente-rua não encontrado",
        )
    db.delete(cs)
    db.commit()
