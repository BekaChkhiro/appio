"""Shared Pydantic models used across Python packages.

This module defines the canonical AppSpec schema — the contract between the
Claude API (which produces it) and the deterministic code generator (which
consumes it). The same Pydantic models are exported as JSON Schema and passed
to Claude via ``output_config.format`` so structural validity is guaranteed by
the API; Pydantic is responsible only for *semantic* validation (component
count caps, route uniqueness, length limits, etc.) that Anthropic's structured
outputs subset cannot express.

Schema-design constraints (verified against the Anthropic structured-outputs
docs, April 2026):

- Object ``additionalProperties`` MUST be ``false``. Free-form ``dict[str, X]``
  fields therefore cannot be modelled directly — instead, dict-like data is
  modelled as a *list of {key, value}* objects.
- ``maxLength`` / ``minLength`` / ``maximum`` / ``minimum`` / ``maxItems`` are
  NOT supported. Use ``pattern`` for string shape, and enforce length/count
  caps in Pydantic validators that run *after* Claude responds.
- ``minItems`` is supported only for the values 0 and 1.
- ``$ref`` and ``$defs`` are supported (no recursion, no external refs).
- ``enum`` is supported for primitive types — prefer ``Literal`` over plain
  ``str`` for whitelisted fields.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Limits — exported so the generator and prompt template stay in sync.
# ---------------------------------------------------------------------------

MAX_PAGES = 5
MAX_COMPONENTS_PER_PAGE = 6
MAX_JSX_LENGTH = 4000
MAX_PROP_STRING_LENGTH = 200
MAX_APP_NAME_LENGTH = 50
MAX_PROPS_PER_COMPONENT = 12
MAX_DATA_MODEL_ENTITIES = 8
MAX_FIELDS_PER_ENTITY = 16

SUPPORTED_TEMPLATES_TUPLE: tuple[str, ...] = (
    "todo-list",
    "expense-tracker",
    "notes-app",
    "quiz-app",
    "habit-tracker",
)

SUPPORTED_LAYOUTS: tuple[str, ...] = ("stack", "tabs")

# Regex constraints — these are propagated to JSON Schema via ``Field(pattern=)``
# and therefore enforced by Claude at decode time (no AutoFix retry needed).
HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
ROUTE_PATTERN = r"^/(?:[a-z0-9][a-z0-9\-]*(?:/[a-z0-9][a-z0-9\-]*)*)?$"
APP_NAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9 \-_'!&]{0,49}$"
COMPONENT_TYPE_PATTERN = r"^[A-Z][A-Za-z0-9]{0,49}$"
CAMEL_CASE_PATTERN = r"^[a-z][A-Za-z0-9]{0,39}$"

# Internal compiled versions for the post-validators.
_APP_NAME_RE = re.compile(APP_NAME_PATTERN)


# ---------------------------------------------------------------------------
# Existing user models (unchanged).
# ---------------------------------------------------------------------------


class UserBase(BaseModel):
    email: str
    name: str | None = None


# ---------------------------------------------------------------------------
# Theme — six required hex colors, pattern-constrained at the schema level.
# ---------------------------------------------------------------------------


class Theme(BaseModel):
    """Color theme — six required hex colors matching template defaults."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    primary: str = Field(
        ...,
        pattern=HEX_COLOR_PATTERN,
        title="Primary",
        description="Primary accent color (#RRGGBB)",
    )
    primary_light: str = Field(
        ...,
        alias="primaryLight",
        pattern=HEX_COLOR_PATTERN,
        title="Primary Light",
    )
    background: str = Field(..., pattern=HEX_COLOR_PATTERN, title="Background")
    surface: str = Field(..., pattern=HEX_COLOR_PATTERN, title="Surface")
    text_primary: str = Field(
        ..., alias="textPrimary", pattern=HEX_COLOR_PATTERN, title="Text Primary"
    )
    text_secondary: str = Field(
        ..., alias="textSecondary", pattern=HEX_COLOR_PATTERN, title="Text Secondary"
    )

    @field_validator(
        "primary",
        "primary_light",
        "background",
        "surface",
        "text_primary",
        "text_secondary",
    )
    @classmethod
    def _normalize_hex(cls, v: str) -> str:
        return v.lower()


