import React, { useState } from 'react';
import {
  ArrowUpRight,
  Download,
} from 'lucide-react';
import {
  MunicipalEntity,
  Ward,
  EntityCategory,
  PaymentRecord,
  DailyClosingRecord,
  ReconciliationItem,
  RefundDisputeRecord,
} from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

interface AdminDashboardViewProps {
  entities: MunicipalEntity[];
  payments: PaymentRecord[];
  closings: DailyClosingRecord[];
  reconciliations: ReconciliationItem[];
  disputes: RefundDisputeRecord[];
  wards: Ward[];
  categories: EntityCategory[];
  selectedWardFilter: string;
  setSelectedWardFilter: (w: string) => void;
  onNavigateModule: (mod: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  entities,
  payments,
  closings,
  reconciliations,
  disputes,
  wards,
  categories,
  selectedWardFilter,
  setSelectedWardFilter,
  onNavigateModule,
}) => {
  const [dateRange, setDateRange] = useState('TODAY_10_OCT_2026');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState('ALL');

  const cashPayments = payments.filter(
    (p) => p.method === 'CASH' && (p.settlementStatus === 'SETTLED' || p.processingStatus === 'RECEIPT_GENERATED')
  );
  const cashTotal = cashPayments.reduce((acc, p) => acc + p.amountInr, 0);

  const verifiedDigitalPayments = payments.filter(
    (p) =>
      (p.method === 'PAYMENT_GATEWAY' ||
        (p.method === 'UPI_REFERENCE' && p.settlementStatus === 'SETTLED') ||
        p.processingStatus === 'RECEIPT_GENERATED') &&
      p.method !== 'CASH' &&
      p.settlementStatus !== 'REVERSED'
  );
  const verifiedDigitalTotal = verifiedDigitalPayments.reduce((acc, p) => acc + p.amountInr, 0);

  const todayTotalCollection = cashTotal + verifiedDigitalTotal;
  const totalOutstanding = entities.reduce((acc, e) => acc + (e.outstandingAmount || 0), 0);
  const pendingRegistrations = entities.filter(
    (e) => e.registrationStatus === 'SUBMITTED' || e.registrationStatus === 'UNDER_REVIEW'
  ).length;
  const pendingManualUpiPayments = payments.filter(
    (p) => p.settlementStatus === 'UNVERIFIED_MANUAL_REF'
  );
  const pendingManualUpi = pendingManualUpiPayments.length;
  const pendingManualUpiTotal = pendingManualUpiPayments.reduce((acc, p) => acc + p.amountInr, 0);
  const openDisputes = disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length;
  const pendingClosings = closings.filter((c) => c.status === 'SUBMITTED').length;
  const reconExceptions = reconciliations.filter((r) => r.status !== 'MATCHED').length;

  const kpiCards = [
    {
      label: "Today's Total Collection",
      value: formatInr(todayTotalCollection),
      sub: 'Cash + Verified Digital (Excludes Pending UTR)',
      targetModule: 'payments_recon',
      tone: 'text-slate-900',
    },
    {
      label: "Today's Cash Collection",
      value: formatInr(cashTotal),
      sub: `${cashPayments.length} verified field receipts`,
      targetModule: 'cash_closing',
      tone: 'text-slate-900',
    },
    {
      label: "Today's Verified Digital",
      value: formatInr(verifiedDigitalTotal),
      sub: `${verifiedDigitalPayments.length} digital webhook & bank verified`,
      targetModule: 'payments_recon',
      tone: 'text-emerald-700',
    },
    {
      label: 'Total Outstanding Dues',
      value: formatInr(totalOutstanding),
      sub: 'Current Period Ledger Assessment',
      targetModule: 'dues',
      tone: 'text-slate-900',
    },
    {
      label: 'Registered Entities',
      value: entities.length.toLocaleString('en-IN'),
      sub: 'Vehicles, Autos, E-Rickshaws & Vendors',
      targetModule: 'entities',
      tone: 'text-slate-900',
    },
    {
      label: 'Active Field Agents',
      value: '19 / 21',
      sub: '2 agents with pending closing review',
      targetModule: 'users_wards',
      tone: 'text-slate-900',
    },
    {
      label: 'Pending Registrations',
      value: String(pendingRegistrations),
      sub: 'Awaiting Officer approval / Vahan verify',
      targetModule: 'entities',
      tone: 'text-amber-700',
    },
    {
      label: 'Pending Manual UPI Ref',
      value: `${pendingManualUpi} (${formatInr(pendingManualUpiTotal)})`,
      sub: 'Unverified UTRs — Not counted as PAID',
      targetModule: 'payments_recon',
      tone: 'text-amber-700',
    },
    {
      label: 'Open Disputes & Reversals',
      value: String(openDisputes),
      sub: 'Requires Officer / Admin adjudication',
      targetModule: 'payments_recon',
      tone: 'text-red-700',
    },
    {
      label: 'Pending Cash Closings',
      value: String(pendingClosings),
      sub: `${pendingClosings} awaiting officer sign-off`,
      targetModule: 'cash_closing',
      tone: 'text-amber-700',
    },
    {
      label: 'Reconciliation Exceptions',
      value: String(reconExceptions),
      sub: 'Missing payment / settlement mismatches',
      targetModule: 'payments_recon',
      tone: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Municipal Revenue & Collection Oversight (Section 6)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Last synchronized: 10/10/2026 11:12:04 IST · Authoritative Ledger View (Excludes Unverified Manual UPI & Provisional Offline)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="TODAY_10_OCT_2026">Today (10/10/2026)</option>
            <option value="THIS_WEEK">Last 7 Days (04/10 – 10/10/2026)</option>
            <option value="OCT_2026">October 2026 (MTD)</option>
            <option value="FY_2026_27">FY 2026–27 (Apr – Oct)</option>
          </select>

          <select
            value={selectedWardFilter}
            onChange={(e) => setSelectedWardFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="ALL">All Wards & Zones (Noida MC)</option>
            {wards.map((w) => (
              <option key={w.id} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="ALL">All Entity Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
          >
            <option value="ALL">All Collectors / Channels</option>
            <option value="AG-104">Suresh Kumar Sharma (AG-104)</option>
            <option value="AG-108">Manoj Kumar Tiwari (AG-108)</option>
            <option value="ONLINE">Citizen Online Gateway</option>
          </select>

          <button
            onClick={() => onNavigateModule('reports_audit')}
            className="px-3 py-1.5 bg-[#0B2545] text-white rounded-lg font-medium hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigateModule(card.targetModule)}
            className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">{card.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
            </div>
            <div className={`text-xl font-bold font-mono mt-1.5 ${card.tone}`}>
              {card.value}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {card.sub}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Daily Collection Trend — Cash vs Verified Digital (Last 7 Days)
              </h3>
              <p className="text-xs text-slate-500">
                Unverified manual UPI references are excluded until bank UTR match
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#0B2545] inline-block rounded-xs" />
                Verified Digital
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-teal-600 inline-block rounded-xs" />
                Cash Collected
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            {[
              { day: '04 Oct', digital: 62400, cash: 54100, total: 116500 },
              { day: '05 Oct', digital: 58900, cash: 49800, total: 108700 },
              { day: '06 Oct', digital: 68200, cash: 59400, total: 127600 },
              { day: '07 Oct', digital: 71000, cash: 52300, total: 123300 },
              { day: '08 Oct', digital: 66500, cash: 58900, total: 125400 },
              { day: '09 Oct', digital: 74800, cash: 63200, total: 138000 },
              { day: '10 Oct (Today)', digital: 73350, cash: 61350, total: 134700 },
            ].map((row) => {
              const digPct = Math.round((row.digital / 150000) * 100);
              const cashPct = Math.round((row.cash / 150000) * 100);
              return (
                <div key={row.day} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-2 font-mono text-slate-600">{row.day}</div>
                  <div className="col-span-7 h-5 bg-slate-100 rounded overflow-hidden flex">
                    <div
                      style={{ width: `${digPct}%` }}
                      className="bg-[#0B2545] h-full"
                      title={`Verified Digital: ${formatInr(row.digital)}`}
                    />
                    <div
                      style={{ width: `${cashPct}%` }}
                      className="bg-teal-600 h-full"
                      title={`Cash: ${formatInr(row.cash)}`}
                    />
                  </div>
                  <div className="col-span-3 text-right font-mono font-semibold text-slate-900">
                    {formatInr(row.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                2. Ward-Wise Collection & Outstanding Dues
              </h3>
              <p className="text-xs text-slate-500">
                Click any ward row to filter operational console
              </p>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              {wards.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWardFilter(w.code)}
                  className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>{w.name}</span>
                    <span className="font-mono text-emerald-700">
                      {formatInr(w.todayCollection)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 mt-1">
                    <span>
                      Officer: {w.assignedOfficerName} · {w.registeredEntitiesCount} Entities
                    </span>
                    <span className="font-mono">
                      Dues: {formatInr(w.outstandingDues)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            3. Category-Wise Revenue Share (Oct 2026)
          </h3>
          <div className="space-y-2.5">
            {[
              { name: 'Auto-Rickshaw (Three-Wheeler)', amt: 412500, share: '34%' },
              { name: 'Stationary Kiosk / Tehbazari', amt: 358000, share: '29%' },
              { name: 'E-Rickshaw (Battery Operated)', amt: 214000, share: '18%' },
              { name: 'Commercial Goods Tempo / LCV', amt: 148500, share: '12%' },
              { name: 'Street Hawker / Pushcart', amt: 84200, share: '7%' },
            ].map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-700 font-medium">{c.name}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatInr(c.amt)} ({c.share})
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                  <div style={{ width: c.share }} className="h-full bg-[#0B2545]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            4. Monthly Collection vs Outstanding Trend
          </h3>
          <div className="space-y-2 pt-1">
            {[
              { month: 'May 2026', collected: 3420000, outstanding: 2890000 },
              { month: 'Jun 2026', collected: 3580000, outstanding: 2710000 },
              { month: 'Jul 2026', collected: 3690000, outstanding: 2540000 },
              { month: 'Aug 2026', collected: 3810000, outstanding: 2420000 },
              { month: 'Sep 2026', collected: 3940000, outstanding: 2290000 },
              { month: 'Oct 2026 (10d)', collected: 1217200, outstanding: 2239300 },
            ].map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="font-mono text-slate-600">{m.month}</span>
                <div className="text-right font-mono">
                  <span className="text-emerald-700 font-semibold">{formatInr(m.collected)}</span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-slate-600">Due {formatInr(m.outstanding)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            5. Agent Performance & Gateway Reliability
          </h3>
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Suresh Kumar Sharma (AG-104)</span>
                <span className="font-mono text-emerald-700">₹22,650 (38 Rcpts)</span>
              </div>
              <p className="text-slate-500 mt-0.5">
                Ward 12 · Cash Variance: ₹0 · Closing: SUBMITTED
              </p>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Manoj Kumar Tiwari (AG-108)</span>
                <span className="font-mono text-slate-900">₹24,700 (44 Rcpts)</span>
              </div>
              <p className="text-amber-800 mt-0.5 font-medium">
                Ward 14 · Cash Variance: -₹500 Shortage · Needs Officer Review
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Gateway Success Rate (Razorpay/Cashfree)</span>
                <span className="font-mono text-emerald-700">96.4% Verified</span>
              </div>
              <p className="text-slate-500 mt-0.5">
                2.1% Customer Drop-off · 1.5% Expired QR · 1 Webhook Replay Pending
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

