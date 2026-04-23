import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class RouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    route_date: date
    notes: Optional[str] = None
    template_id: Optional[uuid.UUID] = None


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


class RouteStreetSummary(BaseModel):
    id: str
    street_id: str
    street_name: str
    street_neighborhood: Optional[str] = None
    visit_order: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class RouteResponse(BaseModel):
    id: str
    name: str
    seller_id: str
    seller_name: str
    route_date: date
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    route_streets: list[RouteStreetSummary] = []


class RouteStreetCreate(BaseModel):
    street_id: uuid.UUID
    visit_order: Optional[int] = None


class RouteStreetReorderItem(BaseModel):
    id: uuid.UUID
    visit_order: int


class RouteStreetReorderRequest(BaseModel):
    items: list[RouteStreetReorderItem]


class ClientInRouteStreet(BaseModel):
    client_street_id: str
    client_id: str
    name: str
    phone: Optional[str] = None
    house_number: Optional[str] = None
    reference: Optional[str] = None
    display_order: int
    balance: float


class RouteStreetDetail(BaseModel):
    id: str
    route_id: str
    street_id: str
    street_name: str
    street_neighborhood: Optional[str] = None
    visit_order: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    clients: list[ClientInRouteStreet] = []
