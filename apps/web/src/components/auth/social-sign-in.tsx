"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@appio/ui";
import {
  signInWithGoogle,
  signInWithApple,
  friendlyAuthError,
  useFirebaseApp,
} from "@appio/auth";

type Provider = "google" | "apple";

type SocialSignInProps = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function SocialSignIn({ onSuccess, onError }: SocialSignInProps) {
  const app = useFirebaseApp();
  const [pending, setPending] = useState<Provider | null>(null);

  const handle = useCallback(
    async (provider: Provider) => {
      if (pending) return;
      setPending(provider);
      try {
        if (provider === "google") await signInWithGoogle(app);
        else await signInWithApple(app);
        onSuccess?.();
      } catch (error) {
        const msg = friendlyAuthError(error);
        if (msg) onError?.(msg);
      } finally {
        setPending(null);
      }
    },
    [app, pending, onSuccess, onError]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => handle("google")}
        disabled={pending !== null}
        className="w-full"
      >
        {pending === "google" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" style={{ marginRight: 8, flexShrink: 0 }}>
      <path d="M17 10.2 c0 -0.6 -0.1 -1.2 -0.2 -1.7 H10 v3.3 h3.9 c -0.2 0.9 -0.7 1.7 -1.5 2.2 v1.8 h2.5 C16.3 14.4 17 12.5 17 10.2 Z" fill="#4285F4" />
      <path d="M10 17 c2.1 0 3.8 -0.7 5.1 -1.9 l -2.5 -1.8 c -0.7 0.4 -1.5 0.7 -2.6 0.7 c -2 0 -3.7 -1.4 -4.3 -3.2 H3.1 v2 C4.4 15.5 7 17 10 17 Z" fill="#34A853" />
      <path d="M5.7 10.8 c -0.1 -0.4 -0.2 -0.9 -0.2 -1.3 c0 -0.4 0.1 -0.9 0.2 -1.3 v-2 H3.1 c -0.5 1 -0.8 2.1 -0.8 3.3 c0 1.2 0.3 2.3 0.8 3.3 L5.7 10.8 Z" fill="#FBBC05" />
      <path d="M10 5.8 c1.1 0 2.1 0.4 2.9 1.1 l2.2 -2.2 C13.8 3.5 12.1 2.8 10 2.8 C7 2.8 4.4 4.5 3.1 7 L5.7 9 C6.3 7.2 8 5.8 10 5.8 Z" fill="#EA4335" />
    </svg>
  );
}
