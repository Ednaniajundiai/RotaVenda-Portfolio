import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.api.v1.auth import limiter
from app.api.v1.router import router
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

# ── Logging estruturado ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if not settings.is_production else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("rotavenda")


def _create_first_superuser() -> None:
    """Cria o usuário gerente inicial se não existir."""
    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.email == settings.FIRST_SUPERUSER_EMAIL).first()
        if not exists:
            db.add(
                User(
                    name=settings.FIRST_SUPERUSER_NAME,
                    email=settings.FIRST_SUPERUSER_EMAIL,
                    hashed_password=hash_password(settings.FIRST_SUPERUSER_PASSWORD),
                    role=UserRole.GERENTE,
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _create_first_superuser()
    yield


app = FastAPI(
    title="RotaVenda API",
    description="Sistema de gestão de vendas e fiado",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate limiter ────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Total-Saldo"],
)

app.include_router(router)


@app.get("/health", tags=["Health"])
def health():
    """Healthcheck que valida conexão real com o banco de dados."""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception as exc:
        logger.error("Healthcheck DB falhou: %s", exc)
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "rotavenda-api",
        "database": "ok" if db_ok else "error",
    }
