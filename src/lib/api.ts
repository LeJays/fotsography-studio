import type {
  AuthResponse,
  ChangePasswordPayload,
  ClientDetail,
  ClientSummary,
  CreateClientPayload,
  CreateUserPayload,
  LoginPayload,
  ProjectDetail,
  ProjectSummary,
  CreateProjectPayload,
  ActivitySummary,
  CreateActivityPayload,
  CreateTaskPayload,
  CreateExpensePayload,
  CreatePaymentPayload,
  ExpenseSummary,
  TaskSummary,
  RegisterPayload,
  SetupStatus,
  UpdateClientPayload,
  UpdateUserPayload,
  UpdateExpensePayload,
  PaymentSummary,
  FinanceOverview,
  OperationsOverview,
  UserSummary,
} from '../../shared/types.ts';

/**
 * Client HTTP de l'API (dossier `server/`).
 * La session voyage dans un cookie httpOnly : `credentials: 'include'` est obligatoire.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    throw new ApiError("Impossible de joindre l'API. Vérifiez que `npm run dev` tourne.", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const payload = data as { error?: string; details?: unknown } | null;
    throw new ApiError(payload?.error ?? `Erreur ${response.status}`, response.status, payload?.details);
  }

  return data as T;
};

export const apiGet = <T>(path: string): Promise<T> => request<T>('GET', path);
export const apiPost = <T>(path: string, body: unknown = {}): Promise<T> =>
  request<T>('POST', path, body);
export const apiPatch = <T>(path: string, body: unknown = {}): Promise<T> =>
  request<T>('PATCH', path, body);
export const apiDelete = <T = void>(path: string): Promise<T> => request<T>('DELETE', path);

/* ------------------------------- Authentification ------------------------------- */

export const fetchSetupStatus = (): Promise<SetupStatus> => apiGet<SetupStatus>('/api/auth/setup-status');
export const fetchCurrentUser = (): Promise<AuthResponse> => apiGet<AuthResponse>('/api/auth/me');
export const loginApi = (payload: LoginPayload): Promise<AuthResponse> =>
  apiPost<AuthResponse>('/api/auth/login', payload);
export const registerAdminApi = (payload: RegisterPayload): Promise<AuthResponse> =>
  apiPost<AuthResponse>('/api/auth/register', payload);
export const logoutApi = (): Promise<void> => apiPost<void>('/api/auth/logout');
export const changePasswordApi = (payload: ChangePasswordPayload): Promise<AuthResponse> =>
  apiPost<AuthResponse>('/api/auth/password', payload);

/* ------------------------------------ Équipe ------------------------------------ */

export const fetchUsers = (): Promise<{ users: UserSummary[] }> => apiGet<{ users: UserSummary[] }>('/api/users');
export const createUserApi = (payload: CreateUserPayload): Promise<{ user: UserSummary }> =>
  apiPost<{ user: UserSummary }>('/api/users', payload);
export const updateUserApi = (
  id: string,
  payload: UpdateUserPayload,
): Promise<{ user: UserSummary }> => apiPatch<{ user: UserSummary }>(`/api/users/${id}`, payload);
export const archiveUserApi = (id: string): Promise<void> => apiDelete(`/api/users/${id}`);


/* ----------------------------------- Clients ------------------------------------ */

export const fetchClients = (search?: string): Promise<{ clients: ClientSummary[] }> => {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiGet<{ clients: ClientSummary[] }>(`/api/clients${query}`);
};

export const fetchClient = (id: string): Promise<{ client: ClientDetail }> =>
  apiGet<{ client: ClientDetail }>(`/api/clients/${id}`);

export const createClientApi = (payload: CreateClientPayload): Promise<{ client: ClientSummary }> =>
  apiPost<{ client: ClientSummary }>('/api/clients', payload);

export const updateClientApi = (
  id: string,
  payload: UpdateClientPayload,
): Promise<{ client: ClientSummary }> => apiPatch<{ client: ClientSummary }>(`/api/clients/${id}`, payload);

export const archiveClientApi = (id: string): Promise<void> => apiDelete(`/api/clients/${id}`);

/* ----------------------------------- Projets ----------------------------------- */

export const fetchProjects = (): Promise<{ projects: ProjectSummary[] }> => apiGet('/api/projects');
export const fetchProject = (id: string): Promise<{ project: ProjectDetail }> => apiGet(`/api/projects/${id}`);
export const createProjectApi = (payload: CreateProjectPayload): Promise<{ project: ProjectSummary }> =>
  apiPost('/api/projects', payload);
export const createPaymentApi = (projectId: string, payload: CreatePaymentPayload): Promise<{ payment: PaymentSummary }> =>
  apiPost(`/api/projects/${projectId}/payments`, payload);
export const fetchFinances = (): Promise<{ overview: FinanceOverview }> => apiGet('/api/finances');
export const fetchOperationsOverview = (): Promise<{ overview: OperationsOverview }> => apiGet('/api/operations/overview');
export const fetchSettings = (): Promise<{ settings: Record<string, unknown> }> => apiGet('/api/settings');
export const updateSettingsApi = (payload: Record<string, unknown>): Promise<{ settings: Record<string, unknown> }> => apiPatch('/api/settings', payload);

/* ------------------------------- Activités / tâches ------------------------------ */

export const fetchActivities = (): Promise<{ activities: ActivitySummary[] }> => apiGet('/api/activities');
export const createActivityApi = (payload: CreateActivityPayload): Promise<{ activity: ActivitySummary }> => apiPost('/api/activities', payload);
export const updateActivityApi = (id: string, payload: Partial<CreateActivityPayload>): Promise<{ activity: ActivitySummary }> => apiPatch(`/api/activities/${id}`, payload);
export const archiveActivityApi = (id: string): Promise<void> => apiDelete(`/api/activities/${id}`);
export const fetchTasks = (activityId?: string): Promise<{ tasks: TaskSummary[] }> => apiGet(activityId ? `/api/tasks?activityId=${activityId}` : '/api/tasks');
export const fetchTask = (id: string): Promise<{ task: TaskSummary }> => apiGet(`/api/tasks/${id}`);
export const updateOwnTaskApi = (id: string, payload: { status: TaskSummary['status']; proofLink?: string }): Promise<{ task: TaskSummary }> => apiPatch(`/api/tasks/${id}/progress`, payload);
export const payTaskPayoutApi = (id: string): Promise<{ task: TaskSummary }> => apiPost(`/api/tasks/${id}/payout`);
export const createTaskApi = (payload: CreateTaskPayload): Promise<{ task: TaskSummary }> => apiPost('/api/tasks', payload);
export const updateTaskApi = (id: string, payload: Partial<CreateTaskPayload>): Promise<{ task: TaskSummary }> => apiPatch(`/api/tasks/${id}`, payload);
export const archiveTaskApi = (id: string): Promise<void> => apiDelete(`/api/tasks/${id}`);
export const fetchExpenses = (activityId: string): Promise<{ expenses: ExpenseSummary[] }> => apiGet(`/api/expenses?activityId=${encodeURIComponent(activityId)}`);
export const createExpenseApi = (payload: CreateExpensePayload): Promise<{ expense: ExpenseSummary }> => apiPost('/api/expenses', payload);
export const updateExpenseApi = (id: string, payload: UpdateExpensePayload): Promise<{ expense: ExpenseSummary }> => apiPatch(`/api/expenses/${id}`, payload);
export const archiveExpenseApi = (id: string): Promise<void> => apiDelete(`/api/expenses/${id}`);
