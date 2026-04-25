"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

type FirebaseContextValue = {
  app: FirebaseApp;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function useFirebaseApp(): FirebaseApp {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error("useFirebaseApp must be used within a FirebaseProvider");
  }
  return ctx.app;
}

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
};

type FirebaseProviderProps = {
  config: FirebaseConfig;
  children: ReactNode;
};

export function FirebaseProvider({ config, children }: FirebaseProviderProps) {
  const app = useMemo(() => {
    const existing = getApps();
    if (existing.length > 0) return existing[0];
    return initializeApp(config);
  }, [config]);

  return (
    <FirebaseContext.Provider value={{ app }}>
      {children}
    </FirebaseContext.Provider>
  );
}
