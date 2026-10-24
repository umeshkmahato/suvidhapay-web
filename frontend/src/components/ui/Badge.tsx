import React from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  className?: string;
}

const toneClassMap: Record<BadgeTone, string> = {
  success: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border border-amber-200',
  danger: 'text-red-700 bg-red-50 border border-red-200',
  neutral: 'text-slate-700 bg-slate-100 border border-slate-200',
  info: 'text-blue-700 bg-blue-50 border border-blue-200',
};

export function Badge({ label, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded font-mono text-[11px] px-2 py-1 ${toneClassMap[tone]} ${className}`}>
      {label}
    </span>
  );
}

