"""Custom exception handlers for the API."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        detail: str,
        status_code: int = 400,
        error_code: str = "APP_ERROR",
    ) -> None:
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(detail)


class NotFoundError(AppError):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail=detail, status_code=404, error_code="NOT_FOUND")


class ForbiddenError(AppError):
    def __init__(self, detail: str = "Access denied") -> None:
        super().__init__(detail=detail, status_code=403, error_code="FORBIDDEN")


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(detail=detail, status_code=401, error_code="UNAUTHORIZED")


class RateLimitError(AppError):
    def __init__(self, detail: str = "Rate limit exceeded") -> None:
        super().__init__(detail=detail, status_code=429, error_code="RATE_LIMIT_EXCEEDED")


class GenerationError(AppError):
    def __init__(self, detail: str = "App generation failed") -> None:
        super().__init__(detail=detail, status_code=500, error_code="GENERATION_FAILED")


async def app_exception_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.error_code, "message": exc.detail}},
    )


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for err in exc.errors():
        loc = " → ".join(str(part) for part in err["loc"])
        errors.append({"field": loc, "message": err["msg"]})
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request", "details": errors}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the app."""
    app.add_exception_handler(AppError, app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
