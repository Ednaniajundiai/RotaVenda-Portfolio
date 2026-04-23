import enum
import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class SaleType(str, enum.Enum):
    ROTA = "ROTA"
    LOJA = "LOJA"


class PaymentMode(str, enum.Enum):
    A_VISTA = "A_VISTA"
    FIADO = "FIADO"


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_sales_amount_positive"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    route_street_id = Column(
        UUID(as_uuid=True), ForeignKey("route_streets.id"), nullable=True
    )
    sale_date = Column(Date(), nullable=False, default=date.today)
    amount = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    description = Column(Text(), nullable=True)
    sale_type = Column(Enum(SaleType, name="saletype"), nullable=False)
    payment_mode = Column(Enum(PaymentMode, name="paymentmode"), nullable=False)
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

    client = relationship("Client")
    seller = relationship("User")
    route_street = relationship("RouteStreet", back_populates="sales")
    installments = relationship(
        "SaleInstallment",
        back_populates="sale",
        order_by="SaleInstallment.number",
        cascade="all, delete-orphan",
    )
    items = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Sale client={self.client_id} amount={self.amount}>"
