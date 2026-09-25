import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';

export const NotFoundPage: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-studio-dark px-6 text-center">
    <p className="font-serif text-6xl font-bold text-studio-gold">404</p>
    <h1 className="font-serif text-2xl font-bold text-white">Page introuvable</h1>
    <p className="max-w-sm text-sm text-white/60">
      Cette adresse n'existe pas (ou plus). Revenez à votre espace de travail.
    </p>
    <Link to="/">
      <Button>Retour à l'accueil</Button>
    </Link>
  </div>
);
