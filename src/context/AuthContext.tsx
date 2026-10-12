'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AppUser {
  email: string;
  uid: string;
}

interface AuthContextType {
  user: AppUser | null;
  demoUser: AppUser | null;
  loading: boolean;
  isFirebaseActive: boolean;
  adminUid: string;
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  loginDemo: (email?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  demoUser: null,
  loading: true,
  isFirebaseActive: false,
  adminUid: '',
  loginWithFirebase: async () => {},
  loginDemo: () => {},
  logout: async () => {},
});

const USER_STORAGE_KEY = 'iot_registry_active_technician';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [demoUser, setDemoUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID || 'admin-technician-01';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) {
        try {
          setDemoUser(JSON.parse(savedUser));
        } catch {
          // ignore
        }
      } else {
        const defaultUser: AppUser = {
          email: 'asepjourney551@gmail.com',
          uid: 'tech-asep-01',
        };
        setDemoUser(defaultUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(defaultUser));
      }
    }
    setLoading(false);
  }, []);

  const loginDemo = (email = 'asepjourney551@gmail.com') => {
    const dUser: AppUser = {
      email,
      uid: `tech-${email.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
    };
    setDemoUser(dUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(dUser));
    }
  };

  const loginWithFirebase = async (email: string) => {
    loginDemo(email);
  };

  const logout = async () => {
    setDemoUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: demoUser,
        demoUser,
        loading,
        isFirebaseActive: false,
        adminUid,
        loginWithFirebase,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

