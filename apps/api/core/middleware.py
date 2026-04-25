"""Rate limiting and request ID middleware."""

import uuid
from typing import Any

import structlog
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = structlog.stdlib.get_logger()


def _key_func(request: Request) -> str:
    """Extract rate-limit key: user ID from state (set by auth) or IP fallback."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    return get_remote_address(request)


limiter = Limiter(
    key_func=_key_func,
    default_limits=["100/minute"],
)


class RequestIDMiddleware:
    """Pure ASGI middleware: attach unique request ID and bind to structlog context.

    Uses pure ASGI instead of BaseHTTPMiddleware to avoid known issues
    with StreamingResponse/SSE backpressure and contextvars propagation.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        # Extract or generate request ID
        headers = dict(scope.get("headers", []))
        request_id = headers.get(b"x-request-id", b"").decode() or uuid.uuid4().hex

        # Store in scope for downstream access
        scope.setdefault("state", {})
        if isinstance(scope["state"], dict):
            scope["state"]["request_id"] = request_id

        # Bind to structlog context
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers: list[Any] = list(message.get("headers", []))
                headers.append([b"x-request-id", request_id.encode()])
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_request_id)
