"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@appio/auth";
import { Button } from "@appio/ui";
import { SocialSignIn } from "./social-sign-in";
import { EmailPasswordForm } from "./email-password-form";
import { IPhoneFrame } from "@/components/marketing/iphone-frame";
import { StreakAppPreview } from "@/components/marketing/streak-app-preview";

type AuthCardProps = {
  mode: "sign-in" | "sign-up";
};

const DEFAULT_REDIRECT = "/build";

function isSafeRedirect(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: "var(--accent-token, #7C5CFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.6,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        flexShrink: 0,
      }}
    >
      A
    </div>
  );
}

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const redirectParam = searchParams.get("redirect");
  const redirectTo = isSafeRedirect(redirectParam) ? redirectParam : DEFAULT_REDIRECT;

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  const handleSuccess = useCallback(() => {
    router.replace(redirectTo);
  }, [router, redirectTo]);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const clearError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  const isSignUp = mode === "sign-up";

  return (
    <>
      {/* Left — form */}
      <div
        style={{
          padding: 48,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-0)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogoMark size={22} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Appio
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div
              className="t-title"
              style={{ marginBottom: 32, color: "var(--text-primary)" }}
            >
              {isSignUp ? "Start building." : "Welcome back."}
            </div>

            <div onFocus={clearError}>
              <SocialSignIn onSuccess={handleSuccess} onError={handleError} />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "24px 0",
                color: "var(--text-subtle)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "var(--hair)" }} />
              OR
              <div style={{ flex: 1, height: 1, background: "var(--hair)" }} />
            </div>

            <div onFocus={clearError} onChange={clearError}>
              <EmailPasswordForm
                mode={mode}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  marginTop: 16,
                  borderRadius: 6,
                  background: "var(--danger-soft)",
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--danger)",
                }}
              >
                {error}
              </p>
            )}

            <div
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              <span className="muted">
                {isSignUp ? "Already have an account? " : "New here? "}
              </span>
              <Link
                href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
                style={{
                  color: "var(--accent-token)",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {isSignUp ? "Sign in" : "Create an account"}
              </Link>
            </div>
          </div>
        </div>

        <div className="t-caption" style={{ marginTop: "auto", paddingTop: 24 }}>
          © Appio 2026 ·{" "}
          <Link href="/legal/privacy" style={{ color: "inherit", textDecoration: "none" }}>
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" style={{ color: "inherit", textDecoration: "none" }}>
            Terms
          </Link>
        </div>
      </div>

      {/* Right — preview */}
      <div
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(124,92,255,0.18), transparent 60%), var(--surface-1)",
          borderLeft: "1px solid var(--hair)",
          padding: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <IPhoneFrame width={260}>
            <StreakAppPreview scale={260 / 393} />
          </IPhoneFrame>
          <div
            className="t-h3"
            style={{
              marginTop: 32,
              maxWidth: 380,
              color: "var(--text-primary)",
            }}
          >
            &ldquo;It felt less like coding and more like dictating a
            letter.&rdquo;
          </div>
          <div className="t-caption" style={{ marginTop: 12 }}>
            Clara, writer — shipped in 2 hours
          </div>
        </div>
      </div>
    </>
  );
}
