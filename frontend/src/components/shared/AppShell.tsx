import React from 'react';
import { Database, QrCode, RefreshCw } from 'lucide-react';

interface AppShellHeaderProps {
  userName: string;
  activeRole: string;
  onGoHome: () => void;
  onOpenTraceability: () => void;
  onSignOut: () => void;
}

export function AppShellHeader({
  userName,
  activeRole,
  onGoHome,
  onOpenTraceability,
  onSignOut,
}: AppShellHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-8 no-print">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onGoHome();
        }}
        className="text-lg font-bold tracking-tight text-[#0B2545] whitespace-nowrap shrink-0 font-display"
      >
        SuvidhaPay
      </a>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-slate-800">{userName}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{activeRole} workspace</p>
        </div>
        <button
          type="button"
          onClick={onOpenTraceability}
          className="rounded-lg bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Traceability Matrix
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

interface AppShellContextBarProps {
  dbStatus: string;
  lastSyncedAt: string | null;
  isDbLoading: boolean;
  onRefresh: () => void;
  onOpenPublicVerify: () => void;
  activeRole: string;
}

export function AppShellContextBar({
  dbStatus,
  lastSyncedAt,
  isDbLoading,
  onRefresh,
  onOpenPublicVerify,
  activeRole,
}: AppShellContextBarProps) {
  return (
    <div className="bg-slate-900 text-slate-200 px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-4 no-print">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-white">Noida Municipal Corporation</span>
        <span className="text-slate-500">·</span>
        <span>Tagline: Transparent Collections. Trusted Governance.</span>
        <span className="text-slate-500">·</span>
        <span className="font-mono text-teal-300">Active Workspace: {activeRole}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-[11px]">
          <Database className="w-3 h-3 text-emerald-400" />
          <span className="text-slate-400">DB:</span>
          <span className="font-semibold text-emerald-300 font-mono">{dbStatus}</span>
          {lastSyncedAt && <span className="text-[10px] text-slate-400">({lastSyncedAt})</span>}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isDbLoading}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#134074] hover:bg-[#0B2545] text-white rounded text-[11px] font-medium transition-colors"
          title="Reload latest state from PostgreSQL database"
        >
          <RefreshCw className={`w-3 h-3 ${isDbLoading ? 'animate-spin' : ''}`} />
          <span>{isDbLoading ? 'Syncing...' : 'Sync DB'}</span>
        </button>

        <span className="text-slate-600">·</span>

        <button
          type="button"
          onClick={onOpenPublicVerify}
          className="text-slate-200 hover:text-white underline font-medium flex items-center gap-1"
        >
          <QrCode className="w-3.5 h-3.5 text-teal-400" />
          <span>Public Receipt Verification (Sec 34)</span>
        </button>
      </div>
    </div>
  );
}

