import React from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react';

/** Concatène des classes conditionnelles. */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

/** Initiales affichées dans les pastilles d'avatar (« Jean Dupont » → « JD »). */
export const initialsOf = (name?: string): string =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
  </svg>
);

/* ----------------------------------- Boutons ----------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-studio-dark via-studio-dark to-studio-terracotta text-white shadow-studio-card hover:shadow-studio-halo hover:brightness-110',
  secondary:
    'border border-studio-dark/10 bg-white/90 text-studio-dark shadow-studio-xs hover:border-studio-dark/25 hover:bg-white hover:shadow-studio-card',
  soft: 'bg-studio-gold/15 text-studio-dark ring-1 ring-inset ring-studio-gold/35 hover:bg-studio-gold/25',
  ghost: 'text-studio-dark/65 hover:bg-studio-dark/5 hover:text-studio-dark',
  danger: 'border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100',
  outline: 'border border-studio-gold/45 text-studio-terracotta hover:bg-studio-gold/10',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  icon: 'h-9 w-9 shrink-0 p-0',
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
      'inline-flex items-center justify-center gap-2 rounded-studio font-semibold tracking-tight transition duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:brightness-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-studio-bg-light',
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
  'w-full rounded-studio border border-studio-dark/10 bg-white px-3.5 py-2.5 text-sm text-studio-dark shadow-studio-xs transition placeholder:text-studio-dark/35 hover:border-studio-dark/20 focus:border-studio-gold focus:outline-none focus:ring-4 focus:ring-studio-gold/20 disabled:bg-studio-dark/5 disabled:shadow-none';

export interface InputProps extends React.ComponentPropsWithRef<'input'> {
  /** Icône décorative affichée à gauche du champ (recherche, email…). */
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ className, icon, ...rest }) => {
  if (!icon) return <input {...rest} className={cn(CONTROL_CLASS, className)} />;

  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-studio-dark/35">
        {icon}
      </span>
      <input {...rest} className={cn(CONTROL_CLASS, 'pl-10', className)} />
    </span>
  );
};

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
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-wide text-studio-dark/60"
      >
        {label}
      </label>
    ) : null}
    {children}
    {error ? (
      <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs text-studio-dark/45">{hint}</p>
    ) : null}
  </div>
);

/* ---------------------------------- Conteneurs ---------------------------------- */

export const Card: React.FC<React.ComponentPropsWithRef<'div'> & { interactive?: boolean }> = ({
  className,
  interactive = false,
  ...rest
}) => (
  <div
    {...rest}
    className={cn(
      'relative rounded-studio-lg border border-studio-dark/10 bg-gradient-to-b from-white to-studio-cream/40 p-6 shadow-studio-card',
      interactive && 'studio-card-hover cursor-pointer',
      className,
    )}
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

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Fil d'Ariane affiché au-dessus du titre (le dernier élément est la page courante). */
  breadcrumbs?: Array<{ label: string; to?: string }>;
}> = ({ title, subtitle, actions, breadcrumbs }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {breadcrumbs?.length ? (
        <nav aria-label="Fil d’Ariane" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-studio-dark/45">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.to && index < breadcrumbs.length - 1 ? (
                <Link to={crumb.to} className="rounded transition hover:text-studio-terracotta">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-studio-dark/60">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      ) : null}
      <h1 className="font-serif text-2xl font-bold tracking-tight text-studio-dark sm:text-3xl">{title}</h1>
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

/** Couleur de la pastille affichée devant le libellé d'un badge. */
const BADGE_DOTS = {
  gold: 'bg-studio-gold',
  dark: 'bg-studio-gold',
  green: 'bg-green-500',
  red: 'bg-red-500',
  gray: 'bg-studio-dark/30',
} as const;

export const Badge: React.FC<{
  tone?: keyof typeof BADGE_TONES;
  /** Affiche une pastille colorée devant le texte. */
  dot?: boolean;
  /** Silhouette carrée (filtres, compteurs) au lieu de la pilule. */
  square?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'gray', dot = false, square = false, className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ring-1',
      square ? 'rounded-studio' : 'rounded-full',
      BADGE_TONES[tone],
      className,
    )}
  >
    {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', BADGE_DOTS[tone])} aria-hidden="true" /> : null}
    {children}
  </span>
);

/** Teintes d'une variation (tendance) affichée dans une carte de statistique. */
const TREND_TONES = {
  up: 'text-green-700',
  down: 'text-red-600',
  flat: 'text-studio-dark/50',
} as const;

export const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { label: string; tone?: keyof typeof TREND_TONES };
}> = ({ label, value, hint, icon, trend }) => {
  const trendTone = trend?.tone ?? 'flat';

  return (
    <Card className="group flex items-start justify-between gap-4 overflow-hidden p-5">
      <span
        className="studio-accent-rule pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-studio-dark/45">{label}</p>
        <p className="studio-tabular mt-2 font-serif text-2xl font-bold tracking-tight text-studio-dark">{value}</p>
        {trend ? (
          <span className={cn('mt-1.5 inline-flex items-center gap-1 text-xs font-semibold', TREND_TONES[trendTone])}>
            {trendTone === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : trendTone === 'down' ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            {trend.label}
          </span>
        ) : null}
        {hint ? <p className="mt-1 text-xs text-studio-dark/50">{hint}</p> : null}
      </div>
      {icon ? (
        <span className="studio-icon-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-studio text-studio-terracotta ring-1 ring-studio-gold/30">
          {icon}
        </span>
      ) : null}
    </Card>
  );
};

/* ------------------------------------ Tables ------------------------------------ */

export const TableWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'overflow-hidden rounded-studio-lg border border-studio-dark/10 bg-white/95 shadow-studio-card',
      className,
    )}
  >
    {/* `max-h` borné : indispensable pour que l'en-tête `sticky` reste visible. */}
    <div className="studio-scroll max-h-[70vh] overflow-auto">
      <table className="studio-table w-full border-collapse text-left text-sm">{children}</table>
    </div>
  </div>
);

