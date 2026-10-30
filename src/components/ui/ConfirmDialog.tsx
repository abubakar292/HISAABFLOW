import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

export type ConfirmType = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  alertOnly?: boolean; // If true, only shows OK button (replaces window.alert)
}

interface ConfirmDialogProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, options, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !options) return null;

  const {
    title = options.type === 'danger' ? 'Confirm Action' : 'Notice',
    message,
    confirmText = options.alertOnly ? 'OK' : options.type === 'danger' ? 'Delete' : 'Confirm',
    cancelText = 'Cancel',
    type = 'danger',
    alertOnly = false,
  } = options;

  const iconConfig = {
    danger: {
      badgeBg: 'bg-rose-50 border-rose-100 text-rose-600 ring-4 ring-rose-50/50',
      icon: <Trash2 className="w-6 h-6 stroke-[2.2]" />,
      btnBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 shadow-md',
    },
    warning: {
      badgeBg: 'bg-amber-50 border-amber-100 text-amber-600 ring-4 ring-amber-50/50',
      icon: <AlertTriangle className="w-6 h-6 stroke-[2.2]" />,
      btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 shadow-md',
    },
    info: {
      badgeBg: 'bg-purple-50 border-purple-100 text-[#522D60] ring-4 ring-purple-50/50',
      icon: <HelpCircle className="w-6 h-6 stroke-[2.2]" />,
      btnBg: 'bg-[#522D60] hover:bg-[#42244D] text-white shadow-purple-900/20 shadow-md',
    },
  }[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-center p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Brand Tag & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="HisaabFlow"
                className="w-5 h-5 object-contain rounded-md"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[11px] font-black tracking-wider uppercase text-[#522D60]">
                HisaabFlow Confirmation
              </span>
            </div>
            {!alertOnly && (
              <button
                type="button"
                onClick={onCancel}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Accent Icon Badge */}
          <div className="flex justify-center mb-4">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${iconConfig.badgeBg}`}>
              {iconConfig.icon}
            </div>
          </div>

          {/* Title & Description */}
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">
            {title}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-6 px-2 font-normal">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2.5">
            {!alertOnly && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer ${iconConfig.btnBg}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
