import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface RoleSidebarProps {
  title: string;
  subtitle: string;
  navItems: SidebarNavItem[];
  activeModule: string;
  onSelectModule: (module: string) => void;
  guardrailText: string[];
}

export function RoleSidebar({ title, subtitle, navItems, activeModule, onSelectModule, guardrailText }: RoleSidebarProps) {
  return (
    <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 shrink-0 no-print">
      <div className="mb-3 px-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          {title}
        </p>
        <p className="text-xs font-bold text-slate-900 mt-0.5">{subtitle}</p>
      </div>

      <div className="space-y-1">
        {navItems.map((nav) => {
          const Icon = nav.icon;
          const isActive = activeModule === nav.id;
          return (
            <button
              key={nav.id}
              type="button"
              onClick={() => onSelectModule(nav.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                isActive ? 'bg-[#0B2545] text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{nav.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1.5">
        <p className="font-bold text-slate-900">Core Financial Guardrails</p>
        {guardrailText.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </aside>
  );
}