export const Th: React.FC<{ className?: string; align?: 'left' | 'right' | 'center'; children: React.ReactNode }> = ({
  className,
  align = 'left',
  children,
}) => (
  <th
    className={cn(
      'whitespace-nowrap border-b border-studio-dark/10 bg-studio-cream/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-studio-dark/55',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {children}
  </th>
);

export const Td: React.FC<{ className?: string; align?: 'left' | 'right' | 'center'; children: React.ReactNode }> = ({
  className,
  align = 'left',
  children,
}) => (
  <td
    className={cn(
      'border-b border-studio-dark/5 px-4 py-3 align-middle text-studio-dark/80',
      // Les colonnes numériques alignées à droite adoptent des chiffres de largeur fixe.
      align === 'right' && 'studio-tabular text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {children}
  </td>
);

/* ---------------------------------- Squelettes ---------------------------------- */

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <span className={cn('studio-skeleton block rounded-studio', className)} aria-hidden="true" />
);

/** Rangée de cartes de statistiques factices, affichée pendant un chargement. */
export const StatsSkeleton: React.FC<{ count?: number; className?: string }> = ({ count = 4, className }) => (
  <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <Card key={`stat-${index}`} className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-32" />
      </Card>
    ))}
  </div>
);

/** Grille de cartes factices, affichée pendant le chargement d'une liste en cartes. */
export const CardGridSkeleton: React.FC<{ count?: number; className?: string }> = ({ count = 6, className }) => (
  <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <Card key={`card-${index}`} className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </Card>
    ))}
  </div>
);

/** Tableau factice, affiché pendant le chargement d'une liste. */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 4,
  columns = 4,
  className,
}) => (
  <TableWrapper className={className}>
    <thead>
      <tr>
        {Array.from({ length: columns }).map((_, column) => (
          <Th key={`head-${column}`}>
            <Skeleton className="h-3 w-20" />
          </Th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={`row-${row}`}>
          {Array.from({ length: columns }).map((_, column) => (
            <Td key={`cell-${row}-${column}`}>
              <Skeleton className={cn('h-3.5', column === 0 ? 'w-40' : 'w-20')} />
            </Td>
          ))}
        </tr>
      ))}
    </tbody>
  </TableWrapper>
);

/* -------------------------------- Barres et jauges -------------------------------- */

const PROGRESS_FILLS = {
  gradient: 'studio-track',
  gold: 'bg-studio-gold',
  green: 'bg-green-600',
  terracotta: 'bg-studio-terracotta',
} as const;

