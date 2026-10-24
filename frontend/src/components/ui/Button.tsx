import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#0b2545] text-white hover:bg-[#134074] focus:ring-blue-900/20 disabled:bg-slate-300',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-900/10',
  ghost: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-blue-900/10',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-200',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[11px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

