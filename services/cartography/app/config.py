from pydantic_settings import BaseSettings
from typing import Optional


class CartographyConfig(BaseSettings):
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j"

    aws_role_arn: Optional[str] = None
    aws_regions: str = "us-east-2"

    gcp_enabled: bool = False
    gcp_project_id: Optional[str] = None
    google_application_credentials: Optional[str] = None

    kubernetes_enabled: bool = False
    kubeconfig_path: Optional[str] = None
    kubernetes_cluster_name: Optional[str] = None

    discovery_interval_minutes: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"


config = CartographyConfig()
