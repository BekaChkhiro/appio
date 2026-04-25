"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@appio/auth";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENV = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV;

// Initialize Sentry at module scope so it captures errors even before the
// provider mounts (Next.js server runtime will call this too — Sentry SDK
// is SSR-safe).
if (SENTRY_DSN && !Sentry.getClient()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: SENTRY_ENV === "production" ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: SENTRY_ENV === "production" ? 0.5 : 0,
    // Don't phone home from dev / preview by default.
    enabled: SENTRY_ENV !== "development",
  });
}

function doNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt = navigator.doNotTrack || (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function initPostHog() {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (doNotTrack()) return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we capture manually below to control SPA navigation
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    disable_session_recording: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV !== "production") {
        ph.debug(false);
      }
    },
  });
}

function AuthIdentitySync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!POSTHOG_KEY || !posthog.__loaded) return;
    if (user) {
      posthog.identify(user.uid, {
        email: user.email ?? undefined,
        name: user.displayName ?? undefined,
        email_verified: user.emailVerified,
      });
      Sentry.setUser({
        id: user.uid,
        email: user.email ?? undefined,
      });
    } else {
      posthog.reset();
      Sentry.setUser(null);
    }
  }, [user]);

  return null;
}

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  // PostHogProvider is safe to mount even when POSTHOG_KEY is missing — it
  // just becomes a no-op wrapper.
  return (
    <PostHogProvider client={posthog}>
      <AuthIdentitySync />
      {children}
    </PostHogProvider>
  );
}
