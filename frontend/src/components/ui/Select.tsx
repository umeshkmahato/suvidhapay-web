import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ className = '', children, label, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      )}
      <select
        {...props}
        className={[
          'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-[#134074] focus:ring-4 focus:ring-blue-900/10',
          className,
        ].join(' ')}
      >
        {children}
      </select>
    </div>
  );
}

