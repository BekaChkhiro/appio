from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AppBase(BaseModel):
    name: str
    template_id: str | None = None


class AppResponse(AppBase):
    id: UUID
    user_id: UUID
    slug: str
    description: str | None = None
    status: str
    url: str | None = None
    theme_color: str | None = None
    current_version: int
    install_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AppListResponse(BaseModel):
    """Paginated list response matching the frontend PaginatedResponse<App> shape."""

    items: list[AppResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


class PublicAppResponse(BaseModel):
    name: str
    slug: str
    description: str | None = None
    url: str | None = None
    theme_color: str | None = None
    install_count: int

    model_config = ConfigDict(from_attributes=True)


class InstallResponse(BaseModel):
    app_id: UUID
    install_count: int
    status: str


class DeleteResponse(BaseModel):
    app_id: UUID
    status: str


class ChatMessageItem(BaseModel):
    id: str
    role: str
    content: str
    timestamp: int


class MessagesResponse(BaseModel):
    app_id: UUID
    messages: list[ChatMessageItem]


class UpdateMessagesRequest(BaseModel):
    messages: list[ChatMessageItem]
