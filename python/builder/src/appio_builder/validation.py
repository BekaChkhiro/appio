"""Output validation for built PWA bundles.

After esbuild produces ``dist/``, we walk it and reject the build if it
contains any of:

- a file whose extension is not in :data:`appio_shared.constants.ALLOWED_BUILD_EXTENSIONS`
- a file larger than :data:`appio_shared.constants.MAX_FILE_SIZE_BYTES`
- a symlink (regular files only — symlinks could escape the build dir
  during R2 upload)
- the absence of ``index.html`` or ``sw.js`` (sanity check that the build
  actually ran)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from appio_shared.constants import ALLOWED_BUILD_EXTENSIONS, MAX_FILE_SIZE_BYTES

__all__ = [
    "BuildArtifact",
    "OutputValidationError",
    "ValidatedOutput",
    "validate_output",
]


_REQUIRED_FILES: frozenset[str] = frozenset({"index.html", "sw.js", "manifest.json"})


class OutputValidationError(ValueError):
    """Raised when the build output fails validation."""


@dataclass(frozen=True, slots=True)
class BuildArtifact:
    """A single file that survived validation. ``rel_path`` is POSIX-style."""

    abs_path: Path
    rel_path: str
    size: int
    content_type: str


@dataclass(frozen=True, slots=True)
class ValidatedOutput:
    artifacts: tuple[BuildArtifact, ...]
    total_bytes: int

    @property
    def file_count(self) -> int:
        return len(self.artifacts)


# MIME types we set on R2 uploads. Cloudflare Workers/CDNs will respect these.
_MIME_TYPES: dict[str, str] = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


def _content_type_for(path: Path) -> str:
    return _MIME_TYPES.get(path.suffix, "application/octet-stream")


def validate_output(dist_dir: Path) -> ValidatedOutput:
    """Validate the contents of ``dist_dir`` and return an artifact list.

    The returned :class:`ValidatedOutput` is what the orchestrator hands to
    :class:`R2Client` for upload — validation and discovery are deliberately
    fused so the upload step doesn't get a chance to see anything we
    haven't approved.
    """
    dist_dir = Path(dist_dir)
    if not dist_dir.is_dir():
        raise OutputValidationError(f"build output directory missing: {dist_dir}")

    artifacts: list[BuildArtifact] = []
    total_bytes = 0
    seen_required: set[str] = set()

    for path in sorted(dist_dir.rglob("*")):
        # Reject symlinks before any other check — a hostile symlink can
        # confuse subsequent stat() calls.
        if path.is_symlink():
            raise OutputValidationError(
                f"symlinks are not allowed in build output: {path.relative_to(dist_dir)}"
            )

        if path.is_dir():
            continue

        if not path.is_file():
            raise OutputValidationError(
                f"unexpected non-regular file in build output: {path.relative_to(dist_dir)}"
            )

        rel = path.relative_to(dist_dir)
        rel_str = rel.as_posix()

        if path.suffix not in ALLOWED_BUILD_EXTENSIONS:
            raise OutputValidationError(
                f"disallowed file type in build output: {rel_str} "
                f"(extension {path.suffix!r}, allowed: {sorted(ALLOWED_BUILD_EXTENSIONS)})"
            )

        size = path.stat().st_size
        if size > MAX_FILE_SIZE_BYTES:
            raise OutputValidationError(
                f"file exceeds {MAX_FILE_SIZE_BYTES} bytes: {rel_str} ({size} bytes)"
            )
        if size == 0:
            raise OutputValidationError(f"empty file in build output: {rel_str}")

        artifacts.append(
            BuildArtifact(
                abs_path=path,
                rel_path=rel_str,
                size=size,
                content_type=_content_type_for(path),
            )
        )
        total_bytes += size

        if rel.name in _REQUIRED_FILES and rel.parent == Path("."):
            seen_required.add(rel.name)

    missing = _REQUIRED_FILES - seen_required
    if missing:
        raise OutputValidationError(
            f"build output is missing required files: {sorted(missing)}"
        )

    if not artifacts:
        raise OutputValidationError("build output is empty")

    return ValidatedOutput(artifacts=tuple(artifacts), total_bytes=total_bytes)
