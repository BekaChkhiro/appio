"""Lightweight preview generation.

The preview system does a fast server-side esbuild transpile (~50 ms) of the
generated React project with **Preact compat import maps** instead of bundling
the full React runtime.  The result is a temporary static page on R2.

Preview differs from a production build:

- No Tailwind processing (raw CSS only — fast)
- No service worker, no manifest
- Uses Preact compat via import maps (smaller, faster)
- Uploaded under ``_preview/{app_id}/{token}/`` (temporary, cleaned up after 24 h)
- No KV pointer update — the URL includes the full path
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from appio_codegen import CodeGenerator
from appio_codegen.generator import CodegenError
from appio_codegen.sanitizer import UnsafeContentError
from appio_shared.schemas import AppSpec

from .config import BuildConfig
from .local_runner import LocalRunnerError, run_esbuild
from .r2 import R2Client, R2Error
from .scanner import ScanError, scan_project

__all__ = ["PreviewError", "PreviewResult", "generate_preview"]

log = logging.getLogger(__name__)


class PreviewError(RuntimeError):
    """Raised when preview generation fails."""

    def __init__(self, message: str, *, stage: str) -> None:
        super().__init__(message)
        self.stage = stage


@dataclass(frozen=True, slots=True)
class PreviewResult:
    preview_url: str
    r2_prefix: str
    duration_seconds: float


_PREVIEW_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>{app_name} — Preview</title>
  <style>
    :root {{
      --color-primary: {primary};
      --color-primary-light: {primary_light};
      --color-background: {background};
      --color-surface: {surface};
      --color-text-primary: {text_primary};
      --color-text-secondary: {text_secondary};
    }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--color-background); color: var(--color-text-primary); }}
    #root {{ min-height: 100dvh; }}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
  {{
    "imports": {{
      "react": "https://esm.sh/preact@10/compat",
      "react-dom": "https://esm.sh/preact@10/compat",
      "react-dom/client": "https://esm.sh/preact@10/compat",
      "react/jsx-runtime": "https://esm.sh/preact@10/jsx-runtime"
    }}
  }}
  </script>
  <script type="module" src="{entry_js}"></script>
</body>
</html>
"""

_PREVIEW_ESBUILD_CONFIG = """\
import {{ build }} from "esbuild";

const result = await build({{
  entryPoints: ["src/index.tsx"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: false,
  target: ["es2020"],
  jsx: "automatic",
  jsxImportSource: "react",
  loader: {{
    ".tsx": "tsx",
    ".ts": "ts",
    ".jsx": "jsx",
    ".js": "js",
    ".svg": "dataurl",
    ".png": "dataurl",
    ".webp": "dataurl",
    ".css": "empty",
  }},
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: {{
    "process.env.NODE_ENV": '"production"',
  }},
  entryNames: "[name]",
  metafile: true,
}});

console.log(JSON.stringify(result.metafile));
"""


def _preview_token(app_id: str) -> str:
    """Generate a short unique token for preview URL path."""
    raw = f"{app_id}-{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def _write_preview_html(
    dist_dir: Path, spec: AppSpec, entry_js: str,
) -> None:
    """Write the preview index.html using import maps instead of bundled React."""
    html = _PREVIEW_HTML_TEMPLATE.format(
        app_name=spec.name,
        primary=spec.theme.primary,
        primary_light=spec.theme.primaryLight,
        background=spec.theme.background,
        surface=spec.theme.surface,
        text_primary=spec.theme.textPrimary,
        text_secondary=spec.theme.textSecondary,
        entry_js=entry_js,
    )
    (dist_dir / "index.html").write_text(html, encoding="utf-8")


async def generate_preview(
    spec: AppSpec,
    *,
    app_id: str,
    config: BuildConfig,
    codegen: CodeGenerator | None = None,
    public_host: str = "appiousercontent.com",
) -> PreviewResult:
    """Generate a fast preview and upload to R2.

    Returns the public preview URL.  The preview is temporary — a separate
    cleanup job deletes ``_preview/`` objects older than 24 hours.
    """
    start = time.monotonic()
    cg = codegen or CodeGenerator(config.templates_dir)
    token = _preview_token(app_id)

    with tempfile.TemporaryDirectory(prefix=f"appio-preview-{app_id}-") as tmp:
        project_dir = Path(tmp) / "project"

        # 1. Code generation --------------------------------------------------
        try:
            await asyncio.to_thread(cg.generate, spec, project_dir)
        except (UnsafeContentError, CodegenError) as exc:
            raise PreviewError(str(exc), stage="codegen") from exc

        # 2. Pre-build scan ----------------------------------------------------
        try:
            await asyncio.to_thread(scan_project, project_dir)
        except ScanError as exc:
            raise PreviewError(str(exc), stage="scan") from exc

        # 3. Write preview esbuild config (lightweight, no Tailwind) -----------
        preview_config = project_dir / "esbuild.preview.mjs"
        preview_config.write_text(_PREVIEW_ESBUILD_CONFIG, encoding="utf-8")

        # 4. Run esbuild (local only for preview — fast enough) ----------------
        try:
            result = await asyncio.to_thread(
                run_esbuild,
                project_dir,
                config_script=preview_config,
                timeout_seconds=15,
            )
            dist_dir = result.dist_dir
        except LocalRunnerError as exc:
            raise PreviewError(
                f"Preview build failed: {exc}", stage="build"
            ) from exc

        # 5. Write preview HTML with import maps --------------------------------
        # The esbuild output with external react produces dist/index.js
        entry_js = "/index.js"
        _write_preview_html(dist_dir, spec, entry_js)

        # 6. Upload to R2 under _preview/ prefix --------------------------------
        r2_prefix = f"_preview/{app_id}/{token}"
        try:
            _upload_preview(dist_dir, config, r2_prefix)
        except R2Error as exc:
            raise PreviewError(str(exc), stage="upload") from exc

    duration = time.monotonic() - start
    preview_url = f"https://{app_id}.{public_host}/_preview/{token}/"

    log.info(
        "preview_generated",
        extra={
            "app_id": app_id,
            "duration_s": round(duration, 3),
            "url": preview_url,
        },
    )

    return PreviewResult(
        preview_url=preview_url,
        r2_prefix=r2_prefix,
        duration_seconds=duration,
    )


def _upload_preview(
    dist_dir: Path, config: BuildConfig, prefix: str,
) -> None:
    """Upload preview artifacts to R2 under the given prefix."""
    client = R2Client(
        account_id=config.r2_account_id,
        access_key=config.r2_access_key,
        secret_key=config.r2_secret_key,
        bucket=config.r2_bucket,
        endpoint_url=config.r2_endpoint,
    )

    import mimetypes

    for file_path in dist_dir.rglob("*"):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(dist_dir)
        key = f"{prefix}/{rel}"
        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        try:
            with file_path.open("rb") as fh:
                client._s3.put_object(
                    Bucket=client.bucket,
                    Key=key,
                    Body=fh.read(),
                    ContentType=content_type,
                    CacheControl="no-cache, must-revalidate",
                )
        except Exception as exc:
            raise R2Error(f"failed to upload preview {key}: {exc}") from exc
