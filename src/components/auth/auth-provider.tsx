"use client";

import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  clearGoogleRedirectPending,
  completeGoogleRedirect,
} from "@/lib/firebase/google-redirect";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  configured: boolean;
  getIdToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getClientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsub = () => {};

    (async () => {
      // Always await redirect result before attaching the listener so a lost
      // sessionStorage pending flag cannot race RequireAuth into a bounce.
      try {
        await completeGoogleRedirect(auth);
      } catch {
        // Domain / network errors — still subscribe for any existing session.
      } finally {
        clearGoogleRedirectPending();
      }
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (next) => {
        if (cancelled) return;
        setUser(next);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [configured]);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const logout = useCallback(async () => {
    const auth = getClientAuth();
    if (auth) await signOut(auth);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: isPlatformAdminIdentity({ email: user?.email ?? null }),
      configured,
      getIdToken,
      logout,
    }),
    [user, loading, configured, getIdToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
