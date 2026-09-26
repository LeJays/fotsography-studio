import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Camera,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import logoPicto from '../../assets/Logo Fotsography Studio_LOGO FOTSOGRAPHY STUDIO COLOR PICTO.jpg';
import { ROLE_LABELS, type AuthRole } from '../../../shared/consts.ts';
import { Button, cn } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Rôles autorisés à voir ce lien ; absent = tous les membres connectés. */
  roles?: readonly AuthRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/clients', label: 'Clients', icon: <Users className="h-4 w-4" />, roles: ['ADMIN'] },
  { to: '/projets', label: 'Projets', icon: <FolderKanban className="h-4 w-4" />, roles: ['ADMIN', 'ASSISTANT'] },
  { to: '/taches', label: 'Tâches', icon: <CalendarDays className="h-4 w-4" />, roles: ['ADMIN', 'ASSISTANT'] },
  { to: '/mes-taches', label: 'Mes tâches', icon: <ListChecks className="h-4 w-4" /> },
  { to: '/finances', label: 'Finances', icon: <Wallet className="h-4 w-4" />, roles: ['ADMIN'] },
  { to: '/equipe', label: 'Équipe', icon: <Camera className="h-4 w-4" />, roles: ['ADMIN'] },
  { to: '/reglages', label: 'Réglages', icon: <Settings className="h-4 w-4" />, roles: ['ADMIN'] },
];

/** Initiales affichées dans les pastilles d'avatar. */
const initialsOf = (name?: string): string =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** Coquille de l'application connectée : navigation adaptée au rôle. */
export const StudioLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = NAV_ITEMS.filter((item) => !item.roles || (user !== null && item.roles.includes(user.role)));

  const handleLogout = async () => {
    await logout();
    navigate('/connexion', { replace: true });
  };

  const Brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-white/20">
        <img
          src={logoPicto}
          alt="Fotsography Studio"
          className="h-full w-full object-contain p-0.5"
        />
      </span>
      <span>
        <span className="block font-serif text-base font-bold leading-none">
          Fotsography <span className="text-studio-gold">Studio</span>
        </span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Studio Management
        </span>
      </span>
    </div>
  );

  return (
    <div className="studio-ambient studio-scroll min-h-screen lg:flex">
      <aside className="studio-panel-dark flex flex-col text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        {Brand}

        <nav className="studio-scroll flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition duration-200',
                  isActive
                    ? 'bg-white/10 text-studio-gold ring-1 ring-studio-gold/25'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.icon}
                  {item.label}
                  <span
                    className={cn(
                      'ml-auto hidden h-1.5 w-1.5 rounded-full bg-studio-gold transition-opacity duration-200 lg:block',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden items-center justify-between gap-3 border-t border-white/10 px-4 py-4 lg:flex">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-studio-gold/20 text-xs font-bold text-studio-gold ring-1 ring-studio-gold/30">
              {initialsOf(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-[11px] text-white/50">{user ? ROLE_LABELS[user.role] : ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Déconnexion"
            className="text-white/60 hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-studio-dark/10 bg-white/85 px-5 py-3 backdrop-blur-md lg:px-8">
          <div className="min-w-0">
            <p className="font-serif text-lg font-bold tracking-tight text-studio-dark">Espace de travail</p>
            <p className="truncate text-xs text-studio-dark/50">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-studio-gold/15 px-3 py-1 text-[11px] font-semibold text-studio-dark ring-1 ring-studio-gold/30 sm:inline-flex">
              {user ? ROLE_LABELS[user.role] : ''}
            </span>
            <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-studio-dark text-[11px] font-bold text-studio-gold sm:flex">
              {initialsOf(user?.name)}
            </span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </Button>
          </div>
        </header>

        <main className="studio-scroll flex-1 px-5 py-6 lg:px-8">
          <div className="studio-rise mx-auto w-full max-w-[90rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
