from datetime import datetime, timedelta, timezone
from typing import Any

import hashlib

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Gera hash bcrypt puro ($2b$)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha contra hash bcrypt puro ou legacy bcrypt-sha256 (passlib)."""
    try:
        if hashed_password.startswith("$bcrypt-sha256$"):
            return _verify_legacy_bcrypt_sha256(plain_password, hashed_password)
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def _verify_legacy_bcrypt_sha256(plain: str, stored: str) -> bool:
    """Verifica hashes gerados pelo passlib bcrypt_sha256 (v2 com ident 2b).

    Formato: $bcrypt-sha256$v=2,t=2b,r=<rounds>$<salt22>$<digest>
    O passlib faz: sha256(password) -> hex -> bcrypt(hex, salt).
    """
    parts = stored.split("$")
    # parts: ['', 'bcrypt-sha256', 'v=2,t=2b,r=12', '<salt22>', '<digest>']
    if len(parts) != 5:
        return False
    config = parts[2]
    salt22 = parts[3]
    digest = parts[4]
    rounds_str = config.split("r=")[1] if "r=" in config else "12"
    rounds = int(rounds_str)
    ident = "2b"
    for token in config.split(","):
        if token.startswith("t="):
            ident = token[2:]
    bcrypt_salt = f"${ident}${rounds:02d}${salt22}".encode("utf-8")
    sha_hex = hashlib.sha256(plain.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(sha_hex.encode("utf-8"), bcrypt_salt + digest.encode("utf-8"))


def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
