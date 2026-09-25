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
  primary: 'bg-studio-dark text-white shadow-sm shadow-studio-dark/20 hover:bg-studio-dark/90',
  secondary: 'border border-studio-dark/15 bg-white text-studio-dark hover:bg-studio-dark/5',
  ghost: 'text-studio-dark/70 hover:bg-studio-dark/5',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
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
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
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
  'w-full rounded-lg border border-studio-dark/15 bg-white px-3.5 py-2.5 text-sm text-studio-dark placeholder:text-studio-dark/35 transition focus:border-studio-gold focus:outline-none focus:ring-2 focus:ring-studio-gold/25 disabled:bg-studio-dark/5';

export const Input: React.FC<React.ComponentPropsWithRef<'input'>> = ({ className, ...rest }) => (
  <input {...rest} className={cn(CONTROL_CLASS, className)} />
);

export const Textarea: React.FC<React.ComponentPropsWithRef<'textarea'>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cn(CONTROL_CLASS, 'min-h-24 resize-y', className)} />
);

export const Select: React.FC<React.ComponentPropsWithRef<'select'>> = ({ className, children, ...rest }) => (
  <select {...rest} className={cn(CONTROL_CLASS, 'appearance-none pr-9', className)}>
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
  <div {...rest} className={cn('rounded-2xl border border-studio-dark/10 bg-white p-6 shadow-sm', className)} />
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
}) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="font-serif text-xl font-bold text-studio-dark">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-studio-dark/55">{subtitle}</p> : null}
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
      <h1 className="font-serif text-2xl font-bold text-studio-dark">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-studio-dark/55">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
);

const BADGE_TONES = {
  gold: 'bg-studio-gold/20 text-studio-dark',
  dark: 'bg-studio-dark text-white',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-studio-dark/5 text-studio-dark/60',
} as const;

export const Badge: React.FC<{
  tone?: keyof typeof BADGE_TONES;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'gray', className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
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
  <Card className="flex items-start justify-between gap-4 p-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-studio-dark/45">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-studio-dark">{value}</p>
      {hint ? <p className="mt-1 text-xs text-studio-dark/50">{hint}</p> : null}
    </div>
    {icon ? (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-studio-gold/15 text-studio-terracotta">
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
  <div className={cn('overflow-x-auto rounded-xl border border-studio-dark/10', className)}>
    <table className="w-full border-collapse text-left text-sm">{children}</table>
  </div>
);

export const Th: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <th
    className={cn(
      'whitespace-nowrap border-b border-studio-dark/10 bg-studio-dark/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-studio-dark/55',
      className,
    )}
  >
    {children}
  </th>
);

export const Td: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <td className={cn('border-b border-studio-dark/5 px-4 py-3 text-studio-dark/80', className)}>{children}</td>
);
