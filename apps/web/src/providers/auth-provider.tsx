"use client";

import { useEffect, type ReactNode } from "react";
import {
  FirebaseProvider,
  AuthProvider as BaseAuthProvider,
  useAuth,
} from "@appio/auth";
import { setTokenProvider } from "@appio/api-client";

function getFirebaseConfig() {
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

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId,
  };
}

const firebaseConfig = getFirebaseConfig();

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
