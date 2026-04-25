"use client";

import { useEffect, type ReactNode } from "react";
import {
  FirebaseProvider,
  AuthProvider as BaseAuthProvider,
  useAuth,
} from "@appio/auth";
import { setTokenProvider } from "@appio/api-client";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

function ApiTokenBridge({ children }: { children: ReactNode }) {
  const { getIdToken } = useAuth();

  useEffect(() => {
    setTokenProvider(getIdToken);
  }, [getIdToken]);

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider config={firebaseConfig}>
      <BaseAuthProvider>
        <ApiTokenBridge>{children}</ApiTokenBridge>
      </BaseAuthProvider>
    </FirebaseProvider>
  );
}
