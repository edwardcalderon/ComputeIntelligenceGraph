from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from typing import Optional


def _find_env_file() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return Path(".env")


ROOT_ENV_FILE = _find_env_file()


class CartographyConfig(BaseSettings):
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j"
    cig_demo_mode: bool = False

    aws_role_arn: Optional[str] = None
    aws_regions: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("AWS_REGIONS", "AWS_REGION"),
    )

    gcp_enabled: bool = False
    gcp_project_id: Optional[str] = None
    google_application_credentials: Optional[str] = None

    kubernetes_enabled: bool = False
    kubeconfig_path: Optional[str] = None
    kubernetes_cluster_name: Optional[str] = None

    discovery_interval_minutes: int = 5

    class Config:
        env_file = ROOT_ENV_FILE
        extra = "ignore"


config = CartographyConfig()