# ---------------------------------------------------------------------------
# PropEntry — discriminated union of typed key/value pairs.
# Modelled as a list (not a free-form dict) so the JSON Schema is compatible
# with Anthropic structured outputs.
# ---------------------------------------------------------------------------


class _PropEntryBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(..., pattern=CAMEL_CASE_PATTERN, title="Prop Key")


class StringProp(_PropEntryBase):
    type: Literal["string"]
    value: str = Field(..., title="String Value")


class NumberProp(_PropEntryBase):
    type: Literal["number"]
    value: float = Field(..., title="Number Value")


class BooleanProp(_PropEntryBase):
    type: Literal["boolean"]
    value: bool = Field(..., title="Boolean Value")


class StringListProp(_PropEntryBase):
    type: Literal["string_list"]
    value: list[str] = Field(..., title="String List Value")


PropEntry = Annotated[
    StringProp | NumberProp | BooleanProp | StringListProp,
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Data model — list of entities, each with a list of typed fields.
# ---------------------------------------------------------------------------


FieldType = Literal["string", "number", "boolean", "date", "json", "string_list"]


class EntityField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., pattern=CAMEL_CASE_PATTERN, title="Field Name")
    type: FieldType = Field(..., title="Field Type")


class EntityDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., pattern=CAMEL_CASE_PATTERN, title="Entity Name")
    fields: list[EntityField] = Field(..., title="Fields", min_length=1)

    @field_validator("fields")
    @classmethod
    def _check_field_count(cls, v: list[EntityField]) -> list[EntityField]:
        if len(v) > MAX_FIELDS_PER_ENTITY:
            raise ValueError(
                f"too many fields ({len(v)} > {MAX_FIELDS_PER_ENTITY})"
            )
        seen: set[str] = set()
        for f in v:
            if f.name in seen:
                raise ValueError(f"duplicate field name: {f.name!r}")
            seen.add(f.name)
        return v


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------


class Component(BaseModel):
    """A single component instance on a page.

    ``type`` and ``props`` are deterministic (validated against the template
    config). ``jsx`` is the optional AI-generated render body — when present
    it is treated as untrusted input and scanned by the sanitizer before
    being injected into the generated React project.
    """

    model_config = ConfigDict(extra="forbid")

    type: str = Field(
        ...,
        pattern=COMPONENT_TYPE_PATTERN,
        title="Component Type",
        description="PascalCase component name from the template's component list",
    )
    props: list[PropEntry] = Field(
        default_factory=list,
        title="Props",
        description="Typed key/value props for the component",
    )
    jsx: str | None = Field(
        default=None,
        title="JSX Body",
        description=(
            "Optional raw JSX render body. Allowed identifiers: React, "
            "useState, useEffect, useMemo, props, Stores."
        ),
    )

    @field_validator("props")
    @classmethod
    def _check_props(cls, v: list[PropEntry]) -> list[PropEntry]:
        if len(v) > MAX_PROPS_PER_COMPONENT:
            raise ValueError(
                f"too many props ({len(v)} > {MAX_PROPS_PER_COMPONENT})"
            )
        seen: set[str] = set()
        for p in v:
            if p.key in seen:
                raise ValueError(f"duplicate prop key: {p.key!r}")
            seen.add(p.key)
            if isinstance(p, StringProp):
                if len(p.value) > MAX_PROP_STRING_LENGTH:
                    raise ValueError(
                        f"prop {p.key!r} string value exceeds "
                        f"{MAX_PROP_STRING_LENGTH} chars"
                    )
                _check_no_unsafe_url(p.value)
            elif isinstance(p, StringListProp):
                if len(p.value) > 32:
                    raise ValueError(f"prop {p.key!r} list too long")
                for item in p.value:
                    if len(item) > MAX_PROP_STRING_LENGTH:
                        raise ValueError(
                            f"prop {p.key!r} list item exceeds "
                            f"{MAX_PROP_STRING_LENGTH} chars"
                        )
                    _check_no_unsafe_url(item)
        return v

    @field_validator("jsx")
    @classmethod
    def _check_jsx_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > MAX_JSX_LENGTH:
            raise ValueError(
                f"jsx body too long ({len(v)} > {MAX_JSX_LENGTH} chars)"
            )
        return v


