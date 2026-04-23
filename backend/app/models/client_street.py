import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ClientStreet(Base):
    __tablename__ = "client_streets"
    __table_args__ = (
        UniqueConstraint("client_id", "street_id", name="uq_client_street"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    street_id = Column(
        UUID(as_uuid=True),
        ForeignKey("streets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    house_number = Column(String(20), nullable=True)
    reference = Column(String(200), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    client = relationship("Client", backref="street_links")
    street = relationship("Street", backref="client_links")

    def __repr__(self) -> str:
        return f"<ClientStreet client={self.client_id} street={self.street_id}>"
