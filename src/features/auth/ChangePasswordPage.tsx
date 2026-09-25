import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema } from '../../../shared/schemas/auth.ts';
import { Alert, Button, Card, Field, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

/** Changement de mot de passe (obligatoire à la première connexion d'un membre). */
export const ChangePasswordPage: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = changePasswordSchema.safeParse(form);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await changePassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        confirmPassword: parsed.data.confirmPassword,
      });
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => navigate('/', { replace: true }), 900);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Changement impossible. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/connexion', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-studio-dark px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-studio-terracotta/30 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-studio-gold/10 blur-[150px]" />

      <Card className="relative z-10 w-full max-w-md p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-studio-gold/15 text-studio-terracotta">
          <KeyRound className="h-5 w-5" />
        </span>

        <h1 className="mt-4 font-serif text-2xl font-bold text-studio-dark">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-studio-dark/55">
          {user?.mustChangePassword
            ? 'Votre compte a été créé par l’administrateur : choisissez votre mot de passe personnel.'
            : 'Confirmez votre mot de passe actuel puis choisissez un nouveau mot de passe.'}
        </p>

        {error ? (
          <Alert tone="error" className="mt-5">
            {error}
          </Alert>
        ) : null}

        {success ? (
          <Alert tone="success" className="mt-5">
            Mot de passe mis à jour. Redirection…
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Mot de passe actuel" htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={update}
              placeholder="••••••••"
            />
          </Field>

          <Field label="Nouveau mot de passe" htmlFor="newPassword" hint="6 caractères minimum">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={update}
              placeholder="••••••••"
            />
          </Field>

          <Field label="Confirmation" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update}
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" loading={isSubmitting} className="w-full">
            Enregistrer le mot de passe
          </Button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-5 w-full text-center text-xs font-medium text-studio-dark/50 transition hover:text-studio-dark hover:underline"
        >
          Se déconnecter
        </button>
      </Card>
    </div>
  );
};
