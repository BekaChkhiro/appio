"""Unit tests for apps/api/domains/convex/cli.py (T3.8).

Focus: the deploy-key scrubbing behaviour. The subprocess plumbing itself is
battle-tested by asyncio; we don't re-verify that. We DO verify that if the
Convex CLI ever regresses and echoes the deploy key into stderr, our stderr-
to-job.error_message path cannot exfiltrate it.
"""

from __future__ import annotations

from apps.api.domains.convex.cli import ConvexCliError, _scrub


class TestScrub:
    def test_replaces_secret_verbatim(self) -> None:
        text = "auth failed using key prod:happy-team|s3cr3t-secret-goes-here"
        secret = "prod:happy-team|s3cr3t-secret-goes-here"
        out = _scrub(text, secret)
        assert secret not in out
        assert "[REDACTED_DEPLOY_KEY]" in out

    def test_empty_secret_is_noop(self) -> None:
        text = "nothing sensitive here"
        assert _scrub(text, "") == text

    def test_no_match_returns_original(self) -> None:
        text = "some unrelated log line"
        secret = "prod:happy-team|s3cr3t"
        assert _scrub(text, secret) == text

    def test_multiple_occurrences_all_replaced(self) -> None:
        secret = "prod:team|secret-a-b-c-d-e"
        text = f"first {secret} then again {secret} done"
        out = _scrub(text, secret)
        assert secret not in out
        assert out.count("[REDACTED_DEPLOY_KEY]") == 2

    def test_scrubs_long_prefix_before_pipe(self) -> None:
        # If the CLI ever prints the key's prefix alone (e.g. for diagnostics),
        # we want the team identifier to go too when it's long enough to be a
        # plausible tell. Short common tokens like 'prod:x' are left alone.
        secret = "prod:unique-customer-team-slug|s3cr3t"
        text = "seen prefix prod:unique-customer-team-slug in error output"
        out = _scrub(text, secret)
        assert "prod:unique-customer-team-slug" not in out
        assert "[REDACTED_DEPLOY_KEY_PREFIX]" in out

    def test_does_not_scrub_short_prefixes(self) -> None:
        # A prefix like "prod:xy" is too short to be meaningfully unique —
        # avoid false positives that would mangle unrelated log lines.
        secret = "prod:xy|s3cr3t"
        text = "saw prod:xy in a completely unrelated context"
        out = _scrub(text, secret)
        # Full secret would scrub, but just the short prefix survives:
        assert "prod:xy" in out


class TestConvexCliErrorMessage:
    """Make sure the error chain surfaces the scrubbed stderr, not the raw
    one. A future migration_service change could accidentally log
    ``str(exc)`` verbatim; this locks in the safety guarantee.
    """

    def test_str_uses_scrubbed_stderr(self) -> None:
        # Construct as the CLI does: already-scrubbed stderr passed in.
        err = ConvexCliError(
            "npx", 1, "auth: [REDACTED_DEPLOY_KEY] was rejected"
        )
        assert "REDACTED" in str(err)

    def test_stores_full_returncode_and_stderr_attrs(self) -> None:
        err = ConvexCliError("npx", 42, "boom")
        assert err.returncode == 42
        assert err.stderr == "boom"
        assert err.cmd == "npx"
