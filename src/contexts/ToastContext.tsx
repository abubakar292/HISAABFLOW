import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  addToast: (arg1: string, arg2?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = {
  success: <CheckCircle className="w-5 h-5 text-accent-emerald" />,
  error: <XCircle className="w-5 h-5 text-accent-rose" />,
  warning: <AlertTriangle className="w-5 h-5 text-accent-amber" />,
  info: <Info className="w-5 h-5 text-primary-500" />
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);

  const addToast = useCallback((arg1: string, arg2?: string) => {
    if (arg2) {
      const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];
      if (validTypes.includes(arg1 as ToastType)) {
        toast(arg2, arg1 as ToastType);
      } else if (validTypes.includes(arg2 as ToastType)) {
        toast(arg1, arg2 as ToastType);
      } else {
        toast(arg2, 'info');
      }
    } else {
      toast(arg1, 'info');
    }
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-white rounded-xl shadow-lg border border-slate-100 p-4 flex items-start gap-3 w-80 pointer-events-auto relative overflow-hidden"
            >
              {ICONS[t.type]}
              <div className="flex-1 text-sm font-medium text-slate-700 pr-4">
                {t.message}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="absolute top-4 right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* Progress bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{ duration: 4, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${
                  t.type === 'success' ? 'from-accent-emerald to-green-400' :
                  t.type === 'error' ? 'from-accent-rose to-red-400' :
                  t.type === 'warning' ? 'from-accent-amber to-orange-400' :
                  'from-primary-500 to-accent-cyan'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
