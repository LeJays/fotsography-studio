import {
  CalendarDays,
  Camera,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthRole } from '../../shared/consts.ts';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés à voir ce lien ; absent = tous les membres connectés. */
  roles?: readonly AuthRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Navigation de l'espace connecté, regroupée par usage. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/projets', label: 'Projets', icon: FolderKanban, roles: ['ADMIN', 'ASSISTANT'] },
      { to: '/taches', label: 'Tâches', icon: CalendarDays, roles: ['ADMIN', 'ASSISTANT'] },
      { to: '/mes-taches', label: 'Mes tâches', icon: ListChecks },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/clients', label: 'Clients', icon: Users, roles: ['ADMIN'] },
      { to: '/finances', label: 'Finances', icon: Wallet, roles: ['ADMIN'] },
      { to: '/equipe', label: 'Équipe', icon: Camera, roles: ['ADMIN'] },
      { to: '/reglages', label: 'Réglages', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];

/** Groupes visibles pour un rôle, groupes vides retirés. */
export const visibleNavGroups = (role: AuthRole | undefined): NavGroup[] =>
  NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role))),
  })).filter((group) => group.items.length > 0);

export interface Crumb {
  label: string;
  to?: string;
}

interface RouteLabel {
  pattern: RegExp;
  label: string;
  /** Maillon intermédiaire cliquable du fil d'Ariane. */
  parent?: Crumb;
}

/** Correspondance URL → libellés (fils d'Ariane et titre du document). */
const ROUTE_LABELS: RouteLabel[] = [
  { pattern: /^\/$/, label: 'Tableau de bord' },
  { pattern: /^\/projets$/, label: 'Projets' },
  { pattern: /^\/projets\/[^/]+$/, label: 'Projet', parent: { label: 'Projets', to: '/projets' } },
  { pattern: /^\/taches$/, label: 'Tâches' },
  { pattern: /^\/taches\/[^/]+$/, label: 'Tâche', parent: { label: 'Mes tâches', to: '/mes-taches' } },
  { pattern: /^\/activites\/[^/]+$/, label: 'Activité', parent: { label: 'Tâches', to: '/taches' } },
  { pattern: /^\/mes-taches$/, label: 'Mes tâches' },
  { pattern: /^\/clients$/, label: 'Clients' },
  { pattern: /^\/clients\/[^/]+$/, label: 'Fiche client', parent: { label: 'Clients', to: '/clients' } },
  { pattern: /^\/finances$/, label: 'Finances' },
  { pattern: /^\/equipe$/, label: 'Équipe' },
  { pattern: /^\/reglages$/, label: 'Réglages' },
  { pattern: /^\/mon-mot-de-passe$/, label: 'Mon mot de passe' },
];

const matchRoute = (pathname: string): RouteLabel | undefined =>
  ROUTE_LABELS.find((route) => route.pattern.test(pathname));

/** Fil d'Ariane déduit de l'URL (vide sur le tableau de bord, qui est la racine). */
export const breadcrumbsFor = (pathname: string): Crumb[] => {
  const route = matchRoute(pathname);
  if (!route || pathname === '/') return [];

  return [
    { label: 'Accueil', to: '/' },
    ...(route.parent ? [route.parent] : []),
    { label: route.label },
  ];
};

/** Titre du document (`<title>`) pour l'URL courante. */
export const pageTitleFor = (pathname: string): string => {
  const route = matchRoute(pathname);
  return route ? `${route.label} · Fotsography Studio` : 'Fotsography Studio';
};
