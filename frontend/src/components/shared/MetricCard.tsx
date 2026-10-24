import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  toneClass?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, sub, toneClass = 'text-slate-900', onClick }: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 transition-colors group"
    >
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">{label}</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
      </div>
      <div className={`text-xl font-bold font-mono mt-1.5 ${toneClass}`}>
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-1 truncate">{sub}</div>
    </button>
  );
}

