import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export function Input({
  className = '',
  startAdornment,
  endAdornment,
  ...props
}: InputProps) {
  return (
    <div className="relative w-full">
      {startAdornment && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          {startAdornment}
        </div>
      )}
      <input
        {...props}
        className={[
          'h-12 w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#134074] focus:ring-4 focus:ring-blue-900/10',
          startAdornment ? 'pl-10' : 'pl-3',
          endAdornment ? 'pr-10' : 'pr-3',
          className,
        ].join(' ')}
      />
      {endAdornment && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          {endAdornment}
        </div>
      )}
    </div>
  );
}

