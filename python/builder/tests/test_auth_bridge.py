"""T2.4 Firebase Auth → Convex JWT bridge.

Structural guards so a careless refactor can't silently disconnect the
bridge. The full runtime check (Google/Apple OAuth → Convex authed query)
lives in the template README's acceptance script; this module keeps the
static contract intact in CI.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
BASE = REPO_ROOT / "packages" / "templates" / "base"
TODO = REPO_ROOT / "packages" / "templates" / "todo-list-convex"


# ---------------------------------------------------------------------------
# Convex backend: auth.config.ts + tenant helpers
# ---------------------------------------------------------------------------


def test_auth_config_declares_firebase_issuer() -> None:
    """auth.config.ts must validate Firebase ID tokens via securetoken issuer."""
    body = (BASE / "convex" / "auth.config.ts").read_text(encoding="utf-8")
    assert "securetoken.google.com" in body, "Firebase issuer missing"
    assert "FIREBASE_PROJECT_ID" in body, "project id must be injected at build"
    # applicationID locks the audience to the same project
    assert re.search(r"applicationID\s*:", body), "applicationID (audience) missing"


def test_tenant_helpers_resolve_identity_subject() -> None:
    """tenantQuery / tenantMutation must derive tenantId from identity.subject."""
    body = (BASE / "convex" / "_helpers.ts").read_text(encoding="utf-8")
    assert "ctx.auth.getUserIdentity()" in body
    assert "identity.subject" in body
    for name in ("tenantQuery", "tenantMutation", "tenantAction"):
        assert f"export function {name}" in body, f"{name} missing"


# ---------------------------------------------------------------------------
# Client-side bridge: ConvexClientProvider + useAuth
# ---------------------------------------------------------------------------


def test_bridge_lives_in_base_template() -> None:
    """ConvexClientProvider must ship with base so every Convex app inherits it."""
    provider = BASE / "src" / "ConvexClientProvider.tsx"
    assert provider.exists(), "bridge must live in base template (not per-app)"
    body = provider.read_text(encoding="utf-8")
    assert "ConvexProviderWithAuth" in body
    assert "fetchAccessToken" in body
    # Adapter must defer to useAuth.getIdToken — no Firebase SDK re-import
    assert "state.getIdToken" in body


def test_use_auth_exposes_get_id_token() -> None:
    """useAuth must expose getIdToken so non-Convex APIs can share the token."""
    body = (BASE / "src" / "components" / "ui" / "useAuth.tsx").read_text(encoding="utf-8")
    # Type in the return shape
    assert "getIdToken" in body
    assert "Promise<string | null>" in body
    # Returned from the hook
    assert re.search(r"return\s*\{[^}]*getIdToken", body, re.DOTALL), (
        "getIdToken must be returned from useAuth"
    )


def test_use_auth_supports_google_and_apple_oauth() -> None:
    """Acceptance: Google + Apple OAuth flows exist and go through Firebase."""
    body = (BASE / "src" / "components" / "ui" / "useAuth.tsx").read_text(encoding="utf-8")
    assert "GoogleAuthProvider" in body
    assert 'OAuthProvider("apple.com")' in body
    assert "signInWithPopup" in body


def test_firebase_config_stub_is_present() -> None:
    """Standalone compile needs a Firebase config stub in base."""
    body = (BASE / "src" / "config" / "firebase.ts").read_text(encoding="utf-8")
    assert "firebaseConfig" in body
    assert "REPLACE_AT_GENERATION" in body, "stub must be replaced at generation"


def test_convex_url_config_is_present() -> None:
    body = (BASE / "src" / "config" / "convex.ts").read_text(encoding="utf-8")
    assert "CONVEX_URL" in body
    assert "convex.cloud" in body


# ---------------------------------------------------------------------------
# Overlay: todo-list-convex inherits the bridge from base
# ---------------------------------------------------------------------------


def test_todo_template_inherits_bridge_from_base() -> None:
    """No per-template duplicate — overlay must pick up base's ConvexClientProvider."""
    assert not (TODO / "src" / "ConvexClientProvider.tsx").exists(), (
        "todo-list-convex must not carry its own copy of the bridge; "
        "it should inherit from base at overlay time"
    )


def test_overlay_produces_complete_workspace(tmp_path: Path) -> None:
    """Simulate the build-time overlay and assert the bridge survives."""
    # Mirror the overlay order documented in todo-list-convex/README.md:
    # base first, then template on top.
    shutil.copytree(BASE, tmp_path / "workspace")
    workspace = tmp_path / "workspace"
    for child in TODO.iterdir():
        dest = workspace / child.name
        if child.is_dir():
            shutil.copytree(child, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(child, dest)

    # Bridge must be present after overlay
    assert (workspace / "src" / "ConvexClientProvider.tsx").exists()
    # Todo app must not have overwritten useAuth
    assert (workspace / "src" / "components" / "ui" / "useAuth.tsx").exists()
    # Auth config with Firebase issuer must be present
    assert (workspace / "convex" / "auth.config.ts").exists()
    # Template-specific schema wins (tasks, not items)
    schema = (workspace / "convex" / "schema.ts").read_text(encoding="utf-8")
    assert "tasks:" in schema
    # Firebase config stub comes from template, not base
    fb = (workspace / "src" / "config" / "firebase.ts").read_text(encoding="utf-8")
    assert "firebaseConfig" in fb


# ---------------------------------------------------------------------------
# App wiring: root must wrap in ConvexClientProvider
# ---------------------------------------------------------------------------


def test_todo_root_wraps_in_convex_provider() -> None:
    body = (TODO / "src" / "index.tsx").read_text(encoding="utf-8")
    assert "ConvexClientProvider" in body
    assert re.search(
        r"<ConvexClientProvider>\s*<App\s*/>\s*</ConvexClientProvider>",
        body,
        re.DOTALL,
    ), "<App /> must be wrapped so Convex hooks see the Firebase token"


@pytest.mark.parametrize("hook", ["useQuery", "useMutation"])
def test_todo_app_uses_convex_hooks(hook: str) -> None:
    body = (TODO / "src" / "App.tsx").read_text(encoding="utf-8")
    assert hook in body, f"{hook} must be used so the bridge is exercised"
