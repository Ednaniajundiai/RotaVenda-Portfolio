import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def _stock_status(product: Product) -> str:
    if product.current_stock == 0:
        return "OUT"
    if product.current_stock <= product.min_stock:
        return "LOW"
    return "OK"


def _product_to_dict(product: Product) -> dict:
    return {
        "id": str(product.id),
        "name": product.name,
        "category": product.category,
        "unit_measure": product.unit_measure,
        "price": float(product.price),
        "current_stock": product.current_stock,
        "min_stock": product.min_stock,
        "stock_status": _stock_status(product),
        "is_active": product.is_active,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def _load_product(db: Session, product_id: uuid.UUID) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado"
        )
    return product


def list_products(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category: Optional[str] = None,
    include_inactive: bool = False,
) -> list[dict]:
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.is_active == True)  # noqa: E712
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category:
        query = query.filter(Product.category == category)
    products = query.order_by(Product.name).offset(skip).limit(limit).all()
    return [_product_to_dict(p) for p in products]


def get_product(db: Session, product_id: uuid.UUID) -> dict:
    return _product_to_dict(_load_product(db, product_id))


def create_product(db: Session, data: ProductCreate) -> dict:
    product = Product(
        name=data.name.strip(),
        category=data.category.strip(),
        unit_measure=data.unit_measure.strip(),
        price=data.price,
        current_stock=data.current_stock or 0,
        min_stock=data.min_stock or 0,
    )
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Produto '{data.name}' com unidade '{data.unit_measure}' já existe",
        )
    db.refresh(product)
    return _product_to_dict(product)


def update_product(db: Session, product_id: uuid.UUID, data: ProductUpdate) -> dict:
    product = _load_product(db, product_id)
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(product, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um produto com esse nome e unidade de medida",
        )
    db.refresh(product)
    return _product_to_dict(product)


def deactivate_product(db: Session, product_id: uuid.UUID) -> None:
    product = _load_product(db, product_id)
    product.is_active = False
    db.commit()
