import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button, cn } from './primitives';
import { Modal } from './feedback';

export interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export type ConfirmFn = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const useConfirm = (): ConfirmFn => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm doit être utilisé au sein d’un ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    const options: ConfirmOptions =
      typeof opts === 'string'
        ? { message: opts, title: 'Confirmation', variant: 'primary' }
        : { title: 'Confirmation', variant: 'primary', ...opts };

    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    if (state) {
      state.resolve(value);
      setState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state ? (
        <Modal
          open={state.open}
          size="md"
          title={state.options.title || 'Confirmation'}
          onClose={() => handleClose(false)}
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {state.options.cancelText || 'Annuler'}
              </Button>
              <Button
                variant={state.options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => handleClose(true)}
                autoFocus
              >
                {state.options.confirmText || 'Confirmer'}
              </Button>
            </div>
          }
        >
          <div className="flex items-start gap-3 py-1">
            <span
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-studio ring-1',
                state.options.variant === 'danger'
                  ? 'border border-red-200 bg-red-50 text-red-600 ring-red-200/70'
                  : 'border border-studio-gold/30 bg-studio-gold/15 text-studio-dark ring-studio-gold/25',
              )}
            >
              {state.options.variant === 'danger' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <HelpCircle className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1 text-sm leading-relaxed text-studio-dark/80">
              {state.options.message}
            </div>
          </div>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
};
