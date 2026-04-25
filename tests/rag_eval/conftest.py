from __future__ import annotations

import pytest


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "rag_real: hits live Neon + Voyage; requires VOYAGE_API_KEY + DATABASE_URL",
    )
