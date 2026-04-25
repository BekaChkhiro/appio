import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateResponse(BaseModel):
    id: str
    name: str
    display_name: str
    category: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TemplateDetailResponse(TemplateResponse):
    config_json: dict[str, object] | None = None
    skeleton_path: str | None = None


# --- App Templates (Marketplace) ---


class AppTemplateResponse(BaseModel):
    """Marketplace starter card — shown in the template picker grid."""

    id: uuid.UUID
    slug: str
    name: str
    description: str
    category: str
    icon: str
    preview_screenshots: list[str] | None = None
    is_featured: bool
    use_count: int

    model_config = ConfigDict(from_attributes=True)


class AppTemplateDetailResponse(AppTemplateResponse):
    """Full detail view — includes the canonical prompt for the chat prefill."""

    canonical_prompt: str
    template_id: str | None = None
    created_at: datetime
    updated_at: datetime
