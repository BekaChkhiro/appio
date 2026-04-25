"""Builder worker: Fly Machine orchestration + esbuild + R2 upload.

T2.3 — implements the production build pipeline for AI-generated PWAs.

The builder takes a generated React project (produced by ``appio_codegen``)
and turns it into a static PWA bundle deployed to Cloudflare R2 behind a
versioned subdomain. The pipeline runs inside a Firecracker microVM
(Fly.io Machine) wrapped in nsjail for hardware + process isolation.

Public surface:

- :class:`Orchestrator` — high-level "build & deploy" entry point used by
  the API and the Dramatiq actor.
- :func:`build_pwa` — Dramatiq actor (registered when a Redis broker is
  configured via :data:`BROKER_AVAILABLE`).
- :class:`BuildConfig` — environment-driven settings.
- :class:`BuildResult` / :class:`BuildError` — return + error types.
"""

from .autofix import AutoFixError, AutoFixResult, attempt_autofix
from .config import BuildConfig
from .orchestrator import BuildError, BuildResult, Orchestrator
from .scanner import ScanError, scan_project
from .validation import OutputValidationError, validate_output

__all__ = [
    "AutoFixError",
    "AutoFixResult",
    "BuildConfig",
    "BuildError",
    "BuildResult",
    "Orchestrator",
    "OutputValidationError",
    "ScanError",
    "attempt_autofix",
    "scan_project",
    "validate_output",
]