def _check_no_unsafe_url(value: str) -> None:
    """Reject ``javascript:`` and ``data:text/html`` URL schemes in any string field."""
    lowered = value.strip().lower()
    if lowered.startswith(("javascript:", "vbscript:")):
        raise ValueError(f"unsafe URL scheme in string value: {value!r}")
    if lowered.startswith(
        ("data:text/html", "data:application/javascript")
    ):
        raise ValueError(f"unsafe data: URL in string value: {value!r}")


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------


class Page(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route: str = Field(..., pattern=ROUTE_PATTERN, title="Route")
    layout: Literal["stack", "tabs"] = Field("stack", title="Layout")
    title: str | None = Field(default=None, title="Page Title")
    components: list[Component] = Field(..., title="Components", min_length=1)

    @field_validator("components")
    @classmethod
    def _check_component_count(cls, v: list[Component]) -> list[Component]:
        if len(v) > MAX_COMPONENTS_PER_PAGE:
            raise ValueError(
                f"too many components on page ({len(v)} > {MAX_COMPONENTS_PER_PAGE})"
            )
        return v

    @field_validator("title")
    @classmethod
    def _check_title_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 80:
            raise ValueError("page title too long (>80 chars)")
        return v


# ---------------------------------------------------------------------------
# AppSpec — root model
# ---------------------------------------------------------------------------


TemplateId = Literal[
    "todo-list",
    "expense-tracker",
    "notes-app",
    "quiz-app",
    "habit-tracker",
]


class AppSpec(BaseModel):
    """Root hybrid app specification.

    The JSON form of this model is the contract returned by Claude (enforced
    by ``output_config.format``) and consumed by ``appio_codegen.CodeGenerator``.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    template: TemplateId = Field(..., title="Template Id")
    name: str = Field(..., pattern=APP_NAME_PATTERN, title="App Name")
    theme: Theme = Field(..., title="Theme")
    pages: list[Page] = Field(..., title="Pages", min_length=1)
    data_model: list[EntityDef] = Field(
        default_factory=list,
        alias="dataModel",
        title="Data Model",
        description="List of entities with typed fields",
    )

    @field_validator("name")
    @classmethod
    def _check_name(cls, v: str) -> str:
        v = v.strip()
        if not _APP_NAME_RE.match(v):
            raise ValueError(f"invalid app name: {v!r}")
        return v

    @field_validator("pages")
    @classmethod
    def _check_page_count(cls, v: list[Page]) -> list[Page]:
        if len(v) > MAX_PAGES:
            raise ValueError(f"too many pages ({len(v)} > {MAX_PAGES})")
        return v

    @field_validator("data_model")
    @classmethod
    def _check_entity_count(cls, v: list[EntityDef]) -> list[EntityDef]:
        if len(v) > MAX_DATA_MODEL_ENTITIES:
            raise ValueError(
                f"too many entities ({len(v)} > {MAX_DATA_MODEL_ENTITIES})"
            )
        seen: set[str] = set()
        for e in v:
            if e.name in seen:
                raise ValueError(f"duplicate entity name: {e.name!r}")
            seen.add(e.name)
        return v

    @model_validator(mode="after")
    def _check_unique_routes(self) -> AppSpec:
        routes = [p.route for p in self.pages]
        duplicates = {r for r in routes if routes.count(r) > 1}
        if duplicates:
            raise ValueError(f"duplicate page routes: {sorted(duplicates)}")
        if "/" not in routes:
            raise ValueError("at least one page must use the root route '/'")
        return self


# ---------------------------------------------------------------------------
# JSON Schema export — for Claude API output_config.format
# ---------------------------------------------------------------------------


def _scrub_for_anthropic(node: object) -> object:
    """Walk a JSON Schema and rewrite Pydantic output for Anthropic compatibility.

    Three transformations are applied:

    1. Pydantic v2 emits ``oneOf`` + ``discriminator`` for
       ``Field(discriminator=)`` discriminated unions, but Anthropic's
       structured outputs subset only accepts ``anyOf``. The two are
       functionally equivalent for our purposes (each branch is uniquely
       identified by its const ``type`` field), so we rewrite ``oneOf`` →
       ``anyOf`` and drop the ``discriminator`` metadata.

    2. ``pattern`` constraints are stripped. Anthropic technically supports
       a regex subset, but complex schemas with many patterns hit a
       *Grammar compilation timed out* error from the constrained-decoding
       compiler. We instead append the pattern to the field's ``description``
       so Claude still sees the constraint as a hint, and rely on Pydantic
       to enforce it post-decode (the AutoFix loop catches the rest).

    3. Pydantic-emitted ``"default": null`` markers next to ``anyOf: [string,
       null]`` optional fields are left alone — Anthropic accepts ``default``.
    """
    if isinstance(node, dict):
        out: dict = {}
        pattern_value: str | None = None
        for k, v in node.items():
            if k == "discriminator":
                continue
            if k == "oneOf":
                out["anyOf"] = _scrub_for_anthropic(v)
                continue
            if k == "pattern":
                pattern_value = v if isinstance(v, str) else None
                continue
            out[k] = _scrub_for_anthropic(v)
        if pattern_value is not None:
            existing = out.get("description", "")
            hint = f"Must match regex: {pattern_value}"
            out["description"] = (
                f"{existing}\n{hint}".strip() if existing else hint
            )
        return out
    if isinstance(node, list):
        return [_scrub_for_anthropic(item) for item in node]
    return node


def app_spec_json_schema() -> dict:
    """Return the JSON Schema describing :class:`AppSpec`.

    Use this as ``output_config.format = {"type": "json_schema", "schema": ...}``
    when calling the Claude API. The schema is generated from the same Pydantic
    model that validates the response, so structure stays in sync.

    The result is the *validation*-mode schema (matching the input shape Claude
    must produce). Two passes are applied:

    1. Pydantic produces the raw schema with aliases (camelCase) preserved.
    2. :func:`_scrub_for_anthropic` rewrites Pydantic-emitted constructs that
       Anthropic's structured-outputs subset rejects (notably ``oneOf`` and
       ``discriminator``). Length/count limits never reach the schema in the
       first place because they're enforced by Pydantic validators, not
       ``Field(...)`` constraints.
    """
    raw = AppSpec.model_json_schema(by_alias=True)
    schema = _scrub_for_anthropic(raw)
    assert isinstance(schema, dict)
    schema.setdefault("$schema", "https://json-schema.org/draft/2020-12/schema")
    schema["title"] = "AppSpec"
    return schema


# ---------------------------------------------------------------------------
# Backwards-compat alias (T2.1 stub used ``AppSpecBase``).
# ---------------------------------------------------------------------------

AppSpecBase = AppSpec

# Backwards-compat exported tuple (some older callers import this name).
SUPPORTED_TEMPLATES = SUPPORTED_TEMPLATES_TUPLE


__all__ = [
    "MAX_PAGES",
    "MAX_COMPONENTS_PER_PAGE",
    "MAX_JSX_LENGTH",
    "MAX_PROP_STRING_LENGTH",
    "MAX_APP_NAME_LENGTH",
    "MAX_PROPS_PER_COMPONENT",
    "MAX_DATA_MODEL_ENTITIES",
    "MAX_FIELDS_PER_ENTITY",
    "SUPPORTED_TEMPLATES",
    "SUPPORTED_TEMPLATES_TUPLE",
    "SUPPORTED_LAYOUTS",
    "HEX_COLOR_PATTERN",
    "ROUTE_PATTERN",
    "APP_NAME_PATTERN",
    "COMPONENT_TYPE_PATTERN",
    "CAMEL_CASE_PATTERN",
    "TemplateId",
    "FieldType",
    "UserBase",
    "Theme",
    "StringProp",
    "NumberProp",
    "BooleanProp",
    "StringListProp",
    "PropEntry",
    "EntityField",
    "EntityDef",
    "Component",
    "Page",
    "AppSpec",
    "AppSpecBase",
    "app_spec_json_schema",
]
