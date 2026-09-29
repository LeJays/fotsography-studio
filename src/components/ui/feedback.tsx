import React from 'react';
import { X } from 'lucide-react';
import { Button, Card, cn } from './primitives';

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, description, action, icon }) => (
  <div className="flex flex-col items-center justify-center rounded-studio-lg border border-dashed border-studio-dark/15 bg-gradient-to-b from-white/85 to-studio-cream/40 px-6 py-12 text-center shadow-studio-card backdrop-blur-sm">
    {icon ? (
      <span className="studio-icon-chip mb-4 flex h-12 w-12 items-center justify-center rounded-studio text-studio-terracotta ring-1 ring-studio-gold/30">
        {icon}
      </span>
    ) : null}
    <p className="font-serif text-lg font-bold tracking-tight text-studio-dark">{title}</p>
    {description ? <p className="mt-1 max-w-sm text-sm text-studio-dark/55">{description}</p> : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Taille : « md »/« lg » = encadrée (hauteur bornée + défilement), « full » = plein écran. */
  size?: 'md' | 'lg' | 'full';
}> = ({ open, title, subtitle, onClose, children, footer, size = 'md' }) => {
  // Fermeture au clavier + blocage du défilement de la page tant que la modale est ouverte.
  React.useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const full = size === 'full';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-studio-dark/60 backdrop-blur-sm sm:items-center',
        full ? 'p-0' : 'p-4 sm:p-6',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'studio-pop flex w-full flex-col overflow-hidden bg-white shadow-studio-lift',
          full
            ? 'h-[100dvh] max-w-none'
            : cn(
                'max-h-[calc(100dvh_-_2rem)] rounded-studio-lg border border-studio-dark/10',
                size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
              ),
        )}
      >
        <span className="studio-accent-rule block h-1 w-full shrink-0" aria-hidden="true" />
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-studio-dark/10 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold tracking-tight text-studio-dark">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-studio-dark/55">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-6 py-5',
            full && 'mx-auto w-full max-w-4xl',
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-studio-dark/10 bg-studio-cream/40 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <div className="studio-panel-dark studio-grain flex min-h-screen items-center justify-center px-6">
    <Card className="studio-rise relative z-10 flex items-center gap-3 px-5 py-4 shadow-studio-lift">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-studio-gold/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-studio-gold" />
      </span>
      <span className="text-sm font-medium text-studio-dark/70">{label}</span>
    </Card>
  </div>
);
