import { FormEvent, ReactNode, useState } from "react";

type AuthMode = "login" | "register";

interface LoginScreenProps {
  /** App name shown in the header. */
  appName?: string;
  /** Tagline shown below the app name. */
  tagline?: string;
  /** Logo element (icon, image, or emoji) shown at the top. */
  logo?: ReactNode;
  /** Called when the user submits email + password. */
  onEmailAuth?: (email: string, password: string, mode: AuthMode) => void | Promise<void>;
  /** Called when the user taps "Continue with Google". */
  onGoogleSignIn?: () => void | Promise<void>;
  /** Called when the user taps "Continue with Apple". */
  onAppleSignIn?: () => void | Promise<void>;
  /** External error message to display (e.g. from Firebase). */
  error?: string;
  /** Show a loading spinner on the submit button. */
  loading?: boolean;
  /** Hide email/password form and show only OAuth buttons. */
  oauthOnly?: boolean;
  /** Additional content rendered below the sign-in buttons. */
  footer?: ReactNode;
}

/**
 * Full-screen login / registration component with iOS-style mobile-native
 * design. Supports email + password and OAuth (Google, Apple).
 *
 * Usage:
 * ```tsx
 * <LoginScreen
 *   appName="My App"
 *   tagline="Track your habits"
 *   logo={<span className="text-4xl">🎯</span>}
 *   onEmailAuth={(email, password, mode) => { ... }}
 *   onGoogleSignIn={() => { ... }}
 *   onAppleSignIn={() => { ... }}
 * />
 * ```
 */
export function LoginScreen({
  appName = "Welcome",
  tagline,
  logo,
  onEmailAuth,
  onGoogleSignIn,
  onAppleSignIn,
  error,
  loading = false,
  oauthOnly = false,
  footer,
}: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const displayError = error || localError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!email.trim()) {
      setLocalError("Please enter your email address.");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    await onEmailAuth?.(email.trim(), password, mode);
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setLocalError("");
    setConfirmPassword("");
  };

  const hasOAuth = onGoogleSignIn || onAppleSignIn;
  const hasEmailAuth = onEmailAuth && !oauthOnly;

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 px-6 pt-16 pb-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-10">
        {logo && (
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-5">
            {logo}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {mode === "login" ? appName : `Join ${appName}`}
        </h1>
        {tagline && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
            {tagline}
          </p>
        )}
      </div>

      {/* OAuth Buttons */}
      {hasOAuth && (
        <div className="flex flex-col gap-3 mb-6">
          {onGoogleSignIn && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={loading}
              className={[
                "w-full h-12 px-4 rounded-xl text-base font-semibold",
                "inline-flex items-center justify-center gap-3",
                "bg-gray-100 dark:bg-gray-800",
                "text-gray-900 dark:text-white",
                "hover:bg-gray-200 dark:hover:bg-gray-700",
                "transition-all duration-150 active:scale-[0.97]",
                "disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              <GoogleLogo />
              Continue with Google
            </button>
          )}
          {onAppleSignIn && (
            <button
              type="button"
              onClick={onAppleSignIn}
              disabled={loading}
              className={[
                "w-full h-12 px-4 rounded-xl text-base font-semibold",
                "inline-flex items-center justify-center gap-3",
                "bg-gray-900 dark:bg-white",
                "text-white dark:text-gray-900",
                "hover:bg-gray-800 dark:hover:bg-gray-100",
                "transition-all duration-150 active:scale-[0.97]",
                "disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              <AppleLogo />
              Continue with Apple
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      {hasOAuth && hasEmailAuth && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            or
          </span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>
      )}

      {/* Email / Password Form */}
      {hasEmailAuth && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="w-full">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              disabled={loading}
              className={[
                "w-full h-12 px-4 rounded-xl text-base",
                "bg-gray-100 dark:bg-gray-800",
                "text-gray-900 dark:text-white",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                "transition-all duration-150",
                "disabled:opacity-50",
              ].join(" ")}
            />
          </div>

          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
              className={[
                "w-full h-12 px-4 pr-12 rounded-xl text-base",
                "bg-gray-100 dark:bg-gray-800",
                "text-gray-900 dark:text-white",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                "transition-all duration-150",
                "disabled:opacity-50",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {mode === "register" && (
            <div className="w-full">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                disabled={loading}
                className={[
                  "w-full h-12 px-4 rounded-xl text-base",
                  "bg-gray-100 dark:bg-gray-800",
                  "text-gray-900 dark:text-white",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  "transition-all duration-150",
                  "disabled:opacity-50",
                ].join(" ")}
              />
            </div>
          )}

          {/* Error Message */}
          {displayError && (
            <p className="text-sm text-red-500 text-center mt-1">{displayError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={[
              "w-full h-12 px-4 rounded-xl text-base font-semibold",
              "inline-flex items-center justify-center gap-2",
              "bg-indigo-500 hover:bg-indigo-600 text-white",
              "shadow-md shadow-indigo-500/30",
              "transition-all duration-150 active:scale-[0.97]",
              "disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed",
              "mt-1",
            ].join(" ")}
          >
            {loading ? (
              <Spinner />
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      )}

      {/* Toggle Login / Register */}
      {hasEmailAuth && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-indigo-500 font-semibold hover:underline"
          >
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </p>
      )}

      {/* Footer */}
      {footer && <div className="mt-auto pt-8">{footer}</div>}
    </div>
  );
}

/* ─── Inline SVG assets ─────────────────────────────────────────────── */

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
