from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRET = "change-this-to-a-random-32-char-string-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    SECRET_KEY: str = _PLACEHOLDER_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    FIRST_SUPERUSER_EMAIL: str = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"
    FIRST_SUPERUSER_NAME: str = "Gerente"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str, info) -> str:  # type: ignore[override]
        # Acessar outros campos ainda não é garantido em validators de campo,
        # então lemos ENVIRONMENT direto do ambiente.
        import os

        env = os.environ.get("ENVIRONMENT", "development")
        if env == "production" and (not v or v == _PLACEHOLDER_SECRET or len(v) < 32):
            raise ValueError(
                "SECRET_KEY deve ter pelo menos 32 caracteres em produção. "
                "Gere com: openssl rand -hex 32"
            )
        return v

    @field_validator("FIRST_SUPERUSER_PASSWORD")
    @classmethod
    def superuser_password_must_not_be_default(cls, v: str) -> str:  # type: ignore[override]
        import os

        env = os.environ.get("ENVIRONMENT", "development")
        if env == "production" and v in ("admin123", "", "password"):
            raise ValueError(
                "FIRST_SUPERUSER_PASSWORD não pode ser o valor padrão em produção."
            )
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
