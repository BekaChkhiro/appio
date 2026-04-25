"""Pydantic schemas for the themes domain (T4.1).

Mirrors the TypeScript Persona shape from packages/themes/src/types.ts.
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ── Color palette ────────────────────────────────────────────────────────────

class ColorMapSchema(BaseModel):
    # camelCase keys intentional — must match the TS ColorSlot union verbatim
    # so that persona_json JSONB and the frontend share identical key names.
    model_config = ConfigDict(populate_by_name=True)

    background: str
    foreground: str
    card: str
    cardForeground: str  # noqa: N815
    primary: str
    primaryForeground: str  # noqa: N815
    secondary: str
    secondaryForeground: str  # noqa: N815
    muted: str
    mutedForeground: str  # noqa: N815
    accent: str
    accentForeground: str  # noqa: N815
    border: str
    input: str
    ring: str
    destructive: str
    destructiveForeground: str  # noqa: N815


class PersonaPaletteSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    oklch: ColorMapSchema
    rgb: ColorMapSchema


# ── Typography ───────────────────────────────────────────────────────────────

class TypographyRoleSchema(BaseModel):
    family: str
    weight: int
    lineHeight: float  # noqa: N815
    letterSpacing: str  # noqa: N815


class TypeScaleSchema(BaseModel):
    display: float
    h1: float
    h2: float
    h3: float
    body: float
    small: float


class MonoSchema(BaseModel):
    family: str


class PersonaTypographySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    heading: TypographyRoleSchema
    body: TypographyRoleSchema
    mono: MonoSchema
    scale: TypeScaleSchema


# ── Shape ────────────────────────────────────────────────────────────────────

class RadiusSchema(BaseModel):
    none: float
    sm: float
    md: float
    lg: float
    xl: float
    full: float


class ShadowSchema(BaseModel):
    none: str
    sm: str
    md: str
    lg: str
    xl: str


class BorderWidthSchema(BaseModel):
    thin: int
    medium: int
    thick: int


class PersonaShapeSchema(BaseModel):
    radius: RadiusSchema
    shadow: ShadowSchema
    border: BorderWidthSchema


# ── Motion ───────────────────────────────────────────────────────────────────

class DurationSchema(BaseModel):
    instant: int
    fast: int
    medium: int
    slow: int
    slower: int


class EaseSchema(BaseModel):
    standard: str
    out: str
    in_: str = Field(..., alias="in")
    emphasized: str
    spring: str

    model_config = ConfigDict(populate_by_name=True)


class PersonaMotionSchema(BaseModel):
    duration: DurationSchema
    ease: EaseSchema


# ── Top-level Persona ────────────────────────────────────────────────────────

class PersonaSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str
    inspiration: str
    light: PersonaPaletteSchema
    dark: PersonaPaletteSchema
    typography: PersonaTypographySchema
    shape: PersonaShapeSchema
    motion: PersonaMotionSchema


# ── Request / Response ───────────────────────────────────────────────────────

class GenerateThemeRequest(BaseModel):
    prompt: str | None = Field(None, max_length=2000)
    image_url: str | None = None
    image_base64: str | None = None
    name: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "GenerateThemeRequest":
        sources = [
            self.prompt is not None,
            self.image_url is not None,
            self.image_base64 is not None,
        ]
        if sum(sources) != 1:
            raise ValueError("Exactly one of prompt, image_url, or image_base64 must be provided")
        return self


class WcagReport(BaseModel):
    passes: bool
    warnings: list[str]
    errors: list[str]


class GenerateThemeResponse(BaseModel):
    theme_id: uuid.UUID
    persona: PersonaSchema
    cost_usd: float
    wcag: WcagReport


class SavedThemeResponse(BaseModel):
    theme_id: uuid.UUID
    name: str
    source_kind: str
    source_prompt: str | None
    source_image_url: str | None
    persona: PersonaSchema
    cost_usd: float | None
    created_at: str


class ThemeListResponse(BaseModel):
    items: list[SavedThemeResponse]
    total: int
    limit: int
    offset: int
