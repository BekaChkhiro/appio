"""SQLAlchemy 2.0 models for Appio."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# URL-safe slug regex — kept in sync with migration 008.
_SLUG_REGEX = r"^[a-z0-9](?:[a-z0-9\-]{0,98}[a-z0-9])?$"


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str | None] = mapped_column(String(255))
    avatar: Mapped[str | None] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(String(20), default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apps: Mapped[list["App"]] = relationship(back_populates="user")


class App(Base):
    __tablename__ = "apps"
    __table_args__ = (
        Index(
            "ix_apps_fulltext",
            func.to_tsvector("english", func.coalesce("name", "") + " " + func.coalesce("description", "")),
            postgresql_using="gin",
        ),
        CheckConstraint(
            text(f"slug ~ '{_SLUG_REGEX}'"),
            name="ck_apps_slug_url_safe",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    template_id: Mapped[str | None] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    url: Mapped[str | None] = mapped_column(Text)
    theme_color: Mapped[str | None] = mapped_column(String(7))
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    messages: Mapped[list[dict] | None] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # T3.6: publish status columns — mirrored from latest AppPublishJob for fast reads
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publish_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sandbox_archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="apps")
    generations: Mapped[list["Generation"]] = relationship(back_populates="app")


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    app_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("apps.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    hybrid_spec: Mapped[dict | None] = mapped_column(JSONB)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[float | None] = mapped_column()
    build_status: Mapped[str] = mapped_column(String(20), default="pending")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    # T2.6: preview + build URLs
    preview_url: Mapped[str | None] = mapped_column(Text)
    public_url: Mapped[str | None] = mapped_column(Text)
    # T2.7: AutoFix error tracking
    autofix_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error_stage: Mapped[str | None] = mapped_column(String(20))
    error_context: Mapped[dict | None] = mapped_column(JSONB)
    # T2.18: Workspace persistence to R2 for conversational refinement
    workspace_url: Mapped[str | None] = mapped_column(Text)
    workspace_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    app: Mapped["App | None"] = relationship(back_populates="generations")


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50))
    config_json: Mapped[dict | None] = mapped_column(JSONB)
    skeleton_path: Mapped[str] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(default=True)
    # T2.7: per-template build success tracking
    total_builds: Mapped[int] = mapped_column(Integer, default=0)
    successful_builds: Mapped[int] = mapped_column(Integer, default=0)
    failed_builds: Mapped[int] = mapped_column(Integer, default=0)
    autofix_triggered: Mapped[int] = mapped_column(Integer, default=0)
    autofix_resolved: Mapped[int] = mapped_column(Integer, default=0)


class AppTemplate(Base):
    """Marketplace app template — a hand-tuned starter with a canonical prompt.

    Separate from `templates` (build-system skeletons). These are user-facing
    starters shown in the template picker UI (T2.34).
    """

    __tablename__ = "app_templates"
    __table_args__ = (
        CheckConstraint(
            text(f"slug ~ '{_SLUG_REGEX}'"),
            name="ck_app_templates_slug_url_safe",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), index=True)
    icon: Mapped[str] = mapped_column(String(10))  # emoji
    canonical_prompt: Mapped[str] = mapped_column(Text)
    preview_screenshots: Mapped[list[str] | None] = mapped_column(JSONB, default=list)
    template_id: Mapped[str | None] = mapped_column(String(100))  # optional link to build template
    is_featured: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RAGSnippet(Base):
    """Knowledge base snippet for RAG retrieval during app generation."""

    __tablename__ = "rag_snippets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConvexOAuthToken(Base):
    """Encrypted Convex Platform OAuth token per user (T3.6).

    One row per Appio user — unique constraint enforces a single connected
    Convex account. Tokens are encrypted at rest with Fernet; see
    apps.api.domains.convex.crypto.
    """

    __tablename__ = "convex_oauth_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    team_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()


class AppConvexCredentials(Base):
    """User-provided Convex deploy key for the publish flow (T3.8).

    Replaces the OAuth-token-per-user model of T3.6 with a per-app deploy
    key pasted by the user from Convex's dashboard. The deploy key is
    encrypted at rest with Fernet (see ``apps.api.domains.convex.crypto``)
    using the same ``CONVEX_TOKEN_ENCRYPTION_KEY`` the OAuth tokens used —
    no new key-management surface.

    ADR 007 documents the architectural shift. ``ConvexOAuthToken`` and
    ``ConvexDeployment`` remain in the schema until the endpoint refactor
    in T3.8 Phase 2; they'll be dropped in a follow-up migration.
    """

    __tablename__ = "app_convex_credentials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id"), unique=True, index=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # Convex deployment URL as shown in the dashboard (e.g.
    # https://happy-animal-123.convex.cloud). Not a secret; stored plaintext
    # so it can be returned by GET /credentials/{app_id} for UI display
    # without needing to decrypt on every read.
    deployment_url: Mapped[str] = mapped_column(Text, nullable=False)
    # Fernet-encrypted CONVEX_DEPLOY_KEY (format: prod:teamslug|<secret>).
    # Decrypt only at the moment of subprocess invocation, never cache in
    # the app process, never log.
    deploy_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    # Whisker of provenance for debugging — which Convex team the key
    # claims to belong to (parsed from the `prod:teamslug|...` prefix).
    # Stored verbatim from the user's paste; no cross-check against the
    # Management API (we don't hit it in T3.8).
    team_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    app: Mapped["App"] = relationship()
    created_by: Mapped["User"] = relationship()


class ConvexDeployment(Base):
    """User-owned Convex deployment provisioned on publish (T3.6).

    One row per app — unique constraint ensures a single user-owned
    deployment per app even if publish is retried multiple times.
    """

    __tablename__ = "convex_deployments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id"), unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    deployment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    deployment_url: Mapped[str] = mapped_column(Text, nullable=False)
    team_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    project_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    provisioned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    app: Mapped["App"] = relationship()
    user: Mapped["User"] = relationship()


class AppPublishJob(Base):
    """Async migration job tracking the publish pipeline steps (T3.6).

    Polled by GET /api/v1/convex/publish/{app_id}/status. The status column
    mirrors into App.publish_status on each terminal state update so callers
    can avoid joining this table for simple status reads.
    """

    __tablename__ = "app_publish_jobs"
    __table_args__ = (
        Index("ix_app_publish_jobs_app_status", "app_id", "status"),
        Index("ix_app_publish_jobs_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # pending | provisioning | pushing_schema | copying_data | rewriting_config | rebuilding | published | failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    current_step: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    deployment_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    app: Mapped["App"] = relationship()
    user: Mapped["User"] = relationship()


class UserTheme(Base):
    """AI-generated theme persona stored per user (T4.1)."""

    __tablename__ = "user_themes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    # 'text' | 'image'
    source_kind: Mapped[str] = mapped_column(String(20))
    source_prompt: Mapped[str | None] = mapped_column(Text)
    source_image_url: Mapped[str | None] = mapped_column(Text)
    persona_json: Mapped[dict] = mapped_column(JSONB)
    cost_usd: Mapped[float | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
