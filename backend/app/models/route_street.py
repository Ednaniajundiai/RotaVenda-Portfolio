import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RouteStreetStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class RouteStreet(Base):
    __tablename__ = "route_streets"
    __table_args__ = (
        UniqueConstraint(
            "route_id", "street_id", name="uq_route_streets_route_street"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(
        UUID(as_uuid=True),
        ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
    )
    street_id = Column(UUID(as_uuid=True), ForeignKey("streets.id"), nullable=False)
    visit_order = Column(Integer(), nullable=False)
    status = Column(
        Enum(RouteStreetStatus, name="routestreetstatus"),
        nullable=False,
        default=RouteStreetStatus.PENDING,
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    route = relationship("Route", back_populates="route_streets")
    street = relationship("Street")
    sales = relationship("Sale", back_populates="route_street")
    payments = relationship("Payment", back_populates="route_street")

    def __repr__(self) -> str:
        return f"<RouteStreet route={self.route_id} order={self.visit_order}>"
