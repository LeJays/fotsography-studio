import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from './primitives';

/** Ton d'un toast — reprend les tons historiques du composant Alert. */
export type ToastTone = 'info' | 'success' | 'error' | 'warning';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  /** Horodatage de création, utilisé pour éviter les doublons (React StrictMode). */
  createdAt: number;
}

export interface ToastApi {
  show: (tone: ToastTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const TOAST_TONES: Record<ToastTone, { wrapper: string; icon: React.ReactNode }> = {
  info: {
    wrapper: 'border-studio-gold/30 bg-studio-gold/10 text-studio-dark ring-studio-gold/25',
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    wrapper: 'border-green-200 bg-green-50 text-green-700 ring-green-200/70',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-600 ring-red-200/70',
    icon: <XCircle className="h-4 w-4" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-700 ring-amber-200/70',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

/** Durée d'affichage par ton : les erreurs restent un peu plus longtemps. */
const DURATION_MS: Record<ToastTone, number> = {
  info: 4500,
  success: 4500,
  warning: 5500,
  error: 6500,
};

/** Fenêtre pendant laquelle un message identique n'est pas empilé deux fois. */
const DEDUPE_MS = 1500;
/** Nombre maximal de toasts affichés à l'écran (les plus anciens sont éjectés). */
const MAX_VISIBLE = 4;

const ToastContext = createContext<ToastApi | null>(null);

/** Accès à l'API de notifications ; throw hors `<ToastProvider>`. */
export const useToast = (): ToastApi => {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast doit être utilisé dans un <ToastProvider>.');
  }
  return api;
};

/**
 * Fournisseur de notifications éphémères (« toasts »).
 * Monté une seule fois dans App.tsx ; le viewport est rendu en fixed au-dessus des modales (z-60).
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    toastsRef.current = toastsRef.current.filter((item) => item.id !== id);
    setToasts(toastsRef.current);
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const now = Date.now();
      const duplicate = toastsRef.current.find(
        (item) => item.tone === tone && item.message === message && now - item.createdAt < DEDUPE_MS,
      );
      if (duplicate) {
        // Même message dans la fenêtre de déduplication (double montage StrictMode,
        // re-rendus consécutifs) : on prolonge simplement le toast existant.
        const existingTimer = timersRef.current.get(duplicate.id);
        if (existingTimer) clearTimeout(existingTimer);
        timersRef.current.set(
          duplicate.id,
          setTimeout(() => dismiss(duplicate.id), DURATION_MS[tone]),
        );
        return;
      }

      const id = (nextIdRef.current += 1);
      toastsRef.current = [...toastsRef.current, { id, tone, message, createdAt: now }].slice(
        -MAX_VISIBLE,
      );
      setToasts(toastsRef.current);
      timersRef.current.set(id, setTimeout(() => dismiss(id), DURATION_MS[tone]));
    },
    [dismiss],
  );

  // Purge des minuteurs au démontage du fournisseur.
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message: string) => show('success', message),
      error: (message: string) => show('error', message),
      info: (message: string) => show('info', message),
      warning: (message: string) => show('warning', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center p-4 sm:justify-end sm:p-6"
        role="region"
        aria-label="Notifications"
      >
        <div className="flex w-full max-w-sm flex-col gap-2" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'studio-pop pointer-events-auto flex items-start gap-2.5 rounded-studio border px-3.5 py-2.5 text-xs font-medium shadow-studio-lift ring-1',
                TOAST_TONES[toast.tone].wrapper,
              )}
            >
              <span className="mt-px shrink-0">{TOAST_TONES[toast.tone].icon}</span>
              <p className="flex-1 whitespace-pre-line" role="status">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};