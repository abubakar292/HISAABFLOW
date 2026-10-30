import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmDialog, ConfirmOptions } from '../components/ui/ConfirmDialog';
import { playDeleteSound, playErrorSound, playSuccessSound } from '../utils/soundEffects';

interface ConfirmContextType {
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  alert: (options: string | ConfirmOptions) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: string | ConfirmOptions): Promise<boolean> => {
    const normalizedOpts: ConfirmOptions =
      typeof opts === 'string'
        ? { message: opts, type: 'danger' }
        : { type: 'danger', ...opts };

    // Play subtle soft warning/prompt note
    if (normalizedOpts.type === 'danger') {
      playErrorSound();
    }

    setOptions(normalizedOpts);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const alert = useCallback((opts: string | ConfirmOptions): Promise<void> => {
    const normalizedOpts: ConfirmOptions =
      typeof opts === 'string'
        ? { message: opts, alertOnly: true, type: 'info', confirmText: 'OK' }
        : { ...opts, alertOnly: true, confirmText: opts.confirmText || 'OK' };

    setOptions(normalizedOpts);
    setIsOpen(true);

    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (options?.type === 'danger') {
      playDeleteSound();
    } else {
      playSuccessSound();
    }
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, [options]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        options={options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}
