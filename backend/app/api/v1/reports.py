from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_gerente
from app.models.user import User
from app.schemas.report import (
    PaymentsReportResponse,
    SalesReportResponse,
    SummaryResponse,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["Relatórios"])


@router.get("/vendas", response_model=SalesReportResponse)
def sales_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    seller_id: Optional[str] = Query(None),
    sale_type: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return report_service.get_sales_report(
        db,
        date_from=date_from,
        date_to=date_to,
        seller_id=seller_id,
        sale_type=sale_type,
        payment_mode=payment_mode,
    )


@router.get("/pagamentos", response_model=PaymentsReportResponse)
def payments_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    seller_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return report_service.get_payments_report(
        db,
        date_from=date_from,
        date_to=date_to,
        seller_id=seller_id,
    )


@router.get("/resumo", response_model=SummaryResponse)
def summary_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return report_service.get_summary(db, date_from=date_from, date_to=date_to)
