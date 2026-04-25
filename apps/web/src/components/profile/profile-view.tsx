"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Check, Github } from "lucide-react";
import {
  useAuth,
  resendEmailVerification,
  friendlyAuthError,
  useFirebaseApp,
} from "@appio/auth";
import { getAuth } from "firebase/auth";
import { Button, Badge } from "@appio/ui";

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

function Chip({ variant, children, style }: { variant: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const variants: Record<string, { bg: string; color: string }> = {
    ready: { bg: "var(--success-soft)", color: "var(--success)" },
    published: { bg: "var(--success-soft)", color: "var(--success)" },
    connected: { bg: "var(--success-soft)", color: "var(--success)" },
  };
  const v = variants[variant] || variants.ready;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: v.bg,
        color: v.color,
        padding: "0 8px",
        height: 22,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="t-overline" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--hair)", borderRadius: 10 }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--hair)" }}>
      <div style={{ width: 140, fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function ServiceRow({ icon, name, acct }: { icon: string; name: string; acct: string }) {
  return (
    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--hair)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon === "github" ? (
          <Github className="h-[18px] w-[18px]" style={{ color: "var(--text-primary)" }} />
        ) : icon === "google" ? (
          <svg width="18" height="18" viewBox="0 0 20 20">
            <path d="M17 10.2 c0 -0.6 -0.1 -1.2 -0.2 -1.7 H10 v3.3 h3.9 c -0.2 0.9 -0.7 1.7 -1.5 2.2 v1.8 h2.5 C16.3 14.4 17 12.5 17 10.2 Z" fill="#4285F4" />
            <path d="M10 17 c2.1 0 3.8 -0.7 5.1 -1.9 l -2.5 -1.8 c -0.7 0.4 -1.5 0.7 -2.6 0.7 c -2 0 -3.7 -1.4 -4.3 -3.2 H3.1 v2 C4.4 15.5 7 17 10 17 Z" fill="#34A853" />
            <path d="M5.7 10.8 c -0.1 -0.4 -0.2 -0.9 -0.2 -1.3 c0 -0.4 0.1 -0.9 0.2 -1.3 v-2 H3.1 c -0.5 1 -0.8 2.1 -0.8 3.3 c0 1.2 0.3 2.3 0.8 3.3 L5.7 10.8 Z" fill="#FBBC05" />
            <path d="M10 5.8 c1.1 0 2.1 0.4 2.9 1.1 l2.2 -2.2 C13.8 3.5 12.1 2.8 10 2.8 C7 2.8 4.4 4.5 3.1 7 L5.7 9 C6.3 7.2 8 5.8 10 5.8 Z" fill="#EA4335" />
          </svg>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-token)" }}>C</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{name}</div>
        <div className="t-caption" style={{ marginTop: 2 }}>{acct}</div>
      </div>
      <Chip variant="connected">Connected</Chip>
      <Button variant="ghost" size="sm">Manage</Button>
    </div>
  );
}

function ThemeToggleWidget() {
  const [mode, setMode] = useState<"dark" | "light">("dark");

  return (
    <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 2, borderRadius: 6, width: "fit-content" }}>
      {(["dark", "light"] as const).map((key) => {
        const label = key === "dark" ? "☾  Dark" : "☀  Light";
        const active = mode === key;
        return (
          <div
            key={key}
            onClick={() => setMode(key)}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              borderRadius: 4,
              cursor: "pointer",
              background: active ? "var(--surface-0)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: active ? 500 : 400,
              userSelect: "none",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

const TABS = ["Profile", "Connected services", "Notifications", "Security"];

export function ProfileView() {
  const router = useRouter();
  const app = useFirebaseApp();
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");
  const [signingOut, setSigningOut] = useState(false);
  const [resendState, setResendState] = useState<
    { kind: "idle" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [resending, setResending] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  }, [router, signOut]);

  const handleResendVerification = useCallback(async () => {
    const currentUser = getAuth(app).currentUser;
    if (!currentUser) return;
    setResending(true);
    try {
      await resendEmailVerification(currentUser);
      setResendState({ kind: "sent" });
    } catch (error) {
      setResendState({ kind: "error", message: friendlyAuthError(error) });
    } finally {
      setResending(false);
    }
  }, [app]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-pulse" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="t-body muted">Not signed in.</div>
      </div>
    );
  }

  const initials = initialsOf(user.displayName, user.email);
  const displayName = user.displayName || user.email?.split("@")[0] || "User";

  return (
    <div
      className="scroll"
      style={{ height: "100%", overflow: "auto", background: "var(--surface-0)" }}
    >
      <div
        className="px-6 py-8 sm:px-12 lg:px-16"
        style={{ maxWidth: 960, margin: "0 auto" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: 48,
          }}
          className="profile-grid"
        >
          {/* Sidebar */}
          <div>
            <div className="t-overline" style={{ marginBottom: 16 }}>Account</div>
            {TABS.map((t) => (
              <div
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: "8px 10px",
                  marginBottom: 2,
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  background: activeTab === t ? "var(--surface-2)" : "transparent",
                  color: activeTab === t ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {t}
              </div>
            ))}
          </div>

          {/* Content */}
          <div>
            <div className="t-display" style={{ marginBottom: 32, color: "var(--text-primary)" }}>
              {activeTab}
            </div>

            {activeTab === "Profile" && (
              <>
                <SettingGroup label="You">
                  <SettingRow label="Avatar">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid var(--hair)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            background: "var(--accent-soft)",
                            border: "1px solid var(--accent-token)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            fontWeight: 700,
                            color: "var(--accent-token)",
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <Button variant="secondary" size="sm">Upload</Button>
                      <Button variant="ghost" size="sm">Remove</Button>
                    </div>
                  </SettingRow>
                  <SettingRow label="Name">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "var(--surface-0)",
                        border: "1px solid var(--hair)",
                        borderRadius: "var(--r-input, 6px)",
                        padding: "0 10px",
                        height: 36,
                        width: "100%",
                        maxWidth: 300,
                      }}
                    >
                      <input
                        defaultValue={displayName}
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
                      />
                    </div>
                  </SettingRow>
                  <SettingRow label="Email">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "var(--surface-0)",
                        border: "1px solid var(--hair)",
                        borderRadius: "var(--r-input, 6px)",
                        padding: "0 10px",
                        height: 36,
                        width: "100%",
                        maxWidth: 300,
                      }}
                    >
                      <input
                        defaultValue={user.email || ""}
                        readOnly
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
                      />
                    </div>
                  </SettingRow>
                  <SettingRow label="Handle">
                    <span className="t-mono" style={{ color: "var(--text-primary)" }}>
                      appio.app/{displayName.toLowerCase().replace(/\s+/g, "-")}
                    </span>
                  </SettingRow>
                </SettingGroup>

                <SettingGroup label="Preferences">
                  <SettingRow label="Theme">
                    <ThemeToggleWidget />
                  </SettingRow>
                  <SettingRow label="Keyboard">
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      Command palette · <span className="t-mono">⌘K</span>
                    </span>
                  </SettingRow>
                </SettingGroup>

                <div style={{ marginTop: 32 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    Sign out
                  </Button>
                </div>
              </>
            )}

            {activeTab === "Connected services" && (
              <SettingGroup label="Connected services">
                <ServiceRow icon="convex" name="Convex" acct={user.email || "Not connected"} />
                <ServiceRow icon="github" name="GitHub" acct="Not connected" />
                <ServiceRow icon="google" name="Google" acct="Sign-in provider" />
              </SettingGroup>
            )}

            {activeTab === "Notifications" && (
              <div className="t-body muted" style={{ padding: 24, background: "var(--surface-1)", borderRadius: 10, border: "1px solid var(--hair)" }}>
                Notification settings coming soon.
              </div>
            )}

            {activeTab === "Security" && (
              <>
                <SettingGroup label="Security">
                  <SettingRow label="Email verification">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {user.emailVerified ? (
                        <>
                          <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
                          <span style={{ fontSize: 13, color: "var(--success)" }}>Verified</span>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Not verified</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleResendVerification}
                            disabled={resending}
                          >
                            {resending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            {resendState.kind === "sent" ? "Email sent" : "Resend email"}
                          </Button>
                        </>
                      )}
                    </div>
                  </SettingRow>
                </SettingGroup>
                {resendState.kind === "error" && (
                  <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 8 }}>
                    {resendState.message}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
