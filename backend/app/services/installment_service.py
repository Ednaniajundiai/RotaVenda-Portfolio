import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.installment_payment import InstallmentPayment
from app.models.sale import PaymentMode, Sale
from app.models.sale_installment import SaleInstallment
from app.schemas.installment import InstallmentApplicationInput, InstallmentInput


def _installment_to_dict(inst: SaleInstallment, today: Optional[date] = None) -> dict:
    if today is None:
        today = date.today()
    amount = float(inst.amount)
    paid_amount = float(inst.paid_amount)
    remaining = amount - paid_amount

    if paid_amount >= amount:
        status = "PAID"
    elif paid_amount > 0:
        status = "PARTIAL" if inst.due_date >= today else "OVERDUE"
    else:
        status = "PENDING" if inst.due_date >= today else "OVERDUE"

    return {
        "id": str(inst.id),
        "sale_id": str(inst.sale_id),
        "number": inst.number,
        "due_date": inst.due_date,
        "amount": amount,
        "paid_amount": paid_amount,
        "remaining": remaining,
        "status": status,
        "paid_at": inst.paid_at,
        "created_at": inst.created_at,
    }


def create_installments_for_sale(
    db: Session,
    sale: Sale,
    installment_inputs: Optional[list[InstallmentInput]],
) -> list[SaleInstallment]:
    if sale.payment_mode != PaymentMode.FIADO:
        return []

    if not installment_inputs:
        # Auto-criar 1 parcela com due_date = sale_date + 30 dias
        installment = SaleInstallment(
            sale_id=sale.id,
            number=1,
            due_date=sale.sale_date + timedelta(days=30),
            amount=sale.amount,
            paid_amount=Decimal("0"),
        )
        db.add(installment)
        return [installment]

    # Validar soma == sale.amount
    total = sum(i.amount for i in installment_inputs)
    if abs(total - sale.amount) > Decimal("0.01"):
        raise HTTPException(
            status_code=400,
            detail=f"Soma das parcelas ({total}) não corresponde ao valor da venda ({sale.amount})",
        )

    # Validar números únicos
    numbers = [i.number for i in installment_inputs]
    if len(numbers) != len(set(numbers)):
        raise HTTPException(
            status_code=400,
            detail="Números de parcelas duplicados",
        )

    installments = []
    for inp in installment_inputs:
        installment = SaleInstallment(
            sale_id=sale.id,
            number=inp.number,
            due_date=inp.due_date,
            amount=inp.amount,
            paid_amount=Decimal("0"),
        )
        db.add(installment)
        installments.append(installment)

    return installments


def get_sale_installments(db: Session, sale_id: uuid.UUID) -> list[dict]:
    today = date.today()
    installments = (
        db.query(SaleInstallment)
        .filter(SaleInstallment.sale_id == sale_id)
        .order_by(SaleInstallment.number)
        .all()
    )
    return [_installment_to_dict(i, today) for i in installments]


def apply_payment_to_installments(
    db: Session,
    payment_id: uuid.UUID,
    payment_amount: Decimal,
    applications: Optional[list[InstallmentApplicationInput]],
    payment_date: date,
) -> None:
    if not applications:
        from app.models.payment import Payment

        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return

        installments = (
            db.query(SaleInstallment)
            .join(Sale, Sale.id == SaleInstallment.sale_id)
            .filter(
                Sale.client_id == payment.client_id,
                Sale.payment_mode == PaymentMode.FIADO,
                Sale.is_active == True,  # noqa: E712
                SaleInstallment.paid_amount < SaleInstallment.amount,
            )
            .order_by(SaleInstallment.due_date.asc(), SaleInstallment.number.asc())
            .with_for_update()
            .all()
        )

        remaining = payment_amount
        for inst in installments:
            if remaining <= 0:
                break
            inst_remaining = inst.amount - inst.paid_amount
            applied = min(remaining, inst_remaining)

            app_record = InstallmentPayment(
                installment_id=inst.id,
                payment_id=payment_id,
                amount=applied,
            )
            db.add(app_record)

            inst.paid_amount = inst.paid_amount + applied
            if inst.paid_amount >= inst.amount:
                inst.paid_at = payment_date

            remaining -= applied

        if remaining > 0:
            from app.models.client import Client

            client = (
                db.query(Client)
                .filter(Client.id == payment.client_id)
                .with_for_update()
                .first()
            )
            if client and client.opening_balance > 0:
                amortize = min(remaining, client.opening_balance)
                client.opening_balance = client.opening_balance - amortize
                remaining -= amortize

        if remaining > Decimal("0.01"):
            raise HTTPException(
                status_code=400,
                detail="Pagamento excede o saldo devedor do cliente",
            )

    else:
        # Validar soma == payment_amount
        total_applied = sum(a.amount for a in applications)
        if abs(total_applied - payment_amount) > Decimal("0.01"):
            raise HTTPException(
                status_code=400,
                detail=f"Soma das aplicações ({total_applied}) não corresponde ao valor do pagamento ({payment_amount})",
            )

        for app_input in applications:
            inst = (
                db.query(SaleInstallment)
                .filter(SaleInstallment.id == uuid.UUID(app_input.installment_id))
                .with_for_update()
                .first()
            )
            if not inst:
                raise HTTPException(
                    status_code=404,
                    detail=f"Parcela {app_input.installment_id} não encontrada",
                )

            inst_remaining = inst.amount - inst.paid_amount
            if app_input.amount > inst_remaining:
                raise HTTPException(
                    status_code=400,
                    detail=f"Valor aplicado ({app_input.amount}) excede o saldo da parcela ({inst_remaining})",
                )

            app_record = InstallmentPayment(
                installment_id=inst.id,
                payment_id=payment_id,
                amount=app_input.amount,
            )
            db.add(app_record)

            inst.paid_amount = inst.paid_amount + app_input.amount
            if inst.paid_amount >= inst.amount:
                inst.paid_at = payment_date
