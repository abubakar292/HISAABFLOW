import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'cyan' | 'default';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    success: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
    warning: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
    danger: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20',
    info: 'bg-primary-500/10 text-primary-600 border border-primary-500/20',
    cyan: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
    default: 'bg-slate-100 text-slate-600 border border-slate-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
