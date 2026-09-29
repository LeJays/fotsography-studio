import React, { useEffect } from 'react';
import { Button, Card, PageHeader, useToast } from '../../components/ui';

/**
 * Écran d'attente pour les modules encore à livrer (phases 2 à 8 du plan).
 * Chaque phase remplace ce composant par la page réelle.
 */
export const PlaceholderPage: React.FC<{
  title: string;
  subtitle?: string;
  phase: string;
  features: string[];
}> = ({ title, subtitle, phase, features }) => {
  const toast = useToast();

  // Le message d'étape est remonté par un toast à l'ouverture de la page.
  useEffect(() => {
    toast.info(
      `Module prévu en ${phase} : l'API et le schéma de données correspondants sont déjà en place ; l'interface arrive à l'étape suivante.`,
    );
  }, [phase, toast]);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <Card>
        <ul className="space-y-2 text-sm text-studio-dark/70">
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
};
