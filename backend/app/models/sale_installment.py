import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class SaleInstallment(Base):
    __tablename__ = "sale_installments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_sale_installments_amount_positive"),
        CheckConstraint("paid_amount >= 0", name="ck_paid_amount_non_negative"),
        UniqueConstraint("sale_id", "number", name="uq_sale_installments_sale_number"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
    )
    number = Column(Integer(), nullable=False)
    due_date = Column(Date(), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_at = Column(DateTime(timezone=True), nullable=True)  # Fix 3.9: era Date()
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sale = relationship("Sale", back_populates="installments")
    applications = relationship(
        "InstallmentPayment",
        back_populates="installment",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SaleInstallment sale={self.sale_id} number={self.number}>"
