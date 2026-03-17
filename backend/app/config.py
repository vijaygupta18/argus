from functools import cached_property
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/issue_dashboard"
    slack_bot_token: str = ""
    slack_app_token: str = ""
    slack_signing_secret: str = ""
    ai_provider: str = "openai"
    ai_model: str = "openai/open-large"
    ai_api_key: str = ""
    ai_api_base: str = ""
    ai_fast_model: str = "openai/open-fast"
    ai_max_tokens: int = 16000
    ai_temperature: float = 0.1
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    default_reminder_frequency_minutes: int = 120
    app_base_url: str = "http://localhost:5173"
    admin_emails: str = ""  # comma-separated: ADMIN_EMAILS=a@x.com,b@x.com
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_hours: int = 720
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/auth/callback"

    @cached_property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
