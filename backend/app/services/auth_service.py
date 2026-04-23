from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = (
        db.query(User)
        .filter(User.email == email, User.is_active == True)  # noqa: E712
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_user_from_token(
    db: Session, token: str, token_type: str = "access"
) -> User | None:
    payload = decode_token(token)
    if not payload or payload.get("type") != token_type:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return (
        db.query(User)
        .filter(User.id == user_id, User.is_active == True)  # noqa: E712
        .first()
    )


def create_tokens(user: User) -> tuple[str, str]:
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return access_token, refresh_token
