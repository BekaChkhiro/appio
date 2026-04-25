"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@appio/ui";
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  friendlyAuthError,
  useFirebaseApp,
} from "@appio/auth";

type Mode = "sign-in" | "sign-up";

type EmailPasswordFormProps = {
  mode: Mode;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function EmailPasswordForm({ mode, onSuccess, onError }: EmailPasswordFormProps) {
  const app = useFirebaseApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const isSignUp = mode === "sign-up";

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      try {
        if (isSignUp) {
          await signUpWithEmail(app, email, password, name || undefined);
        } else {
          await signInWithEmail(app, email, password);
        }
        onSuccess?.();
      } catch (error) {
        const msg = friendlyAuthError(error);
        if (msg) onError?.(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [app, email, password, name, isSignUp, submitting, onSuccess, onError]
  );

  const handleReset = useCallback(async () => {
    if (!email) {
      onError?.("Enter your email first, then tap Forgot password.");
      return;
    }
    try {
      await sendPasswordReset(app, email);
      setResetSent(true);
    } catch (error) {
      const msg = friendlyAuthError(error);
      if (msg) onError?.(msg);
    }
  }, [app, email, onError]);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <div className="t-caption" style={{ marginBottom: 6 }}>Email</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface-1)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--r-input, 6px)",
            padding: "0 10px",
            height: 40,
            gap: 8,
            width: "100%",
            transition: "border-color 120ms",
          }}
        >
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              width: "100%",
            }}
            onFocus={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--accent-token)"; }}
            onBlur={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--hair)"; }}
          />
        </div>
      </div>

      {isSignUp && (
        <div>
          <div className="t-caption" style={{ marginBottom: 6 }}>Your name</div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--surface-1)",
              border: "1px solid var(--hair)",
              borderRadius: "var(--r-input, 6px)",
              padding: "0 10px",
              height: 40,
              gap: 8,
              width: "100%",
              transition: "border-color 120ms",
            }}
          >
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clara"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 14,
                fontFamily: "var(--font-sans)",
                width: "100%",
              }}
              onFocus={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--accent-token)"; }}
              onBlur={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--hair)"; }}
            />
          </div>
        </div>
      )}

      <div>
        <div className="t-caption" style={{ marginBottom: 6 }}>Password</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface-1)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--r-input, 6px)",
            padding: "0 10px",
            height: 40,
            gap: 8,
            width: "100%",
            transition: "border-color 120ms",
          }}
        >
          <input
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              width: "100%",
            }}
            onFocus={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--accent-token)"; }}
            onBlur={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--hair)"; }}
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSignUp ? "Create account" : "Sign in"}
      </Button>

      {!isSignUp && (
        <div className="text-center text-xs" style={{ marginTop: 4 }}>
          {resetSent ? (
            <span style={{ color: "var(--text-muted)" }}>
              If an account exists for {email}, we sent a reset link.
            </span>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
              className="hover:text-[var(--text-primary)] hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
      )}
    </form>
  );
}
