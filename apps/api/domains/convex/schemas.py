"""Pydantic request/response schemas for the Convex Publish domain (T3.6/T3.8)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class StartOAuthRequest(BaseModel):
    app_id: uuid.UUID


class StartOAuthResponse(BaseModel):
    authorize_url: str
    state: str


class OAuthStatusResponse(BaseModel):
    connected: bool
    team_slug: str | None
    expires_at: datetime | None


class PasteCredentialsRequest(BaseModel):
    deploy_key: str = Field(..., min_length=10, max_length=1024)
    deployment_url: HttpUrl  # Pydantic validates it's a URL


class CredentialsStatusResponse(BaseModel):
    has_credentials: bool
    deployment_url: str | None = None
    team_slug: str | None = None
    last_used_at: datetime | None = None


class PublishRequest(BaseModel):
    pass


class PublishStatusResponse(BaseModel):
    migration_id: uuid.UUID
    status: str
    current_step: str | None
    message: str | None
    deployment_url: str | None
    started_at: datetime | None
    completed_at: datetime | None
