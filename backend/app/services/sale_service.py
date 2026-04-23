import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.client import Client
from app.models.product import Product
from app.models.route_street import RouteStreet
from app.models.sale import PaymentMode, Sale, SaleType
from app.models.sale_item import SaleItem
from app.schemas.sale import SaleCreate, SaleUpdate
from app.services import installment_service


def _item_to_dict(item: SaleItem) -> dict:
    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "product_name": item.product.name if item.product else "",
        "unit_measure": item.product.unit_measure if item.product else "",
        "quantity": float(item.quantity),
        "unit_price": float(item.unit_price),
        "subtotal": float(item.subtotal),
    }


def _sale_to_dict(sale: Sale) -> dict:
    items_subtotal = sum(float(i.subtotal) for i in sale.items)
    return {
        "id": str(sale.id),
        "client_id": str(sale.client_id),
        "client_name": sale.client.name if sale.client else "",
        "seller_id": str(sale.seller_id),
        "seller_name": sale.seller.name if sale.seller else "",
        "route_street_id": str(sale.route_street_id) if sale.route_street_id else None,
        "sale_date": sale.sale_date,
        "amount": float(sale.amount),
        "discount": float(sale.discount),
        "subtotal": items_subtotal,
        "description": sale.description,
        "sale_type": sale.sale_type.value,
        "payment_mode": sale.payment_mode.value,
        "created_at": sale.created_at,
        "installments": [
            installment_service._installment_to_dict(i) for i in sale.installments
        ],
        "items": [_item_to_dict(i) for i in sale.items],
    }


def _load_sale(db: Session, sale_id: uuid.UUID) -> Sale:
    sale = (
        db.query(Sale)
        .options(
            joinedload(Sale.client),
            joinedload(Sale.seller),
            selectinload(Sale.installments),
            selectinload(Sale.items).joinedload(SaleItem.product),
        )
        .filter(Sale.id == sale_id, Sale.is_active == True)  # noqa: E712
        .first()
    )
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Venda não encontrada"
        )
    return sale


def list_sales(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    client_id: Optional[str] = None,
    route_street_id: Optional[str] = None,
    sale_date: Optional[str] = None,
) -> list[dict]:
    query = (
        db.query(Sale)
        .options(
            joinedload(Sale.client),
            joinedload(Sale.seller),
            selectinload(Sale.installments),
            selectinload(Sale.items).joinedload(SaleItem.product),
        )
        .filter(Sale.is_active == True)  # noqa: E712
    )
    if client_id:
        query = query.filter(Sale.client_id == uuid.UUID(client_id))
    if route_street_id:
        query = query.filter(Sale.route_street_id == uuid.UUID(route_street_id))
    if sale_date:
        query = query.filter(Sale.sale_date == sale_date)
    sales = query.order_by(Sale.sale_date.desc(), Sale.created_at.desc()).offset(skip).limit(limit).all()
    return [_sale_to_dict(s) for s in sales]


def get_sale(db: Session, sale_id: uuid.UUID) -> dict:
    return _sale_to_dict(_load_sale(db, sale_id))


