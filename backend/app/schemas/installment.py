from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class InstallmentInput(BaseModel):
    number: int
    due_date: date
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount deve ser maior que zero")
        return v


class InstallmentApplicationInput(BaseModel):
    installment_id: str
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount deve ser maior que zero")
        return v


class InstallmentResponse(BaseModel):
    id: str
    sale_id: str
    number: int
    due_date: date
    amount: float
    paid_amount: float
    remaining: float
    status: str  # PENDING | PARTIAL | PAID | OVERDUE
    paid_at: Optional[date] = None
    created_at: datetime
