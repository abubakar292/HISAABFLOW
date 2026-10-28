import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>}
        <select
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-white/5 px-4 py-2.5 text-slate-900 outline-none transition-all',
            'border-primary-500/20 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
            error && 'border-accent-rose focus:border-accent-rose focus:ring-accent-rose/20',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-accent-rose">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
