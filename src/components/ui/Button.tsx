import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'disabled' | 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    
    const variants = {
      primary: 'bg-[#522D60] text-white hover:bg-[#42244D] shadow-sm border border-[#522D60]',
      secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
      ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-transparent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
      md: 'px-4 py-2 text-sm font-semibold rounded-xl',
      lg: 'px-6 py-2.5 text-base font-bold rounded-xl',
    };
    const isDisabled = Boolean(disabled || isLoading);

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { y: -1 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        disabled={isDisabled}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (props.onClick) {
            props.onClick(e);
          }
        }}
        className={cn(
          'relative inline-flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#522D60]/20 select-none shrink-0',
          variants[variant],
          sizes[size],
          isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
