import {
  getAuth,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  type UserCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

/**
 * Low-level auth primitives. No UI, no styles — just Firebase calls.
 * Components in apps/web compose these with shadcn/ui styling.
 */

export async function signInWithGoogle(app: FirebaseApp): Promise<UserCredential> {
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  // Popup on all platforms — signInWithRedirect is broken on Chrome 115+,
  // Safari 16.1+, Firefox 109+ due to third-party storage blocking
  // (firebase/firebase-js-sdk#8329, #9366). Inside Capacitor native, use
  // @capacitor-firebase/authentication with signInWithCredential bridge.
  return signInWithPopup(auth, provider);
}

export async function signInWithApple(app: FirebaseApp): Promise<UserCredential> {
  const auth = getAuth(app);
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return signInWithPopup(auth, provider);
}

export async function signInWithEmail(
  app: FirebaseApp,
  email: string,
  password: string
): Promise<UserCredential> {
  const auth = getAuth(app);
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function signUpWithEmail(
  app: FirebaseApp,
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  const auth = getAuth(app);
  const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  if (displayName && cred.user) {
    await updateProfile(cred.user, { displayName });
  }
  // Fire-and-forget verification email. Backend still requires verified
  // email before allowing generation.
  if (cred.user) {
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-fatal — user can request a new one later.
    }
  }
  return cred;
}

export async function sendPasswordReset(
  app: FirebaseApp,
  email: string
): Promise<void> {
  const auth = getAuth(app);
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function resendEmailVerification(user: FirebaseUser): Promise<void> {
  return sendEmailVerification(user);
}

/**
 * Map Firebase auth/* error codes to user-friendly messages.
 * Covers the common ones; unknown codes fall through to the raw message.
 */
export function friendlyAuthError(error: unknown): string {
  const err = error as { code?: string; message?: string };
  switch (err.code) {
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Popup blocked by your browser. Please allow popups for this site.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}
