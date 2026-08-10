"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase";
import { createSession } from "@/services/lessons.service";
import type { SessionUser } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  sessionUser: SessionUser | null;
  hasProfile: boolean;
  /** True until the initial Firebase state + backend session are resolved. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  markProfileComplete: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSession = useCallback(async () => {
    const session = await createSession();
    setSessionUser(session.user);
    setHasProfile(session.hasProfile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth(), async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await syncSession();
        } catch {
          // Backend unreachable — keep the Firebase session; guards handle the rest.
          setSessionUser(null);
        }
      } else {
        setSessionUser(null);
        setHasProfile(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [syncSession]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(firebaseAuth(), googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email, password);
  }, []);

  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
    await updateProfile(credential.user, { displayName: name });
    // Re-issue the token so the backend sees the display name claim.
    await credential.user.getIdToken(true);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth());
  }, []);

  const markProfileComplete = useCallback(() => setHasProfile(true), []);

  const value = useMemo(
    () => ({
      firebaseUser,
      sessionUser,
      hasProfile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      markProfileComplete,
    }),
    [firebaseUser, sessionUser, hasProfile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, markProfileComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
