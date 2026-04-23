from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.installment import InstallmentInput, InstallmentResponse


class SaleItemInput(BaseModel):
    product_id: str
    quantity: Decimal
    unit_price: Decimal

    @field_validator("quantity", "unit_price")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("deve ser maior que zero")
        return v


class SaleItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    unit_measure: str
    quantity: float
    unit_price: float
    subtotal: float


class SaleCreate(BaseModel):
    client_id: str
    route_street_id: Optional[str] = None
    sale_date: Optional[date] = None
    amount: Optional[Decimal] = None  # ignorado; backend recomputa via items
    description: Optional[str] = None
    sale_type: str  # 'ROTA' ou 'LOJA'
    payment_mode: str  # 'A_VISTA' ou 'FIADO'
    installments: Optional[list[InstallmentInput]] = None
    items: list[SaleItemInput] = []
    discount: Optional[Decimal] = Decimal("0")

    @field_validator("sale_date")
    @classmethod
    def sale_date_not_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("Data da venda não pode ser uma data futura")
        return v

    @field_validator("discount", mode="before")
    @classmethod
    def discount_non_negative(cls, v: Optional[Decimal]) -> Decimal:
        v = v or Decimal("0")
        if v < 0:
            raise ValueError("desconto não pode ser negativo")
        return v


class SaleUpdate(BaseModel):
    description: Optional[str] = None
    payment_mode: Optional[str] = None
    discount: Optional[Decimal] = None
    items: Optional[list[SaleItemInput]] = None
    installments: Optional[list[InstallmentInput]] = None

    @field_validator("discount", mode="before")
    @classmethod
    def discount_non_negative(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("desconto não pode ser negativo")
        return v


class SaleResponse(BaseModel):
    id: str
    client_id: str
    client_name: str
    seller_id: str
    seller_name: str
    route_street_id: Optional[str] = None
    sale_date: date
    amount: float
    discount: float
    subtotal: float
    description: Optional[str] = None
    sale_type: str
    payment_mode: str
    created_at: datetime
    installments: list[InstallmentResponse] = []
    items: list[SaleItemResponse] = []
