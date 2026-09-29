import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, FolderKanban, ListChecks, Search, SearchX, Users, X } from 'lucide-react';
import { Button, Skeleton, cn } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { fetchClients, fetchProjects, fetchTasks } from '../../lib/api';

type ResultKind = 'client' | 'project' | 'task';

interface SearchResult {
  id: string;
  kind: ResultKind;
  label: string;
  hint: string;
  to: string;
}

const KIND_LABELS: Record<ResultKind, string> = {
  client: 'Client',
  project: 'Projet',
  task: 'Tâche',
};

const KIND_ICONS: Record<ResultKind, React.ReactNode> = {
  client: <Users className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
  task: <ListChecks className="h-4 w-4" />,
};

/** Insensible à la casse et aux accents, pour une recherche tolérante. */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Interroge les modules accessibles au rôle courant.
 * Chaque appel est isolé : une erreur (ex. 403) ne casse pas les autres sources.
 */
const searchAll = async (
  term: string,
  options: { canSeeClients: boolean; canSeeProjects: boolean },
): Promise<SearchResult[]> => {
  const needle = normalize(term);

  const [clients, projects, tasks] = await Promise.all([
    options.canSeeClients
      ? fetchClients(term)
          .then((response) => response.clients)
          .catch(() => [])
      : Promise.resolve([]),
    options.canSeeProjects
      ? fetchProjects()
          .then((response) => response.projects)
          .catch(() => [])
      : Promise.resolve([]),
    fetchTasks()
      .then((response) => response.tasks)
      .catch(() => []),
  ]);

  return [
    ...clients
      .filter((client) => normalize(client.name).includes(needle))
      .map((client): SearchResult => ({
        id: `client-${client.id}`,
        kind: 'client',
        label: client.name,
        hint: client.phone,
        to: `/clients/${client.id}`,
      })),
    ...projects
      .filter((project) => normalize(`${project.eventName} ${project.clientName}`).includes(needle))
      .map((project): SearchResult => ({
        id: `project-${project.id}`,
        kind: 'project',
        label: project.eventName,
        hint: project.clientName,
        to: `/projets/${project.id}`,
      })),
    ...tasks
      .filter((task) => normalize(`${task.name} ${task.projectName} ${task.activityName}`).includes(needle))
      .map((task): SearchResult => ({
        id: `task-${task.id}`,
        kind: 'task',
        label: task.name,
        hint: `${task.projectName} · ${task.activityName}`,
        to: `/taches/${task.id}`,
      })),
  ].slice(0, 12);
};

/** Recherche transverse du studio : clients, projets et tâches (raccourci ⌘K / Ctrl+K). */
export const GlobalSearch: React.FC<{ className?: string }> = ({ className }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canSeeProjects = isAdmin || user?.role === 'ASSISTANT';

  // Ouverture au raccourci clavier, depuis n'importe quelle page.
  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Réinitialisation + focus du champ à chaque ouverture, avec blocage du défilement.
  React.useEffect(() => {
    if (!open) return undefined;

    setTerm('');
    setResults([]);
    setActiveIndex(0);

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Recherche différée (250 ms) dès deux caractères saisis.
  React.useEffect(() => {
    if (!open) return undefined;

    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      searchAll(trimmed, { canSeeClients: isAdmin, canSeeProjects })
        .then((found) => {
          if (!cancelled) {
            setResults(found);
            setActiveIndex(0);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, term, isAdmin, canSeeProjects]);

  const close = React.useCallback(() => setOpen(false), []);

  const go = React.useCallback(
    (result: SearchResult) => {
      close();
      navigate(result.to);
    },
    [close, navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  };

  const trimmed = term.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'hidden items-center gap-2.5 rounded-studio border border-studio-dark/10 bg-white/80 px-3 py-2 text-sm text-studio-dark/45 shadow-studio-xs transition hover:border-studio-dark/20 hover:bg-white hover:text-studio-dark/70 md:inline-flex md:w-56 lg:w-80',
          className,
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Rechercher…</span>
        <span className="hidden shrink-0 items-center gap-0.5 rounded-md border border-studio-dark/10 bg-studio-cream/70 px-1.5 py-0.5 text-[10px] font-semibold text-studio-dark/50 lg:inline-flex">
          <Command className="h-3 w-3" />K
        </span>
      </button>

      <Button
        variant="secondary"
        size="icon"
        className="md:hidden"
        aria-label="Rechercher"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]">
          <button
            type="button"
            aria-label="Fermer la recherche"
            onClick={close}
            className="absolute inset-0 cursor-default bg-studio-dark/55 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recherche globale"
            className="studio-pop relative w-full max-w-xl overflow-hidden rounded-studio-lg border border-studio-dark/10 bg-white shadow-studio-lift"
          >
            <div className="flex items-center gap-3 border-b border-studio-dark/10 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-studio-dark/35" />
              <input
                ref={inputRef}
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un client, un projet, une tâche…"
                className="w-full bg-transparent text-sm text-studio-dark outline-none placeholder:text-studio-dark/35"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Fermer la recherche"
                className="rounded-md p-1 text-studio-dark/40 transition hover:bg-studio-dark/5 hover:text-studio-dark"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="studio-scroll max-h-80 overflow-y-auto p-2">
              {trimmed.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-studio-dark/45">
                  Saisissez au moins deux caractères pour lancer la recherche.
                </p>
              ) : loading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <SearchX className="mx-auto mb-2 h-5 w-5 text-studio-dark/30" />
                  <p className="text-sm text-studio-dark/50">Aucun résultat pour « {trimmed} ».</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {results.map((result, index) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(result)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-studio px-3 py-2.5 text-left transition duration-150',
                          index === activeIndex
                            ? 'bg-studio-gold/15 text-studio-dark'
                            : 'text-studio-dark/75 hover:bg-studio-dark/5',
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-studio bg-white text-studio-terracotta ring-1 ring-studio-gold/30">
                          {KIND_ICONS[result.kind]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{result.label}</span>
                          <span className="block truncate text-xs text-studio-dark/50">{result.hint}</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-studio-dark/35">
                          {KIND_LABELS[result.kind]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-studio-dark/10 bg-studio-cream/40 px-4 py-2 text-[11px] text-studio-dark/45">
              <span>↑ ↓ pour naviguer · Entrée pour ouvrir</span>
              <span>Échap pour fermer</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

