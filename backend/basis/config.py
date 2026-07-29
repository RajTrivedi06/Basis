"""Application configuration via environment variables.

Uses pydantic-settings to load configuration from .env files and environment
variables. Import the singleton `settings` object anywhere configuration is needed.
"""

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find the .env file — works whether you run from backend/ or the repo root
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _REPO_ROOT / ".env"

# Populate os.environ from .env so subsystems that read env vars directly
# (notably boto3's default credential chain) see local-dev values.
# override=False means shell env wins over .env — matches boto3 precedence.
# No-op on EC2 where .env omits AWS keys and IAM role supplies them instead.
load_dotenv(_ENV_FILE, override=False)


class Settings(BaseSettings):
    """Global application settings, loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://basis:basis@localhost:5433/basis"

    # Environment
    environment: str = "dev"  # "dev" or "prod"
    cors_origins: str = "http://localhost:3000"
    sentry_dsn: str = ""

    # Provider API keys (optional -- public endpoints work without these)
    vast_api_key: str = ""
    runpod_api_key: str = ""
    gcp_api_key: str = ""

    # AWS credentials (for EC2 Spot price history)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_default_region: str = "us-east-1"


settings = Settings()
