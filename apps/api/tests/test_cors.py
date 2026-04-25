from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def test_cors_allows_appio_origin() -> None:
    resp = client.options(
        "/health",
        headers={
            "Origin": "https://appio.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "https://appio.app"


def test_cors_blocks_unknown_origin() -> None:
    resp = client.options(
        "/health",
        headers={
            "Origin": "https://evil.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") != "https://evil.com"


def test_request_id_header() -> None:
    resp = client.get("/health")
    assert "x-request-id" in resp.headers
