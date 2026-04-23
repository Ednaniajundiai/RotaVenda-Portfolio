import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RouteTemplateStreetItem(BaseModel):
    id: str
    street_id: str
    street_name: str
    street_neighborhood: Optional[str] = None
    visit_order: int


class RouteTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RouteTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RouteTemplateStreetAdd(BaseModel):
    street_id: uuid.UUID
    visit_order: Optional[int] = None


class RouteTemplateStreetReorderItem(BaseModel):
    id: uuid.UUID
    visit_order: int


class RouteTemplateStreetReorderRequest(BaseModel):
    items: list[RouteTemplateStreetReorderItem]


class RouteTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    streets: list[RouteTemplateStreetItem] = []
