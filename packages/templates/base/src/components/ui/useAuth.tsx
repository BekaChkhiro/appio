import { useCallback, useSyncExternalStore } from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  type User as FirebaseUser,
  type Auth,
} from "firebase/auth";
import type { ConvexReactClient } from "convex/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

export type UseAuthReturn = AuthState & {
  /** Sign in with email + password. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Create account with email + password. */
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  /** Sign in with Google popup/redirect. */
  signInWithGoogle: () => Promise<void>;
  /** Sign in with Apple popup. */
  signInWithApple: () => Promise<void>;
  /**
   * Anonymous sign-in — works in WKWebView (Capacitor) where popup-based
   * flows fail. Used by the T2.3 mobile validation harness; legitimate
   * for any "guest mode" flow in production templates.
   */
  signInAnonymous: () => Promise<void>;
  /** Sign out. */
  signOut: () => Promise<void>;
  /**
   * Firebase ID token for the current user, or `null` when signed out.
   * Convex's provider calls this automatically; app code can call it to
   * authenticate non-Convex APIs (e.g. the Appio FastAPI) with the same token.
   */
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
};

// ---------------------------------------------------------------------------
// Module-level singleton — initialized once on first useAuth() call
// ---------------------------------------------------------------------------

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _convex: ConvexReactClient | null = null;
let _state: AuthState = { user: null, loading: true };
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((l) => l());
}

function _mapUser(fb: FirebaseUser | null): AuthUser | null {
  if (!fb) return null;
  return {
    uid: fb.uid,
    email: fb.email,
    displayName: fb.displayName,
    photoURL: fb.photoURL,
  };
}

function _ensureInit(config: FirebaseConfig, convexClient?: ConvexReactClient): Auth {
  if (_auth) return _auth;

  if (convexClient) {
    _convex = convexClient;
  }

  try {
    const existing = getApps();
    _app = existing.length > 0 ? existing[0] : initializeApp(config);
  } catch (err) {
    _exposeInitError(err);
    throw err;
  }

  // Use initializeAuth with explicit persistence chain instead of getAuth().
  // Inside Capacitor WKWebView the IndexedDB origin is `capacitor://localhost`
  // which works for storage but Firebase's default persistence resolution can
  // hang during init if the IndexedDB request never resolves (a real issue
  // observed during T2.3). The fallback chain tries each persistence layer
  // in order; inMemory always succeeds so onAuthStateChanged is guaranteed
  // to fire.
  try {
    _auth = initializeAuth(_app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        inMemoryPersistence,
      ],
    });
  } catch (err) {
    // initializeAuth throws if Auth was already initialised on this app
    // (e.g. via a previous useAuth call before HMR). Fall back to getAuth.
    try {
      _auth = getAuth(_app);
    } catch (err2) {
      _exposeInitError(err2);
      throw err2;
    }
  }

  // Failsafe: if onAuthStateChanged never fires within 5 s, treat as
  // "no user signed in" so the UI can render the sign-in screen rather
  // than spinning forever. The real callback still fires later if it
  // eventually resolves.
  const failsafe = setTimeout(() => {
    if (_state.loading) {
      _state = { user: null, loading: false };
      _notify();
    }
  }, 5000);

  const authRef = _auth;

  try {
    onAuthStateChanged(
      authRef,
      (fbUser) => {
        clearTimeout(failsafe);
        if (fbUser !== null && _convex) {
          // Pass a token fetcher function — not a raw token — so Convex can
          // re-request a fresh JWT whenever it determines the current one is
          // near expiry or the server returns an auth error.
          _convex.setAuth(({ forceRefreshToken }) =>
            fbUser.getIdToken(forceRefreshToken),
          );
        } else if (fbUser === null && _convex) {
          _convex.clearAuth();
        }
        _state = { user: _mapUser(fbUser), loading: false };
        _notify();
      },
      (err) => {
        clearTimeout(failsafe);
        _exposeInitError(err);
        _state = { user: null, loading: false };
        _notify();
      },
    );
  } catch (err) {
    clearTimeout(failsafe);
    _exposeInitError(err);
    _state = { user: null, loading: false };
    _notify();
  }

  return authRef;
}

function _exposeInitError(err: unknown): void {
  // Park the error on a globally-readable slot so on-device diagnostics
  // can render the actual message even when the browser's cross-origin
  // error handler reports it as the opaque "Script error.".
  try {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
    (window as unknown as { __appioAuthInitErrors?: string[] })
      .__appioAuthInitErrors = [
      ...(((window as unknown as { __appioAuthInitErrors?: string[] })
        .__appioAuthInitErrors) ?? []),
      message,
    ];
  } catch {
    // window unavailable in SSR — ignore.
  }
}

function _isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Firebase Auth hook for generated Appio PWAs.
 *
 * Reads config from `src/config/firebase.ts` (auto-injected at build time).
 * Returns auth state + sign-in/sign-out methods.
 *
 * ```tsx
 * import { useAuth } from "./components/ui";
 * import { firebaseConfig } from "./config/firebase";
 *
 * function App() {
 *   const { user, loading, signInWithEmail, signOut } = useAuth(firebaseConfig);
 *   if (loading) return <Spinner />;
 *   if (!user) return <LoginScreen onEmailAuth={...} />;
 *   return <main>Welcome {user.displayName}</main>;
 * }
 * ```
 */
export function useAuth(config: FirebaseConfig, convexClient?: ConvexReactClient): UseAuthReturn {
  const auth = _ensureInit(config, convexClient);

  const state = useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _state,
    () => _state,
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    [auth],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    [auth],
  );

  const signInAnonymous = useCallback(async () => {
    await signInAnonymously(auth);
  }, [auth]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" && _isMobile()) {
        const { signInWithRedirect } = await import("firebase/auth");
        await signInWithRedirect(auth, provider);
      } else if (err?.code !== "auth/popup-closed-by-user") {
        throw err;
      }
    }
  }, [auth]);

  const signInWithApple = useCallback(async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        throw err;
      }
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    // clearAuth before Firebase signOut so in-flight Convex requests don't
    // race against a signed-out Firebase user still returning tokens.
    _convex?.clearAuth();
    await firebaseSignOut(auth);
  }, [auth]);

  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      const current = auth.currentUser;
      if (current === null) return null;
      try {
        return await current.getIdToken(forceRefresh);
      } catch {
        return null;
      }
    },
    [auth],
  );

  return {
    ...state,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signInAnonymous,
    signOut,
    getIdToken,
  };
}
