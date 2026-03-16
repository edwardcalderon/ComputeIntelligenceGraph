"""Tests for the Cartography runner module."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.runner import RunStatus, build_cartography_command, run_discovery, status


def test_build_cartography_command_basic():
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "cartography" in cmd
    assert "--neo4j-uri" in cmd
    assert "--neo4j-password-env-var" in cmd


def test_build_cartography_command_with_role():
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = "arn:aws:iam::123456789:role/CIGDiscovery"
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--aws-role-arn" in cmd
    assert "arn:aws:iam::123456789:role/CIGDiscovery" in cmd


def test_build_cartography_command_with_regions():
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = "arn:aws:iam::123456789:role/CIGDiscovery"
        mock_config.aws_regions = "us-east-1,us-west-2,eu-west-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--aws-regions" in cmd
    assert "us-east-1,us-west-2,eu-west-1" in cmd


def test_build_cartography_command_no_role():
    """Without a role ARN, --aws-role-arn and --aws-regions should be omitted."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--aws-role-arn" not in cmd


def test_build_cartography_command_with_gcp():
    """With GCP enabled and project ID, --gcp-project-id should be included."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = True
        mock_config.gcp_project_id = "my-gcp-project"
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--gcp-project-id" in cmd
    assert "my-gcp-project" in cmd


def test_build_cartography_command_gcp_disabled():
    """With GCP disabled, --gcp-project-id should not be included."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = "my-gcp-project"
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--gcp-project-id" not in cmd


def test_build_cartography_command_with_kubernetes():
    """With Kubernetes enabled and kubeconfig path, --k8s-kubeconfig-path should be included."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = True
        mock_config.kubeconfig_path = "/root/.kube/config"
        cmd = build_cartography_command()
    assert "--k8s-kubeconfig-path" in cmd
    assert "/root/.kube/config" in cmd


def test_build_cartography_command_kubernetes_disabled():
    """With Kubernetes disabled, --k8s-kubeconfig-path should not be included."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = False
        mock_config.kubeconfig_path = "/root/.kube/config"
        cmd = build_cartography_command()
    assert "--k8s-kubeconfig-path" not in cmd


def test_build_cartography_command_kubernetes_no_kubeconfig():
    """With Kubernetes enabled but no kubeconfig path, flag should be omitted."""
    with patch("app.runner.config") as mock_config:
        mock_config.neo4j_uri = "bolt://localhost:7687"
        mock_config.neo4j_user = "neo4j"
        mock_config.aws_role_arn = None
        mock_config.aws_regions = "us-east-1"
        mock_config.gcp_enabled = False
        mock_config.gcp_project_id = None
        mock_config.kubernetes_enabled = True
        mock_config.kubeconfig_path = None
        cmd = build_cartography_command()
    assert "--k8s-kubeconfig-path" not in cmd


@pytest.mark.asyncio
async def test_run_discovery_already_running():
    status.running = True
    result = await run_discovery()
    assert result["status"] == "already_running"
    status.running = False