def create_sale(
    db: Session, data: SaleCreate, seller_id: uuid.UUID
) -> dict:
    client = (
        db.query(Client)
        .filter(Client.id == uuid.UUID(data.client_id), Client.is_active == True)  # noqa: E712
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    route_street_id = None
    if data.route_street_id:
        rs = db.query(RouteStreet).filter(
            RouteStreet.id == uuid.UUID(data.route_street_id)
        ).first()
        if not rs:
            raise HTTPException(status_code=404, detail="Rua da rota não encontrada")
        route_street_id = rs.id

    try:
        sale_type = SaleType(data.sale_type)
        payment_mode = PaymentMode(data.payment_mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Valor inválido: {e}")

    # Valida e calcula subtotal a partir dos itens
    if not data.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A venda deve ter pelo menos um produto",
        )

    items_data = []
    items_subtotal = Decimal("0")
    for item_input in data.items:
        product = (
            db.query(Product)
            .filter(
                Product.id == uuid.UUID(item_input.product_id),
                Product.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Produto {item_input.product_id} não encontrado ou inativo",
            )
        subtotal = item_input.quantity * item_input.unit_price
        items_subtotal += subtotal
        items_data.append(
            SaleItem(
                product_id=product.id,
                quantity=item_input.quantity,
                unit_price=item_input.unit_price,
                subtotal=subtotal,
            )
        )

    discount = data.discount or Decimal("0")
    if discount >= items_subtotal:
        raise HTTPException(
            status_code=400,
            detail="Desconto deve ser menor que o subtotal dos itens",
        )
    amount = items_subtotal - discount

    sale = Sale(
        client_id=uuid.UUID(data.client_id),
        seller_id=seller_id,
        route_street_id=route_street_id,
        sale_date=data.sale_date or date.today(),
        amount=amount,
        discount=discount,
        description=data.description,
        sale_type=sale_type,
        payment_mode=payment_mode,
    )
    db.add(sale)
    db.flush()

    for item in items_data:
        item.sale_id = sale.id
        db.add(item)

    installment_service.create_installments_for_sale(db, sale, data.installments)
    db.commit()

    return _sale_to_dict(_load_sale(db, sale.id))


def update_sale(
    db: Session, sale_id: uuid.UUID, data: SaleUpdate
) -> dict:
    sale = _load_sale(db, sale_id)
    set_fields = data.model_dump(exclude_unset=True)

    items_provided = "items" in set_fields
    installments_provided = "installments" in set_fields
    discount_provided = "discount" in set_fields
    payment_mode_provided = "payment_mode" in set_fields

    has_paid = any(i.paid_amount > 0 for i in sale.installments)

    # Regra de segurança: itens e desconto bloqueados se há parcelas pagas
    if items_provided or discount_provided:
        if has_paid:
            raise HTTPException(
                status_code=400,
                detail="Esta venda possui parcelas pagas e não pode ter seus itens alterados",
            )

    # Fix 1.2: também bloquear mudança de payment_mode se há parcelas pagas
    if payment_mode_provided and has_paid:
        raise HTTPException(
            status_code=400,
            detail="Esta venda possui parcelas pagas e não pode ter seu modo de pagamento alterado",
        )

    # Calcular items_subtotal (novos ou atuais)
    if items_provided:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A venda deve ter pelo menos um produto",
            )
        new_items_data = []
        items_subtotal = Decimal("0")
        for item_input in data.items:
            product = (
                db.query(Product)
                .filter(
                    Product.id == uuid.UUID(item_input.product_id),
                    Product.is_active == True,  # noqa: E712
                )
                .first()
            )
            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Produto {item_input.product_id} não encontrado ou inativo",
                )
            subtotal = item_input.quantity * item_input.unit_price
            items_subtotal += subtotal
            new_items_data.append(
                SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=item_input.quantity,
                    unit_price=item_input.unit_price,
                    subtotal=subtotal,
                )
            )
    else:
        items_subtotal = sum(Decimal(str(i.subtotal)) for i in sale.items)

    # Calcular novo desconto e amount
    new_discount = data.discount if discount_provided else Decimal(str(sale.discount))

    if items_provided or discount_provided:
        if new_discount >= items_subtotal:
            raise HTTPException(
                status_code=400,
                detail="Desconto deve ser menor que o subtotal dos itens",
            )

    new_amount = items_subtotal - new_discount
    old_amount = Decimal(str(sale.amount))
    amount_changed = abs(new_amount - old_amount) > Decimal("0.001")

    # Aplicar novos items
    if items_provided:
        for item in list(sale.items):
            db.delete(item)
        db.flush()
        for item in new_items_data:
            db.add(item)

    # Atualizar amount e discount
    if items_provided or discount_provided:
        sale.discount = new_discount
        sale.amount = new_amount

    # Atualizar payment_mode
    if data.payment_mode is not None:
        try:
            sale.payment_mode = PaymentMode(data.payment_mode)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Valor inválido: {e}")

    # Atualizar description
    if data.description is not None:
        sale.description = data.description

    # Processar parcelas
    if installments_provided:
        # Fix 1.3: recusar recriação de parcelas se alguma já foi paga
        if has_paid:
            raise HTTPException(
                status_code=400,
                detail="Esta venda possui parcelas pagas. Faça o estorno antes de alterar as parcelas.",
            )
        for inst in list(sale.installments):
            db.delete(inst)
        db.flush()
        installment_service.create_installments_for_sale(db, sale, data.installments)
    elif amount_changed and sale.payment_mode == PaymentMode.FIADO:
        # Fix 1.3: recusar recálculo destrutivo se parcelas têm pagamentos
        if has_paid:
            raise HTTPException(
                status_code=400,
                detail="Esta venda possui parcelas pagas. Faça o estorno antes de alterar o valor.",
            )
        for inst in list(sale.installments):
            db.delete(inst)
        db.flush()
        installment_service.create_installments_for_sale(db, sale, None)

    db.commit()
    return _sale_to_dict(_load_sale(db, sale_id))


def delete_sale(db: Session, sale_id: uuid.UUID) -> None:
    sale = _load_sale(db, sale_id)
    sale.is_active = False
    db.commit()
