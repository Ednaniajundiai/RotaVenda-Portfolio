import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_gerente
from app.models.user import User
from app.schemas.user_crud import (
    UserCreate,
    UserListResponse,
    UserPasswordUpdate,
    UserUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserListResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.list_users(db, skip=skip, limit=limit, include_inactive=include_inactive)


@router.post("", response_model=UserListResponse, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.create_user(db, body)


@router.get("/{user_id}", response_model=UserListResponse)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserListResponse)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.update_user(db, user_id, body)


@router.patch("/{user_id}/password", response_model=UserListResponse)
def update_user_password(
    user_id: uuid.UUID,
    body: UserPasswordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.update_user_password(db, user_id, body.password)


@router.delete("/{user_id}", response_model=UserListResponse)
def deactivate_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_gerente),
):
    return user_service.deactivate_user(db, user_id)
