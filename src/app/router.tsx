import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ClientsPage } from '../features/clients/ClientsPage';
import { ClientDetailPage } from '../features/clients/ClientDetailPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { MyTasksPage } from '../features/tasks/MyTasksPage';
import { TaskDetailPage } from '../features/tasks/TaskDetailPage';
import { ActivitiesPage } from '../features/tasks/ActivitiesPage';
import { ActivityDetailPage } from '../features/tasks/ActivityDetailPage';
import { TeamPage } from '../features/team/TeamPage';
import { FinancesPage } from '../features/finances/FinancesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AuthPage } from '../pages/AuthPage';
import { RequireAuth, RequireRole } from './guards';
import { StudioLayout } from './layouts/StudioLayout';

export const router = createBrowserRouter([
  { path: '/connexion', element: <AuthPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/mon-mot-de-passe', element: <ChangePasswordPage /> },
      {
        element: <StudioLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/mes-taches', element: <MyTasksPage /> },
          { path: '/taches/:id', element: <TaskDetailPage /> },
          {
            // Pilotage opérationnel : l'assistant voit tous les projets, activités et tâches.
            element: <RequireRole roles={['ADMIN', 'ASSISTANT']} />,
            children: [
              { path: '/projets', element: <ProjectsPage /> },
              { path: '/projets/:id', element: <ProjectDetailPage /> },
              { path: '/taches', element: <ActivitiesPage /> },
              { path: '/activites/:id', element: <ActivityDetailPage /> },
            ],
          },
          {
            // Données financières, clients, équipe et réglages : administrateur uniquement.
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: '/clients', element: <ClientsPage /> },
              { path: '/clients/:id', element: <ClientDetailPage /> },
              { path: '/finances', element: <FinancesPage /> },
              { path: '/equipe', element: <TeamPage /> },
              { path: '/reglages', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
