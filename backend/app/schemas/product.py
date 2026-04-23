from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class ProductCreate(BaseModel):
    name: str
    category: str
    unit_measure: str
    price: Decimal
    current_stock: Optional[int] = 0
    min_stock: Optional[int] = 0

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("price deve ser maior que zero")
        return v

    @field_validator("current_stock", "min_stock", mode="before")
    @classmethod
    def stock_non_negative(cls, v: Optional[int]) -> int:
        v = v or 0
        if v < 0:
            raise ValueError("estoque não pode ser negativo")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit_measure: Optional[str] = None
    price: Optional[Decimal] = None
    current_stock: Optional[int] = None
    min_stock: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("price", mode="before")
    @classmethod
    def price_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("price deve ser maior que zero")
        return v

    @field_validator("current_stock", "min_stock", mode="before")
    @classmethod
    def stock_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("estoque não pode ser negativo")
        return v


class ProductResponse(BaseModel):
    id: str
    name: str
    category: str
    unit_measure: str
    price: float
    current_stock: int
    min_stock: int
    stock_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
