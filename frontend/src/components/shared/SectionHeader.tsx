import React from 'react';

export interface SectionHeaderTab {
  id: string;
  label: string;
  count?: number;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  tabs?: SectionHeaderTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {(tabs || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {tabs && (
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {typeof tab.count === 'number' && ` (${tab.count})`}
                </button>
              ))}
            </div>
          )}

          {actions}
        </div>
      )}
    </div>
  );
}

