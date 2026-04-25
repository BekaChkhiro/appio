from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def test_health_returns_service_info() -> None:
    response = client.get("/health")
    data = response.json()
    assert data["service"] == "appio-api"
    assert data["status"] in ("ok", "degraded")