export const ProgressBar: React.FC<{
  /** Pourcentage de remplissage (borné entre 0 et 100). */
  value: number;
  /** `auto` : vert à 100 %, or au-delà de 50 %, rouge en dessous. */
  tone?: keyof typeof PROGRESS_FILLS | 'auto';
  /** Libellé de droite ; `false` masque complètement la valeur. */
  label?: string | false;
  className?: string;
}> = ({ value, tone = 'gradient', label, className }) => {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const fill =
    tone === 'auto'
      ? percent >= 100
        ? 'bg-green-600'
        : percent >= 50
          ? 'bg-studio-gold'
          : 'bg-red-500'
      : PROGRESS_FILLS[tone];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 min-w-14 flex-1 overflow-hidden rounded-full bg-studio-dark/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {label === false ? null : (
        <span className="studio-tabular shrink-0 text-xs font-semibold text-studio-dark/70">
          {label ?? `${percent} %`}
        </span>
      )}
    </div>
  );
};

/* ---------------------------------- Identités ---------------------------------- */

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
} as const;

export const Avatar: React.FC<{
  name?: string;
  src?: string;
  size?: keyof typeof AVATAR_SIZES;
  /** Variante claire destinée aux panneaux sombres (barre latérale). */
  onDark?: boolean;
  className?: string;
}> = ({ name, src, size = 'md', onDark = false, className }) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-1',
      AVATAR_SIZES[size],
      onDark
        ? 'bg-studio-gold/20 text-studio-gold ring-studio-gold/30'
        : 'bg-gradient-to-br from-studio-gold/30 to-studio-terracotta/20 text-studio-dark ring-studio-gold/35',
      className,
    )}
  >
    {src ? (
      <img src={src} alt={name ?? 'Avatar'} className="h-full w-full object-cover" />
    ) : (
      initialsOf(name)
    )}
  </span>
);

/* ---------------------------------- Filtres ---------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Compteur optionnel affiché à droite du libellé. */
  count?: number;
}

/** Bascule de filtres en pilules (statuts, catégories…). */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    role="tablist"
    className={cn(
      'studio-scroll-hidden inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-studio border border-studio-dark/10 bg-white/80 p-1 shadow-studio-xs backdrop-blur',
      className,
    )}
  >
    {options.map((option) => {
      const isActive = option.value === value;

      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.75rem] px-3 py-1.5 text-xs font-semibold transition duration-200',
            isActive
              ? 'bg-studio-dark text-white shadow-studio-xs'
              : 'text-studio-dark/60 hover:bg-studio-dark/5 hover:text-studio-dark',
          )}
        >
          {option.icon}
          {option.label}
          {option.count === undefined ? null : (
            <span
              className={cn(
                'studio-tabular rounded-full px-1.5 py-px text-[10px]',
                isActive ? 'bg-white/20 text-white' : 'bg-studio-dark/10 text-studio-dark/60',
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/* ----------------------------------- Menus ----------------------------------- */

/**
 * Menu déroulant léger (menu utilisateur) : fermeture au clic extérieur et avec `Échap`.
 * Le déclencheur est fourni en fonction pour rester un vrai `<button>` accessible.
 */
export const Dropdown: React.FC<{
  trigger: (state: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
}> = ({ trigger, children, align = 'end', className, panelClassName }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const close = React.useCallback(() => setOpen(false), []);
  const toggle = React.useCallback(() => setOpen((previous) => !previous), []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger({ open, toggle })}
      {open ? (
        <div
          role="menu"
          className={cn(
            'studio-rise absolute z-50 mt-2 min-w-56 overflow-hidden rounded-studio-lg border border-studio-dark/10 bg-white p-1.5 shadow-studio-lift',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
};

export const DropdownItem: React.FC<React.ComponentPropsWithRef<'button'>> = ({ className, ...rest }) => (
  <button
    type="button"
    role="menuitem"
    {...rest}
    className={cn(
      'flex w-full items-center gap-2.5 rounded-[0.75rem] px-3 py-2 text-left text-sm font-medium text-studio-dark/80 transition hover:bg-studio-dark/5 hover:text-studio-dark',
      className,
    )}
  />
);

/* ---------------------------------- Recherche ---------------------------------- */

/** Champ de recherche avec icône intégrée. */
export const SearchInput: React.FC<InputProps> = ({ className, ...rest }) => (
  <Input icon={<Search className="h-4 w-4" />} type="search" className={className} {...rest} />
);
