import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import logoPicto from '../../assets/Logo Fotsography Studio_LOGO FOTSOGRAPHY STUDIO COLOR PICTO.jpg';
import { ROLE_LABELS } from '../../../shared/consts.ts';
import { Avatar, Button, Dropdown, DropdownItem, cn } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { breadcrumbsFor, pageTitleFor, visibleNavGroups } from '../navigation';
import { GlobalSearch } from './GlobalSearch';

/** Clé de persistance du repli de la barre latérale. */
const SIDEBAR_STORAGE_KEY = 'fotsography.sidebar-collapsed';

const readSidebarCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Lien de navigation, partagé par la barre latérale et le tiroir mobile. */
const SidebarLink: React.FC<{
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  rail: boolean;
  onNavigate?: () => void;
}> = ({ to, label, icon: Icon, rail, onNavigate }) => (
  <NavLink
    to={to}
    end={to === '/'}
    onClick={onNavigate}
    title={rail ? label : undefined}
    className={({ isActive }) =>
      cn(
        'group relative flex items-center gap-3 whitespace-nowrap rounded-studio px-3 py-2.5 text-sm font-medium transition duration-200',
        rail && 'justify-center px-0',
        isActive
          ? 'bg-white/10 text-white ring-1 ring-studio-gold/25'
          : 'text-white/65 hover:bg-white/5 hover:text-white',
      )
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={cn(
            'studio-accent-rule absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition-opacity duration-200',
            isActive ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />
        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-studio-gold' : 'text-white/70')} />
        {rail ? null : <span className="truncate">{label}</span>}
      </>
    )}
  </NavLink>
);

/** Contenu de la barre latérale, réutilisé par la version bureau et le tiroir mobile. */
const Sidebar: React.FC<{
  rail: boolean;
  onToggleRail: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
}> = ({ rail, onToggleRail, onLogout, onNavigate }) => {
  const { user } = useAuth();
  const groups = visibleNavGroups(user?.role);

  return (
    <div className="studio-panel-dark studio-grain flex h-full flex-col text-white">
      <div className={cn('flex items-center gap-3 px-5 py-5', rail && 'justify-center px-0')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-studio bg-white shadow-lg ring-1 ring-white/20">
          <img src={logoPicto} alt="Fotsography Studio" className="h-full w-full object-contain p-0.5" />
        </span>
        {rail ? null : (
          <span className="min-w-0">
            <span className="block truncate font-serif text-base font-bold leading-none">
              Fotsography <span className="text-studio-gold">Studio</span>
            </span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Studio Management
            </span>
          </span>
        )}
      </div>

      <nav className={cn('studio-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4', rail && 'px-2')}>
        {groups.map((group) => (
          <div key={group.title}>
            {rail ? (
              <span className="mx-auto mb-2 block h-px w-6 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  rail={rail}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn('border-t border-white/10 px-3 py-3', rail && 'px-2')}>
        {rail ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar name={user?.name} size="sm" onDark />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Déconnexion"
              className="text-white/60 hover:bg-white/10 hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user?.name} size="sm" onDark />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-[11px] text-white/50">{user ? ROLE_LABELS[user.role] : ''}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Déconnexion"
              className="text-white/60 hover:bg-white/10 hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleRail}
          aria-label={rail ? 'Déplier la navigation' : 'Replier la navigation'}
          className={cn(
            'mt-3 hidden w-full items-center gap-2 rounded-studio px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/5 hover:text-white lg:flex',
            rail && 'justify-center px-0',
          )}
        >
          {rail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {rail ? null : 'Replier'}
        </button>
      </div>
    </div>
  );
};



/** Coquille de l'application connectée : navigation adaptée au rôle. */
export const StudioLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [rail, setRail] = React.useState(readSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const crumbs = breadcrumbsFor(location.pathname);

  // Titre du document synchronisé avec la route courante.
  React.useEffect(() => {
    document.title = pageTitleFor(location.pathname);
  }, [location.pathname]);

  // Le tiroir mobile se referme après chaque changement de page.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(rail));
    } catch {
      // Préférence cosmétique : un stockage indisponible ne doit pas casser la navigation.
    }
  }, [rail]);

  const handleLogout = async () => {
    await logout();
    navigate('/connexion', { replace: true });
  };

  return (
    <div className="studio-ambient studio-scroll min-h-screen lg:flex">
      {/* Barre latérale bureau, repliable (préférence mémorisée). */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 transition-[width] duration-300 lg:block',
          rail ? 'w-[5.25rem]' : 'w-64',
        )}
      >
        <Sidebar rail={rail} onToggleRail={() => setRail((value) => !value)} onLogout={handleLogout} />
      </aside>

      {/* Tiroir mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 cursor-default bg-studio-dark/60 backdrop-blur-sm"
          />
          <div className="studio-pop relative h-full w-72 max-w-[80vw] shadow-studio-lift">
            <button
              type="button"
              aria-label="Fermer la navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-6 z-10 rounded-studio p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              rail={false}
              onToggleRail={() => setRail((value) => !value)}
              onLogout={handleLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen w-full min-w-0 flex-col">
        <header className="studio-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-studio-dark/10 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Ouvrir la navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              {crumbs.length ? (
                <nav
                  aria-label="Fil d’Ariane"
                  className="mb-0.5 hidden items-center gap-1.5 text-[11px] text-studio-dark/45 sm:flex"
                >
                  {crumbs.map((crumb, index) => (
                    <React.Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 ? <span aria-hidden="true">/</span> : null}
                      {crumb.to && index < crumbs.length - 1 ? (
                        <Link to={crumb.to} className="rounded transition hover:text-studio-terracotta">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="font-medium text-studio-dark/65">{crumb.label}</span>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              ) : null}
              <p className="truncate font-serif text-base font-bold tracking-tight text-studio-dark lg:text-lg">
                {crumbs.length ? crumbs[crumbs.length - 1].label : 'Espace de travail'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearch />
            <span className="hidden rounded-full bg-studio-gold/15 px-3 py-1 text-[11px] font-semibold text-studio-dark ring-1 ring-studio-gold/30 sm:inline-flex">
              {user ? ROLE_LABELS[user.role] : ''}
            </span>
            <Dropdown
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  className="flex items-center gap-2 rounded-studio border border-transparent p-1 transition hover:border-studio-dark/10 hover:bg-white/70"
                >
                  <Avatar name={user?.name} size="sm" />
                  <span className="hidden text-left lg:block">
                    <span className="block max-w-32 truncate text-xs font-semibold text-studio-dark">{user?.name}</span>
                    <span className="block max-w-32 truncate text-[10px] text-studio-dark/45">{user?.email}</span>
                  </span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-studio-dark">{user?.name}</p>
                    <p className="truncate text-[11px] text-studio-dark/50">{user ? ROLE_LABELS[user.role] : ''}</p>
                  </div>
                  <div className="my-1 h-px bg-studio-dark/10" />
                  <DropdownItem
                    onClick={() => {
                      close();
                      navigate('/mes-taches');
                    }}
                  >
                    <ListChecks className="h-4 w-4 text-studio-terracotta" /> Mes tâches
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      close();
                      navigate('/mon-mot-de-passe');
                    }}
                  >
                    <KeyRound className="h-4 w-4 text-studio-terracotta" /> Mon mot de passe
                  </DropdownItem>
                  <div className="my-1 h-px bg-studio-dark/10" />
                  <DropdownItem
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      close();
                      void handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Déconnexion
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="studio-scroll flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[90rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
