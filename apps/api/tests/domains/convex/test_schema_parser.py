"""Unit tests for the Convex schema.ts parser (T3.9)."""

from __future__ import annotations

import pytest


def _parse(content: str) -> list[str]:
    from apps.api.domains.convex.schema_parser import extract_table_names
    return extract_table_names(content)


class TestExtractTableNames:
    def test_extracts_single_table(self) -> None:
        schema = (
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "export default defineSchema({\n"
            "  items: defineTable({ tenantId: v.string() }),\n"
            "});\n"
        )
        assert _parse(schema) == ["items"]

    def test_extracts_multiple_tables_in_order(self) -> None:
        schema = (
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "export default defineSchema({\n"
            "  tasks: defineTable({ tenantId: v.string() }),\n"
            "  notes: defineTable({ tenantId: v.string() }),\n"
            "  comments: defineTable({ tenantId: v.string() }),\n"
            "  attachments: defineTable({ tenantId: v.string() }),\n"
            "});\n"
        )
        assert _parse(schema) == ["tasks", "notes", "comments", "attachments"]

    def test_handles_comments_and_whitespace(self) -> None:
        schema = (
            "// Top of file comment\n"
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "\n"
            "// Some table docs\n"
            "export default defineSchema({\n"
            "  items:   defineTable({ tenantId: v.string() }),\n"
            "});\n"
        )
        assert _parse(schema) == ["items"]

    def test_raises_value_error_on_missing_define_schema(self) -> None:
        with pytest.raises(ValueError, match="defineSchema"):
            _parse("const x = defineTable({ tenantId: v.string() });\n")

    def test_ignores_table_definitions_in_string_literals(self) -> None:
        # A string containing defineTable( should not be counted as a table.
        schema = (
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "const doc = 'foo: defineTable( is just a string';\n"
            "export default defineSchema({\n"
            "  realTable: defineTable({ tenantId: v.string() }),\n"
            "});\n"
        )
        # The string literal line starts with `const doc = ...` so the regex
        # (`^\s*(\w+):\s*defineTable\(`) won't match it (not at start of line
        # with just whitespace before the identifier). This test confirms that.
        result = _parse(schema)
        assert "realTable" in result
        # Ensure 'foo' captured from the string literal is not present.
        assert "foo" not in result

    def test_handles_tabs_and_mixed_indentation(self) -> None:
        schema = (
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "export default defineSchema({\n"
            "\ttasks: defineTable({ tenantId: v.string() }),\n"
            "  notes: defineTable({ tenantId: v.string() }),\n"
            "});\n"
        )
        assert _parse(schema) == ["tasks", "notes"]
