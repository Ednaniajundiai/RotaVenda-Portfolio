from datetime import date
from typing import Optional

from pydantic import BaseModel


class SaleReportItem(BaseModel):
    id: str
    sale_date: date
    client_name: str
    seller_name: str
    amount: float
    description: Optional[str] = None
    sale_type: str
    payment_mode: str


class PaymentReportItem(BaseModel):
    id: str
    payment_date: date
    client_name: str
    seller_name: str
    amount: float
    notes: Optional[str] = None


class SalesReportResponse(BaseModel):
    date_from: Optional[date]
    date_to: Optional[date]
    total_count: int
    total_amount: float
    total_a_vista: float
    total_fiado: float
    items: list[SaleReportItem]


class PaymentsReportResponse(BaseModel):
    date_from: Optional[date]
    date_to: Optional[date]
    total_count: int
    total_amount: float
    items: list[PaymentReportItem]


class SummaryResponse(BaseModel):
    date_from: Optional[date]
    date_to: Optional[date]
    total_sales: float
    total_sales_count: int
    total_a_vista: float
    total_fiado: float
    total_payments: float
    total_payments_count: int
    saldo_devedor_total: float
    top_clients: list[dict]
