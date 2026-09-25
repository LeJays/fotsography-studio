import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  changePasswordApi,
  fetchCurrentUser,
  loginApi,
  logoutApi,
  registerAdminApi,
} from '../lib/api';
import type { AuthUser, ChangePasswordPayload, RegisterPayload } from '../../shared/types.ts';

interface AuthContextType {
  user: AuthUser | null;
  /** Vrai pendant la restauration de session au chargement de l'application. */
  isLoading: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  registerAdmin: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Restaure la session depuis le cookie httpOnly (GET /api/auth/me). */
  const refresh = useCallback(async () => {
    try {
      const { user: currentUser } = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then(({ user: currentUser }) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { user: loggedUser } = await loginApi({ identifier, password });
    setUser(loggedUser);
  }, []);

  const registerAdmin = useCallback(async (data: RegisterPayload) => {
    const { user: createdUser } = await registerAdminApi(data);
    setUser(createdUser);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => undefined);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    const { user: updatedUser } = await changePasswordApi(payload);
    setUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === 'ADMIN',
      login,
      registerAdmin,
      logout,
      changePassword,
      refresh,
    }),
    [user, isLoading, login, registerAdmin, logout, changePassword, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
};
