import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AuthRole } from '../../shared/consts.ts';
import { LoadingScreen } from '../components/ui';

/** Bloque l'accès aux pages privées et attend la restauration de la session. */
export const RequireAuth: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen label="Restauration de la session…" />;
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }

  if (user.mustChangePassword && location.pathname !== '/mon-mot-de-passe') {
    return <Navigate to="/mon-mot-de-passe" replace />;
  }

  return <Outlet />;
};

/** Restreint une branche de routes à certains rôles. */
export const RequireRole: React.FC<{ roles: AuthRole[] }> = ({ roles }) => {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
