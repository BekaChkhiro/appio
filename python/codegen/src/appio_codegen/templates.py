"""Template registry — loads ``template.config.json`` files from disk."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path  # noqa: TC003

__all__ = ["TemplateConfig", "load_template_config", "TemplateRegistry"]


@dataclass(frozen=True)
class TemplateConfig:
    """Parsed ``template.config.json`` for one template."""

    id: str
    display_name: str
    description: str
    components: frozenset[str]
    layouts: frozenset[str]
    data_model: dict[str, dict[str, str]]
    default_theme: dict[str, str]
    prop_schemas: dict[str, dict[str, str]]
    max_pages: int
    max_components_per_page: int
    # ``constraints.storageBackend`` — "localStorage" (Zustand persist) or
    # "convex" (tenant-isolated Convex). Drives two generator branches:
    # Zustand path overlays ``src/stores/`` + writes a barrel; Convex path
    # overlays ``convex/`` + wraps index.tsx with ConvexClientProvider.
    storage_backend: str
    template_dir: Path

    @property
    def base_dir(self) -> Path:
        return self.template_dir.parent / "base"


def load_template_config(template_dir: Path) -> TemplateConfig:
    """Read ``template.config.json`` from a template directory.

    The directory must contain ``template.config.json`` plus a ``src/`` tree
    with ``App.tsx`` and ``stores/``.
    """
    config_path = template_dir / "template.config.json"
    if not config_path.is_file():
        raise FileNotFoundError(f"missing template config: {config_path}")

    raw = json.loads(config_path.read_text(encoding="utf-8"))

    constraints = raw.get("constraints", {})
    return TemplateConfig(
        id=raw["id"],
        display_name=raw.get("displayName", raw["id"]),
        description=raw.get("description", ""),
        components=frozenset(raw.get("components", [])),
        layouts=frozenset(raw.get("layouts", ["stack"])),
        data_model=raw.get("dataModel", {}),
        default_theme=raw.get("defaultTheme", {}),
        prop_schemas=raw.get("propSchemas", {}),
        max_pages=int(constraints.get("maxPages", 5)),
        max_components_per_page=int(constraints.get("maxComponentsPerPage", 6)),
        storage_backend=str(constraints.get("storageBackend", "localStorage")),
        template_dir=template_dir,
    )


class TemplateRegistry:
    """Indexes a ``packages/templates`` directory."""

    def __init__(self, templates_root: Path):
        self.templates_root = templates_root.resolve()
        if not self.templates_root.is_dir():
            raise FileNotFoundError(
                f"templates root does not exist: {self.templates_root}"
            )

    @cache  # noqa: B019 - cache is per-instance via lru_cache wrapper
    def get(self, template_id: str) -> TemplateConfig:
        template_dir = self.templates_root / template_id
        if not template_dir.is_dir():
            raise FileNotFoundError(
                f"unknown template {template_id!r} (looked in {template_dir})"
            )
        return load_template_config(template_dir)

    def base_dir(self) -> Path:
        return self.templates_root / "base"
