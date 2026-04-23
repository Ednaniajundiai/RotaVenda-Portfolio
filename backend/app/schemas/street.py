import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StreetCreate(BaseModel):
    name: str
    neighborhood: Optional[str] = None
    cep: Optional[str] = None


class StreetUpdate(BaseModel):
    name: Optional[str] = None
    neighborhood: Optional[str] = None
    cep: Optional[str] = None
    is_active: Optional[bool] = None


class StreetResponse(BaseModel):
    id: uuid.UUID
    name: str
    neighborhood: Optional[str] = None
    cep: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientSummary(BaseModel):
    id: uuid.UUID
    name: str
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class ClientInStreetResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    house_number: Optional[str] = None
    reference: Optional[str] = None
    display_order: int
    client: ClientSummary

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    client_street_id: uuid.UUID
    display_order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]
