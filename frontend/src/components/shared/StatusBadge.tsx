import React from 'react';

export type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
}

const toneClassMap: Record<StatusBadgeTone, string> = {
  success: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border border-amber-200',
  danger: 'text-red-700 bg-red-50 border border-red-200',
  neutral: 'text-slate-700 bg-slate-100 border border-slate-200',
  info: 'text-blue-700 bg-blue-50 border border-blue-200',
};

export function StatusBadge({ label, tone = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded font-mono text-[11px] px-2 py-1 ${toneClassMap[tone]} ${className}`}>
      {label}
    </span>
  );
}
