"""Integration tests for the Cartography FastAPI endpoints."""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.runner import RunStatus


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_status():
    """Reset global run status before each test."""
    from app.runner import status
    status.running = False
    status.last_run_start = None
    status.last_run_end = None
    status.last_run_success = None
    status.last_error = None
    status.run_count = 0
    yield


# ── /health ───────────────────────────────────────────────────────────────────

def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_ok_status(client):
    data = client.get("/health").json()
    assert data["status"] == "ok"


def test_health_includes_timestamp(client):
    data = client.get("/health").json()
    assert "timestamp" in data


# ── /run ──────────────────────────────────────────────────────────────────────

def test_run_returns_200(client):
    response = client.post("/run")
    assert response.status_code == 200


def test_run_returns_started_when_not_running(client):
    data = client.post("/run").json()
    assert data["status"] == "started"


def test_run_returns_already_running_when_running(client):
    from app.runner import status
    status.running = True
    data = client.post("/run").json()
    assert data["status"] == "already_running"


def test_run_started_includes_timestamp(client):
    data = client.post("/run").json()
    assert "timestamp" in data


# ── /status ───────────────────────────────────────────────────────────────────

def test_status_returns_200(client):
    response = client.get("/status")
    assert response.status_code == 200


def test_status_has_required_fields(client):
    data = client.get("/status").json()
    assert "running" in data
    assert "run_count" in data
    assert "last_run_start" in data
    assert "last_run_end" in data
    assert "last_run_success" in data
    assert "last_error" in data


def test_status_running_false_initially(client):
    data = client.get("/status").json()
    assert data["running"] is False


def test_status_run_count_zero_initially(client):
    data = client.get("/status").json()
    assert data["run_count"] == 0


def test_status_reflects_running_state(client):
    from app.runner import status
    status.running = True
    data = client.get("/status").json()
    assert data["running"] is True


# ── /runs ─────────────────────────────────────────────────────────────────────

def test_runs_returns_200(client):
    response = client.get("/runs")
    assert response.status_code == 200


def test_runs_has_required_fields(client):
    data = client.get("/runs").json()
    assert "total_runs" in data
    assert "last_success" in data
    assert "last_run" in data


def test_runs_total_runs_zero_initially(client):
    data = client.get("/runs").json()
    assert data["total_runs"] == 0
