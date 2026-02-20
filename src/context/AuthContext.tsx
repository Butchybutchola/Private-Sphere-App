import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppUser, onAuthChange, signIn, signUp, signOut, signInAsGuest } from '../services/authService';
import { isFirebaseConfigured } from '../config/firebase';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  cloudEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const cloudEnabled = isFirebaseConfigured();

  useEffect(() => {
    if (!cloudEnabled) {
      // No Firebase — skip auth, run in local-only mode
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((appUser) => {
      setUser(appUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [cloudEnabled]);

  const handleSignIn = async (email: string, password: string) => {
    const appUser = await signIn(email, password);
    setUser(appUser);
  };

  const handleSignUp = async (email: string, password: string, name?: string) => {
    const appUser = await signUp(email, password, name);
    setUser(appUser);
  };

  const handleSignInAsGuest = async () => {
    const appUser = await signInAsGuest();
    setUser(appUser);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        cloudEnabled,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signInAsGuest: handleSignInAsGuest,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
