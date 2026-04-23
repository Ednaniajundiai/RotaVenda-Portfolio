from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.installment import InstallmentApplicationInput


class PaymentCreate(BaseModel):
    client_id: str
    route_street_id: Optional[str] = None
    payment_date: Optional[date] = None
    amount: Decimal
    notes: Optional[str] = None
    installment_applications: Optional[list[InstallmentApplicationInput]] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount deve ser maior que zero")
        return v


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def amount_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("amount deve ser maior que zero")
        return v


class PaymentResponse(BaseModel):
    id: str
    client_id: str
    client_name: str
    seller_id: str
    seller_name: str
    route_street_id: Optional[str] = None
    payment_date: date
    amount: float
    notes: Optional[str] = None
    created_at: datetime
