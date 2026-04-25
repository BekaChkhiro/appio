"""Convex schema.ts parser — extracts table names from defineTable declarations (T3.9)."""

from __future__ import annotations

import re

# Matches `<tableName>: defineTable(` at the start of a line (with leading whitespace).
_DEFINE_TABLE_RE = re.compile(r"^\s*(\w+):\s*defineTable\(", re.MULTILINE)


def extract_table_names(schema_ts_content: str) -> list[str]:
    """Parse defineTable(...) occurrences in a Convex schema.ts.

    Matches `<tableName>: defineTable(` preserving order.
    Raises ValueError if `defineSchema` is not found in the content.
    """
    if "defineSchema" not in schema_ts_content:
        raise ValueError(
            "schema.ts does not contain `defineSchema` — not a valid Convex schema file"
        )
    tables = _DEFINE_TABLE_RE.findall(schema_ts_content)
    if not tables:
        raise ValueError(
            "schema.ts defines no tables (found defineSchema but no defineTable calls)"
        )
    return tables
