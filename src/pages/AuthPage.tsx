import React, { useEffect, useState } from 'react';
import { Lock, LogIn, Sparkles, UserPlus } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import logoPicto from '../assets/Logo Fotsography Studio_LOGO FOTSOGRAPHY STUDIO COLOR PICTO.jpg';
import type { RegisterPayload } from '../../shared/types.ts';
import { Alert, LoadingScreen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError, fetchSetupStatus } from '../lib/api';

/* Styles partagés par les deux panneaux (couleurs du studio uniquement) */
const LABEL_CLASS = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-studio-dark/60';
const INPUT_CLASS =
  'w-full rounded-studio border border-studio-dark/10 bg-white px-3.5 py-2.5 text-sm text-studio-dark shadow-studio-xs transition placeholder:text-studio-dark/35 hover:border-studio-dark/20 focus:border-studio-gold focus:outline-none focus:ring-4 focus:ring-studio-gold/20';
const PRIMARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-studio bg-gradient-to-br from-studio-dark via-studio-dark to-studio-terracotta px-4 py-3 text-sm font-semibold text-white shadow-studio-card transition hover:shadow-studio-halo hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none';
const NOTE_CLASS =
  'mt-5 flex items-start justify-center gap-2 text-center text-xs text-studio-dark/50';

type FormState = RegisterPayload & {
  identifier: string;
  confirmPassword: string;
};

const INITIAL_FORM: FormState = {
  identifier: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export const AuthPage: React.FC = () => {
  const { user, isLoading, login, registerAdmin } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState('');

  /** L'inscription n'est proposée que s'il n'existe encore aucun administrateur. */
  useEffect(() => {
    let cancelled = false;

    fetchSetupStatus()
      .then(({ needsAdmin: required }) => {
        if (!cancelled) setNeedsAdmin(required);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError('');
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.identifier.trim() || !formData.password) {
      setError('Veuillez saisir votre email (ou votre nom) et votre mot de passe.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // POST /api/auth/login → vérification du mot de passe haché dans Neon
      await login(formData.identifier.trim(), formData.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.password
    ) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // POST /api/auth/register → création de l'administrateur initial dans Neon
      await registerAdmin({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen label="Chargement…" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-studio-dark px-4 py-10 sm:px-6">
      {/* Halos décoratifs aux couleurs du studio */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-studio-terracotta/35 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-studio-gold/10 blur-[150px]" />

      <div className="studio-pop relative z-10 grid w-full max-w-4xl overflow-hidden rounded-studio-lg bg-white shadow-studio-lift ring-1 ring-black/20 lg:grid-cols-2">
        {/* ------------------ Panneau identité (écrans larges) ------------------ */}
        <div className="studio-grain relative hidden flex-col justify-between overflow-hidden bg-studio-dark px-10 py-12 lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-studio-terracotta/45 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-8 h-52 w-52 rounded-full bg-studio-gold/10 blur-3xl" />

          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-white/20">
            <img
              src={logoPicto}
              alt="Logo Fotsography Studio"
              className="h-full w-full object-contain p-1"
            />
          </div>

          <div className="relative">
            <h1 className="font-serif text-3xl font-bold leading-tight text-white">
              Fotsography <span className="text-studio-gold">Studio</span>
            </h1>
            <span className="studio-accent-rule mt-4 block h-1 w-14 rounded-full" aria-hidden="true" />
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              L'espace de gestion de votre studio photo : projets, paiements 30/50/20, équipe et
              livrables — au même endroit.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs font-semibold text-studio-gold">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Espace privé — réservé aux membres du studio</span>
          </div>
        </div>

        {/* ------------------ Panneau formulaire ------------------ */}
        <div className="bg-white px-6 py-8 sm:px-10 sm:py-12">
          {/* En-tête compact (mobile / tablette) */}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-studio-bg-light ring-1 ring-studio-dark/10">
              <img
                src={logoPicto}
                alt="Logo Fotsography Studio"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div>
              <p className="font-serif text-lg font-bold leading-none text-studio-dark">
                Fotsography <span className="text-studio-terracotta">Studio</span>
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-studio-dark/45">
                Studio Management
              </p>
            </div>
          </div>

          {error ? (
            <Alert tone="error" className="mb-5">
              {error}
            </Alert>
          ) : null}

          {/* ------------------ Mode connexion ------------------ */}
          {mode === 'login' && (
            <>
              <h2 className="font-serif text-2xl font-bold text-studio-dark">Connexion</h2>
              <p className="mt-2 text-sm text-studio-dark/60">
                Entrez votre email ou votre nom et votre mot de passe.
              </p>

              <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="identifier">
                    Email ou nom
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="ex. Awa Traoré ou awa@studio.com"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="loginPassword">
                    Mot de passe
                  </label>
                  <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={INPUT_CLASS}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                >
                  <LogIn className="h-4 w-4" />
                  {isSubmitting ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>

              <div className={NOTE_CLASS}>
                <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>Les comptes membres sont créés par l'administrateur du studio.</span>
              </div>
            </>
          )}
          {/* ------------------ Mode inscription : formulaire ------------------ */}
          {mode === 'register' && (
            <>
              <h2 className="font-serif text-2xl font-bold text-studio-dark">
                Créer le compte admin
              </h2>
              <p className="mt-2 text-sm text-studio-dark/60">
                Ce compte administrateur gère les clients, les projets et les paiements du studio.
              </p>

              <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="name">
                    Nom complet
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex. James Walter"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="email">
                    Adresse email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@fotsography.cm"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="phone">
                    Téléphone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+237 6XX XX XX XX"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL_CLASS} htmlFor="registerPassword">
                      Mot de passe
                    </label>
                    <input
                      id="registerPassword"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="6 caractères min."
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="confirmPassword">
                      Confirmation
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                >
                  <UserPlus className="h-4 w-4" />
                  {isSubmitting ? 'Création en cours…' : 'Créer le compte'}
                </button>
              </form>

              <div className={NOTE_CLASS}>
                <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  Le compte administrateur est créé une seule fois, à la première installation.
                </span>
              </div>
            </>
          )}
          {/* ------------------ Bascule connexion / inscription ------------------ */}
          {needsAdmin || mode === 'register' ? (
            <div className="mt-7 border-t border-studio-dark/10 pt-5 text-center">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-xs font-medium text-studio-terracotta transition hover:underline"
                >
                  Première installation ? Créer le compte Admin principal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs font-medium text-studio-dark/60 transition hover:text-studio-dark hover:underline"
                >
                  ← Retour à la connexion
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
