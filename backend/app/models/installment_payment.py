import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"
    __table_args__ = (
        CheckConstraint(
            "amount > 0", name="ck_installment_payments_amount_positive"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_installments.id", ondelete="CASCADE"),
        nullable=False,
    )
    payment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount = Column(Numeric(12, 2), nullable=False)

    installment = relationship("SaleInstallment", back_populates="applications")
    payment = relationship("Payment", back_populates="installment_applications")

    def __repr__(self) -> str:
        return f"<InstallmentPayment installment={self.installment_id} amount={self.amount}>"
