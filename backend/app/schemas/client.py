import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    opening_balance: Decimal = Decimal("0")


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    opening_balance: Optional[Decimal] = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    opening_balance: float = 0.0
    saldo: float = 0.0
    primary_neighborhood: Optional[str] = None
    primary_street: Optional[str] = None

    model_config = {"from_attributes": True}


class ClientBalance(BaseModel):
    client_id: uuid.UUID
    saldo: float


class ClientStreetCreate(BaseModel):
    street_id: uuid.UUID
    house_number: Optional[str] = None
    reference: Optional[str] = None
    display_order: int = 0


class StreetSummary(BaseModel):
    id: uuid.UUID
    name: str
    neighborhood: Optional[str] = None
    cep: Optional[str] = None

    model_config = {"from_attributes": True}


class StreetInClientResponse(BaseModel):
    id: uuid.UUID
    street_id: uuid.UUID
    house_number: Optional[str] = None
    reference: Optional[str] = None
    display_order: int
    street: StreetSummary

    model_config = {"from_attributes": True}


class StatementEntry(BaseModel):
    id: str
    type: str  # "sale" ou "payment"
    date: date
    amount: float
    description: Optional[str] = None
    payment_mode: Optional[str] = None
    created_at: datetime
    installments_count: Optional[int] = None
    installments_pending: Optional[int] = None


class ClientStatement(BaseModel):
    client_id: str
    client_name: str
    saldo: float
    entries: list[StatementEntry] = []
