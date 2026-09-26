import React from 'react';

/** Concatène des classes conditionnelles. */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
  </svg>
);

/* ----------------------------------- Boutons ----------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-studio-dark text-white shadow-studio-card hover:bg-studio-ink hover:shadow-studio-lift',
  secondary:
    'border border-studio-dark/15 bg-white text-studio-dark shadow-sm hover:border-studio-dark/25 hover:bg-studio-cream/70',
  ghost: 'text-studio-dark/70 hover:bg-studio-dark/5',
  danger: 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
};

export interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}) => (
  <button
    {...rest}
    type={type}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-studio-bg-light',
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      className,
    )}
  >
    {loading && <Spinner />}
    {children}
  </button>
);

/* ----------------------------------- Champs ----------------------------------- */

export const CONTROL_CLASS =
  'w-full rounded-xl border border-studio-dark/15 bg-white px-3.5 py-2.5 text-sm text-studio-dark shadow-sm transition placeholder:text-studio-dark/35 hover:border-studio-dark/25 focus:border-studio-gold focus:outline-none focus:ring-2 focus:ring-studio-gold/25 disabled:bg-studio-dark/5 disabled:shadow-none';

export const Input: React.FC<React.ComponentPropsWithRef<'input'>> = ({ className, ...rest }) => (
  <input {...rest} className={cn(CONTROL_CLASS, className)} />
);

export const Textarea: React.FC<React.ComponentPropsWithRef<'textarea'>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cn(CONTROL_CLASS, 'min-h-24 resize-y', className)} />
);

export const Select: React.FC<React.ComponentPropsWithRef<'select'>> = ({ className, children, ...rest }) => (
  <select {...rest} className={cn(CONTROL_CLASS, 'studio-select cursor-pointer appearance-none pr-9', className)}>
    {children}
  </select>
);

export const Field: React.FC<{
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, error, className, children }) => (
  <div className={cn('space-y-1.5', className)}>
    {label ? (
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-studio-dark/80">
        {label}
      </label>
    ) : null}
    {children}
    {error ? (
      <p className="text-xs font-medium text-red-600">{error}</p>
    ) : hint ? (
      <p className="text-xs text-studio-dark/45">{hint}</p>
    ) : null}
  </div>
);

/* ---------------------------------- Conteneurs ---------------------------------- */

export const Card: React.FC<React.ComponentPropsWithRef<'div'>> = ({ className, ...rest }) => (
  <div
    {...rest}
    className={cn('rounded-2xl border border-studio-dark/10 bg-white p-6 shadow-studio-card', className)}
  />
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
}) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="font-serif text-xl font-bold tracking-tight text-studio-dark">{title}</h2>
      <span className="studio-accent-rule mt-2 block h-1 w-10 rounded-full" aria-hidden="true" />
      {subtitle ? <p className="mt-2 text-sm text-studio-dark/55">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
}) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="font-serif text-2xl font-bold tracking-tight text-studio-dark">{title}</h1>
      <span className="studio-accent-rule mt-2.5 block h-1 w-14 rounded-full" aria-hidden="true" />
      {subtitle ? <p className="mt-2 max-w-3xl text-sm text-studio-dark/55">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
);

const BADGE_TONES = {
  gold: 'bg-studio-gold/15 text-studio-dark ring-studio-gold/40',
  dark: 'bg-studio-dark text-white ring-studio-dark/20',
  green: 'bg-green-50 text-green-700 ring-green-200',
  red: 'bg-red-50 text-red-600 ring-red-200',
  gray: 'bg-studio-dark/5 text-studio-dark/60 ring-studio-dark/10',
} as const;

export const Badge: React.FC<{
  tone?: keyof typeof BADGE_TONES;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'gray', className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
      BADGE_TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

export const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}> = ({ label, value, hint, icon }) => (
  <Card className="group relative flex items-start justify-between gap-4 overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-studio-lift">
    <span
      className="studio-accent-rule pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-70 transition-opacity group-hover:opacity-100"
      aria-hidden="true"
    />
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold tracking-tight text-studio-dark">{value}</p>
      {hint ? <p className="mt-1 text-xs text-studio-dark/50">{hint}</p> : null}
    </div>
    {icon ? (
      <span className="studio-icon-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-studio-terracotta ring-1 ring-studio-gold/30">
        {icon}
      </span>
    ) : null}
  </Card>
);

/* ------------------------------------ Tables ------------------------------------ */

export const TableWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'overflow-hidden rounded-2xl border border-studio-dark/10 bg-white shadow-studio-card',
      className,
    )}
  >
    <div className="studio-scroll overflow-x-auto">
      <table className="studio-table w-full border-collapse text-left text-sm">{children}</table>
    </div>
  </div>
);

export const Th: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <th
    className={cn(
      'whitespace-nowrap border-b border-studio-dark/10 bg-studio-cream/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-studio-dark/60',
      className,
    )}
  >
    {children}
  </th>
);

export const Td: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <td className={cn('border-b border-studio-dark/5 px-4 py-3 text-studio-dark/80', className)}>{children}</td>
);
