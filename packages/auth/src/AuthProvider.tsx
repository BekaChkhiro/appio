"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { useFirebaseApp } from "./FirebaseProvider";
import type { AuthUser, AuthContextValue } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(fbUser: FirebaseUser | null): AuthUser | null {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    emailVerified: fbUser.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const app = useFirebaseApp();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const auth = getAuth(app);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        async (fbUser) => {
          setUser(mapFirebaseUser(fbUser));
          setLoading(false);
          setError(null);

          // Sync a session cookie so Next.js middleware can gate routes.
          if (fbUser) {
            try {
              const token = await fbUser.getIdToken();
              const isSecure =
                typeof window !== "undefined" &&
                window.location.protocol === "https:";
              document.cookie = `__session=${token};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax${isSecure ? ";Secure" : ""}`;
            } catch {
              // Non-fatal — middleware will just keep redirecting to login
              // until the next successful token fetch.
            }
          } else {
            document.cookie = "__session=;path=/;max-age=0;SameSite=Lax";
          }
        },
        (err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Auth initialization failed"));
      setLoading(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [app]);

  const signOut = useCallback(async () => {
    const auth = getAuth(app);
    await firebaseSignOut(auth);
  }, [app]);

  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      return currentUser.getIdToken(forceRefresh);
    },
    [app]
  );

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
