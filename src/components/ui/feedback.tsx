import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Button, Card, cn } from './primitives';

const ALERT_TONES = {
  info: {
    wrapper: 'border-studio-gold/30 bg-studio-gold/10 text-studio-dark',
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    wrapper: 'border-green-200 bg-green-50 text-green-700',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-600',
    icon: <XCircle className="h-4 w-4" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
} as const;

export const Alert: React.FC<{
  tone?: keyof typeof ALERT_TONES;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ tone = 'info', title, className, children }) => (
  <div
    role="alert"
    className={cn(
      'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium',
      ALERT_TONES[tone].wrapper,
      className,
    )}
  >
    <span className="mt-px shrink-0">{ALERT_TONES[tone].icon}</span>
    <div>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
    </div>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, description, action, icon }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-studio-dark/15 bg-white/60 px-6 py-12 text-center">
    {icon ? (
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-studio-gold/15 text-studio-terracotta">
        {icon}
      </span>
    ) : null}
    <p className="font-serif text-lg font-bold text-studio-dark">{title}</p>
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
  wide?: boolean;
}> = ({ open, title, subtitle, onClose, children, footer, wide = false }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-studio-dark/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={cn(
          'w-full rounded-2xl border border-studio-dark/10 bg-white shadow-2xl',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-studio-dark/10 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-studio-dark">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-studio-dark/55">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
            Fermer
          </Button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-studio-dark/10 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <div className="flex min-h-screen items-center justify-center bg-studio-dark">
    <Card className="flex items-center gap-3 px-5 py-4">
      <span className="h-2 w-2 animate-pulse rounded-full bg-studio-gold" />
      <span className="text-sm font-medium text-studio-dark/70">{label}</span>
    </Card>
  </div>
);
