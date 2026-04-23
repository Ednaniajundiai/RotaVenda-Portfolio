import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RouteTemplate(Base):
    __tablename__ = "route_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text(), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    streets = relationship(
        "RouteTemplateStreet",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="RouteTemplateStreet.visit_order",
    )

    def __repr__(self) -> str:
        return f"<RouteTemplate {self.name}>"


class RouteTemplateStreet(Base):
    __tablename__ = "route_template_streets"
    __table_args__ = (
        UniqueConstraint(
            "template_id", "street_id", name="uq_route_template_streets"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("route_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    street_id = Column(UUID(as_uuid=True), ForeignKey("streets.id"), nullable=False)
    visit_order = Column(Integer(), nullable=False)

    template = relationship("RouteTemplate", back_populates="streets")
    street = relationship("Street")

    def __repr__(self) -> str:
        return f"<RouteTemplateStreet template={self.template_id} order={self.visit_order}>"
