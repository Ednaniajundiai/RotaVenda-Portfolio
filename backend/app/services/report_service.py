import uuid
from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.payment import Payment
from app.models.sale import PaymentMode, Sale, SaleType


def _date_filters_sale(
    query,
    date_from: Optional[date],
    date_to: Optional[date],
):
    if date_from:
        query = query.filter(Sale.sale_date >= date_from)
    if date_to:
        query = query.filter(Sale.sale_date <= date_to)
    return query


def _date_filters_payment(
    query,
    date_from: Optional[date],
    date_to: Optional[date],
):
    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to:
        query = query.filter(Payment.payment_date <= date_to)
    return query


def get_sales_report(
    db: Session,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    seller_id: Optional[str] = None,
    sale_type: Optional[str] = None,
    payment_mode: Optional[str] = None,
) -> dict:
    query = (
        db.query(Sale)
        .options(joinedload(Sale.client), joinedload(Sale.seller))
        .filter(Sale.is_active == True)  # noqa: E712
    )
    query = _date_filters_sale(query, date_from, date_to)
    if seller_id:
        query = query.filter(Sale.seller_id == uuid.UUID(seller_id))
    if sale_type:
        query = query.filter(Sale.sale_type == SaleType(sale_type))
    if payment_mode:
        query = query.filter(Sale.payment_mode == PaymentMode(payment_mode))

    sales = query.order_by(Sale.sale_date.desc(), Sale.created_at.desc()).all()

    total_a_vista = sum(
        float(s.amount) for s in sales if s.payment_mode == PaymentMode.A_VISTA
    )
    total_fiado = sum(
        float(s.amount) for s in sales if s.payment_mode == PaymentMode.FIADO
    )

    items = [
        {
            "id": str(s.id),
            "sale_date": s.sale_date,
            "client_name": s.client.name if s.client else "",
            "seller_name": s.seller.name if s.seller else "",
            "amount": float(s.amount),
            "description": s.description,
            "sale_type": s.sale_type.value,
            "payment_mode": s.payment_mode.value,
        }
        for s in sales
    ]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_count": len(items),
        "total_amount": total_a_vista + total_fiado,
        "total_a_vista": total_a_vista,
        "total_fiado": total_fiado,
        "items": items,
    }


def get_payments_report(
    db: Session,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    seller_id: Optional[str] = None,
) -> dict:
    query = (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.seller))
        .filter(Payment.is_active == True)  # noqa: E712
    )
    query = _date_filters_payment(query, date_from, date_to)
    if seller_id:
        query = query.filter(Payment.seller_id == uuid.UUID(seller_id))

    payments = (
        query.order_by(Payment.payment_date.desc(), Payment.created_at.desc()).all()
    )

    items = [
        {
            "id": str(p.id),
            "payment_date": p.payment_date,
            "client_name": p.client.name if p.client else "",
            "seller_name": p.seller.name if p.seller else "",
            "amount": float(p.amount),
            "notes": p.notes,
        }
        for p in payments
    ]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_count": len(items),
        "total_amount": sum(i["amount"] for i in items),
        "items": items,
    }


def get_summary(
    db: Session,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    # Totais de vendas no período com filtros de data direto na query agregada
    def _sale_sum(payment_mode: PaymentMode) -> float:
        q = db.query(func.coalesce(func.sum(Sale.amount), 0)).filter(
            Sale.is_active == True,  # noqa: E712
            Sale.payment_mode == payment_mode,
        )
        if date_from:
            q = q.filter(Sale.sale_date >= date_from)
        if date_to:
            q = q.filter(Sale.sale_date <= date_to)
        return float(q.scalar())

    def _payment_sum() -> float:
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.is_active == True  # noqa: E712
        )
        if date_from:
            q = q.filter(Payment.payment_date >= date_from)
        if date_to:
            q = q.filter(Payment.payment_date <= date_to)
        return float(q.scalar())

    def _sale_count() -> int:
        q = db.query(func.count(Sale.id)).filter(Sale.is_active == True)  # noqa: E712
        if date_from:
            q = q.filter(Sale.sale_date >= date_from)
        if date_to:
            q = q.filter(Sale.sale_date <= date_to)
        return int(q.scalar())

    def _payment_count() -> int:
        q = db.query(func.count(Payment.id)).filter(
            Payment.is_active == True  # noqa: E712
        )
        if date_from:
            q = q.filter(Payment.payment_date >= date_from)
        if date_to:
            q = q.filter(Payment.payment_date <= date_to)
        return int(q.scalar())

    total_a_vista = _sale_sum(PaymentMode.A_VISTA)
    total_fiado = _sale_sum(PaymentMode.FIADO)
    total_payments = _payment_sum()
    total_sales_count = _sale_count()
    total_payments_count = _payment_count()

    # Saldo devedor total (todos os tempos, independente do período)
    all_fiado = float(
        db.query(func.coalesce(func.sum(Sale.amount), 0))
        .filter(Sale.is_active == True, Sale.payment_mode == PaymentMode.FIADO)  # noqa: E712
        .scalar()
    )
    all_payments = float(
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.is_active == True)  # noqa: E712
        .scalar()
    )

    # Top 5 clientes com maior fiado no período
    fiado_agg = func.coalesce(func.sum(Sale.amount), 0)
    top_q = (
        db.query(Client.name, fiado_agg.label("total_fiado"))
        .join(Sale, Sale.client_id == Client.id)
        .filter(
            Sale.is_active == True,  # noqa: E712
            Sale.payment_mode == PaymentMode.FIADO,
        )
    )
    if date_from:
        top_q = top_q.filter(Sale.sale_date >= date_from)
    if date_to:
        top_q = top_q.filter(Sale.sale_date <= date_to)

    top_rows = (
        top_q.group_by(Client.name).order_by(fiado_agg.desc()).limit(5).all()
    )
    top_clients = [
        {"client_name": row[0], "total_fiado": float(row[1])}
        for row in top_rows
    ]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_sales": total_a_vista + total_fiado,
        "total_sales_count": total_sales_count,
        "total_a_vista": total_a_vista,
        "total_fiado": total_fiado,
        "total_payments": total_payments,
        "total_payments_count": total_payments_count,
        "saldo_devedor_total": all_fiado - all_payments,
        "top_clients": top_clients,
    }
