"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AuthProvider as BaseAuthProvider,
  FirebaseProvider,
  useAuth,
} from "@appio/auth";
import { setTokenProvider } from "@appio/api-client";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !authDomain || !projectId || !appId) {
  throw new Error(
    "Missing required Firebase configuration. Please set NEXT_PUBLIC_FIREBASE_API_KEY, " +
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID."
  );
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId,
};

function ApiTokenBridge({ children }: { children: ReactNode }) {
  const { getIdToken } = useAuth();
  useEffect(() => {
    setTokenProvider(getIdToken);
  }, [getIdToken]);
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <FirebaseProvider config={firebaseConfig}>
      <BaseAuthProvider>
        <ApiTokenBridge>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </ApiTokenBridge>
      </BaseAuthProvider>
    </FirebaseProvider>
  );
}
