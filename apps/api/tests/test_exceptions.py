from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.core.exceptions import (
    AppError,
    ForbiddenError,
    NotFoundError,
    register_exception_handlers,
)


def _make_app() -> FastAPI:
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.get("/not-found")
    async def raise_not_found() -> None:
        raise NotFoundError("Thing not found")

    @test_app.get("/forbidden")
    async def raise_forbidden() -> None:
        raise ForbiddenError()

    @test_app.get("/custom")
    async def raise_custom() -> None:
        raise AppError("Something broke", status_code=418, error_code="TEAPOT")

    return test_app


client = TestClient(_make_app())


def test_not_found_error() -> None:
    resp = client.get("/not-found")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"] == "Thing not found"


def test_forbidden_error() -> None:
    resp = client.get("/forbidden")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_custom_error() -> None:
    resp = client.get("/custom")
    assert resp.status_code == 418
    assert resp.json()["error"]["code"] == "TEAPOT"
