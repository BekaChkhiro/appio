"""Tests for the AppSpec Pydantic schema (T2.2)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from appio_shared.schemas import (
    MAX_COMPONENTS_PER_PAGE,
    MAX_PAGES,
    AppSpec,
    Component,
    Page,
    Theme,
    app_spec_json_schema,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _theme() -> dict:
    return {
        "primary": "#10b981",
        "primaryLight": "#34d399",
        "background": "#f0fdf4",
        "surface": "#ffffff",
        "textPrimary": "#022c22",
        "textSecondary": "#6b7280",
    }


def _minimal_spec() -> dict:
    return {
        "template": "expense-tracker",
        "name": "My Budget",
        "theme": _theme(),
        "pages": [
            {
                "route": "/",
                "layout": "tabs",
                "title": "Home",
                "components": [
                    {
                        "type": "TransactionList",
                        "props": [
                            {"key": "groupBy", "type": "string", "value": "date"}
                        ],
                        "jsx": '<div className="space-y-2">items</div>',
                    }
                ],
            }
        ],
        "dataModel": [
            {
                "name": "transaction",
                "fields": [
                    {"name": "amount", "type": "number"},
                    {"name": "category", "type": "string"},
                ],
            }
        ],
    }


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_minimal_spec_validates() -> None:
    spec = AppSpec.model_validate(_minimal_spec())
    assert spec.template == "expense-tracker"
    assert spec.name == "My Budget"
    assert spec.theme.primary == "#10b981"
    assert spec.pages[0].route == "/"
    first_prop = spec.pages[0].components[0].props[0]
    assert first_prop.key == "groupBy"
    assert first_prop.value == "date"
    assert spec.data_model[0].name == "transaction"


def test_alias_round_trip() -> None:
    """``primaryLight`` (camelCase) and ``primary_light`` (snake_case) both work."""
    data = _minimal_spec()
    spec = AppSpec.model_validate(data)
    dumped = spec.model_dump(by_alias=True)
    assert "primaryLight" in dumped["theme"]
    assert "dataModel" in dumped


# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_color",
    ["red", "#abc", "#1234567", "rgb(0,0,0)", "#GGGGGG", ""],
)
def test_theme_rejects_invalid_hex(bad_color: str) -> None:
    bad = _theme()
    bad["primary"] = bad_color
    with pytest.raises(ValidationError):
        Theme.model_validate(bad)


def test_theme_normalizes_to_lowercase() -> None:
    t = Theme.model_validate(
        {
            "primary": "#ABCDEF",
            "primaryLight": "#FFFFFF",
            "background": "#000000",
            "surface": "#FFFFFF",
            "textPrimary": "#111111",
            "textSecondary": "#222222",
        }
    )
    assert t.primary == "#abcdef"
    assert t.primary_light == "#ffffff"


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------


def test_component_type_must_be_pascal_case() -> None:
    with pytest.raises(ValidationError):
        Component.model_validate({"type": "transactionList"})
    with pytest.raises(ValidationError):
        Component.model_validate({"type": "Transaction-List"})
    Component.model_validate({"type": "TransactionList"})


def test_component_rejects_unsafe_string_props() -> None:
    with pytest.raises(ValidationError):
        Component.model_validate(
            {
                "type": "Btn",
                "props": [
                    {"key": "href", "type": "string", "value": "javascript:alert(1)"}
                ],
            }
        )


def test_component_rejects_invalid_prop_key() -> None:
    with pytest.raises(ValidationError):
        Component.model_validate(
            {
                "type": "Btn",
                "props": [{"key": "On Click", "type": "string", "value": "x"}],
            }
        )


def test_component_jsx_too_long() -> None:
    long = "a" * 5000
    with pytest.raises(ValidationError):
        Component.model_validate({"type": "Btn", "jsx": long})


def test_component_props_typed_correctly() -> None:
    comp = Component.model_validate(
        {
            "type": "Btn",
            "props": [
                {"key": "label", "type": "string", "value": "Click"},
                {"key": "count", "type": "number", "value": 3},
                {"key": "disabled", "type": "boolean", "value": False},
                {"key": "tags", "type": "string_list", "value": ["a", "b"]},
            ],
        }
    )
    assert len(comp.props) == 4
    assert comp.props[0].value == "Click"
    assert comp.props[1].value == 3
    assert comp.props[2].value is False
    assert comp.props[3].value == ["a", "b"]


def test_component_rejects_duplicate_prop_keys() -> None:
    with pytest.raises(ValidationError, match="duplicate prop key"):
        Component.model_validate(
            {
                "type": "Btn",
                "props": [
                    {"key": "label", "type": "string", "value": "A"},
                    {"key": "label", "type": "string", "value": "B"},
                ],
            }
        )


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------


def test_page_rejects_bad_route() -> None:
    with pytest.raises(ValidationError):
        Page.model_validate(
            {"route": "home", "components": [{"type": "Btn"}]}
        )
    with pytest.raises(ValidationError):
        Page.model_validate(
            {"route": "/Home", "components": [{"type": "Btn"}]}
        )


def test_page_rejects_too_many_components() -> None:
    components = [{"type": f"C{i}"} for i in range(MAX_COMPONENTS_PER_PAGE + 1)]
    with pytest.raises(ValidationError):
        Page.model_validate({"route": "/", "components": components})


# ---------------------------------------------------------------------------
# AppSpec
# ---------------------------------------------------------------------------


def test_app_spec_requires_root_route() -> None:
    bad = _minimal_spec()
    bad["pages"][0]["route"] = "/dashboard"
    with pytest.raises(ValidationError, match="root route"):
        AppSpec.model_validate(bad)


def test_app_spec_rejects_duplicate_routes() -> None:
    bad = _minimal_spec()
    bad["pages"].append(
        {
            "route": "/",
            "layout": "tabs",
            "components": [{"type": "BalanceCard"}],
        }
    )
    with pytest.raises(ValidationError, match="duplicate"):
        AppSpec.model_validate(bad)


def test_app_spec_rejects_unknown_template() -> None:
    bad = _minimal_spec()
    bad["template"] = "nonexistent-template"
    with pytest.raises(ValidationError):
        AppSpec.model_validate(bad)


def test_app_spec_rejects_too_many_pages() -> None:
    bad = _minimal_spec()
    bad["pages"] = [
        {
            "route": f"/p{i}" if i else "/",
            "layout": "tabs",
            "components": [{"type": "BalanceCard"}],
        }
        for i in range(MAX_PAGES + 1)
    ]
    with pytest.raises(ValidationError):
        AppSpec.model_validate(bad)


def test_app_spec_rejects_invalid_data_model_field_type() -> None:
    bad = _minimal_spec()
    bad["dataModel"] = [
        {
            "name": "transaction",
            "fields": [{"name": "amount", "type": "decimal"}],
        }
    ]
    with pytest.raises(ValidationError):
        AppSpec.model_validate(bad)


def test_app_spec_rejects_extra_keys() -> None:
    bad = _minimal_spec()
    bad["secret"] = "leak"
    with pytest.raises(ValidationError):
        AppSpec.model_validate(bad)


# ---------------------------------------------------------------------------
# JSON Schema export — must round-trip through Anthropic transform_schema
# without losing props or data_model.
# ---------------------------------------------------------------------------


def test_app_spec_json_schema_shape() -> None:
    schema = app_spec_json_schema()
    assert schema["title"] == "AppSpec"
    defs = schema.get("$defs", {})
    assert "Theme" in defs
    assert "Page" in defs
    assert "Component" in defs
    assert {"template", "name", "theme", "pages"}.issubset(
        set(schema.get("required", []))
    )
    theme_props = defs["Theme"]["properties"]
    assert "primaryLight" in theme_props
    assert "textPrimary" in theme_props
    # Patterns are stripped from the schema (Anthropic grammar timeout) and
    # rolled into the description as a hint for Claude.
    assert "regex" in theme_props["primary"]["description"].lower()
    # Template must be an enum, not a free-form string.
    template_schema = schema["properties"]["template"]
    assert "enum" in template_schema
    assert "expense-tracker" in template_schema["enum"]


def test_app_spec_no_unsupported_keywords() -> None:
    """Anthropic structured outputs forbid maxLength/maxItems/minimum/etc.,
    and also reject ``oneOf`` and ``discriminator``.

    Walk the schema and ensure none of those keywords appear anywhere.
    """
    schema = app_spec_json_schema()
    forbidden = {
        "maxLength",
        "minLength",
        "maxItems",
        "maximum",
        "minimum",
        "exclusiveMaximum",
        "exclusiveMinimum",
        "multipleOf",
        "oneOf",  # Anthropic supports anyOf only
        "discriminator",  # Pydantic emits this alongside oneOf
        "pattern",  # stripped — moved into description (grammar timeout)
    }

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in forbidden:
                    raise AssertionError(
                        f"forbidden JSON Schema keyword {k!r} present in: {node}"
                    )
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(schema)


def test_app_spec_no_dynamic_additional_properties() -> None:
    """Anthropic requires ``additionalProperties`` to be ``false`` (not a sub-schema).

    Walk the schema and assert every ``additionalProperties`` is exactly False
    (or absent).
    """
    schema = app_spec_json_schema()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if "additionalProperties" in node:
                value = node["additionalProperties"]
                assert value is False, (
                    f"additionalProperties must be False, got {value!r}"
                )
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(schema)


def test_app_spec_survives_anthropic_transform_schema() -> None:
    """End-to-end check: the schema passes Anthropic's strict transformer
    AND the result still contains props/data_model fields with non-empty
    structure (proving the dict-style additionalProperties bug is fixed)."""
    pytest.importorskip("anthropic")
    from anthropic import transform_schema

    schema = app_spec_json_schema()
    transformed = transform_schema(schema)

    # Component.props must be a real array of discriminated objects, not the
    # empty `{properties: {}, additionalProperties: false}` that the old
    # dict-based schema produced.
    component_def = transformed["$defs"]["Component"]
    props_schema = component_def["properties"]["props"]
    assert props_schema["type"] == "array", props_schema
    assert "items" in props_schema, "props array must define an item schema"

    # AppSpec.dataModel must also be a real array.
    data_model_schema = transformed["properties"]["dataModel"]
    assert data_model_schema["type"] == "array", data_model_schema
    assert "items" in data_model_schema
