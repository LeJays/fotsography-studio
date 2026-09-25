import React from 'react';
import { Alert, Button, Card, PageHeader } from '../../components/ui';

/**
 * Écran d'attente pour les modules encore à livrer (phases 2 à 8 du plan).
 * Chaque phase remplace ce composant par la page réelle.
 */
export const PlaceholderPage: React.FC<{
  title: string;
  subtitle?: string;
  phase: string;
  features: string[];
}> = ({ title, subtitle, phase, features }) => (
  <div>
    <PageHeader title={title} subtitle={subtitle} />

    <Card>
      <Alert tone="info" title={`Module prévu en ${phase}`}>
        L'API et le schéma de données correspondants sont déjà en place ; l'interface arrive à
        l'étape suivante.
      </Alert>

      <ul className="mt-5 space-y-2 text-sm text-studio-dark/70">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-studio-gold" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Button variant="secondary" disabled>
          Bientôt disponible
        </Button>
      </div>
    </Card>
  </div>
);
