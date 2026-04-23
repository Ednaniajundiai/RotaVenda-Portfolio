import enum
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RouteStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        UniqueConstraint("seller_id", "route_date", name="uq_routes_seller_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    route_date = Column(Date(), nullable=False)
    status = Column(
        Enum(RouteStatus, name="routestatus"),
        nullable=False,
        default=RouteStatus.DRAFT,
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text(), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    seller = relationship("User")
    route_streets = relationship(
        "RouteStreet",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteStreet.visit_order",
    )

    def __repr__(self) -> str:
        return f"<Route {self.route_date} {self.status}>"
