import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppUser } from '../types';
import { onAuthChange, signInAsGuest, signInWithGoogle, linkGuestWithGoogle, signOutUser } from '../firebase/auth';

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  signInAsGuest: () => Promise<AppUser>;
  signInWithGoogle: () => Promise<AppUser>;
  linkGuestWithGoogle: () => Promise<AppUser>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isMerchant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isMerchant = currentUser?.role === 'merchant';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        signInAsGuest,
        signInWithGoogle,
        linkGuestWithGoogle,
        signOut: signOutUser,
        isSuperAdmin,
        isMerchant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
