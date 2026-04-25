import {
  createContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

// Default to null so consumers outside the provider get a clear error
export const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(
  fbUser: FirebaseAuthTypes.User | null
): AuthUser | null {
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((fbUser) => {
      setUser(mapFirebaseUser(fbUser));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await auth().signOut();
  }, []);

  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      const currentUser = auth().currentUser;
      if (!currentUser) return null;
      return currentUser.getIdToken(forceRefresh);
    },
    []
  );

  return (
    <AuthContext.Provider value={{ user, loading, signOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
