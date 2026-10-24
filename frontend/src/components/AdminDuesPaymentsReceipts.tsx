import React, { useState } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Layers,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Lock,
  QrCode,
  Printer,
  Check,
  X,
} from 'lucide-react';
import {
  DueRecord,
  DueAdjustment,
  RateMaster,
  EntityCategory,
  Ward,
  PaymentRecord,
  ReconciliationItem,
  RefundDisputeRecord,
  DailyClosingRecord,
  ReceiptRecord,
} from '../types/suvidha';
import { formatInr } from '../data/mockSuvidhaData';

interface DueLedgerAndGeneratorViewProps {
  dues: DueRecord[];
  adjustments: DueAdjustment[];
  rates: RateMaster[];
  categories: EntityCategory[];
  wards: Ward[];
  onGenerateBatchDues: (newDues: DueRecord[]) => void;
  onApproveRejectAdjustment: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  onCreateAdjustment: (adj: DueAdjustment) => void;
}

export const DueLedgerAndGeneratorView: React.FC<DueLedgerAndGeneratorViewProps> = ({
  dues,
  adjustments,
  rates,
  categories,
  wards,
  onGenerateBatchDues,
  onApproveRejectAdjustment,
  onCreateAdjustment,
}) => {
  const [subTab, setSubTab] = useState<'LEDGER' | 'BATCH_GENERATOR' | 'WAIVERS'>('LEDGER');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genCatId, setGenCatId] = useState('CAT-AUTO');
  const [genWardId, setGenWardId] = useState('WD-12');
  const [genPeriod, setGenPeriod] = useState('Nov 2026 (01/11/2026 – 30/11/2026)');
  const [genConfirmed, setGenConfirmed] = useState(false);

  // Adjustment / Waiver form state (Sec 19)
  const [selectedDueId, setSelectedDueId] = useState(dues[0]?.id || 'DUE-2026-101');
  const [adjType, setAdjType] = useState<'WAIVER' | 'ADJUSTMENT'>('WAIVER');
  const [adjAmount, setAdjAmount] = useState(100);
  const [adjReason, setAdjReason] = useState(
    'Municipal road excavation blocked stand entry for 5 days; verified by Ward Inspector.'
  );
  const [adjRef, setAdjRef] = useState('NMC-WARD12-PANCHNAMA-402');

  const filteredDues = dues.filter(
    (d) => statusFilter === 'ALL' || d.status === statusFilter
  );

  const selectedCategory = categories.find((c) => c.id === genCatId) || categories[0];
  const selectedRate =
    rates.find((r) => r.categoryId === genCatId && r.status === 'ACTIVE') || rates[0];

  const handleRunBatchGeneration = () => {
    const sampleNewDue: DueRecord = {
      id: `DUE-2026-${100 + dues.length + 1}`,
      entityId: 'ENT-1001',
      entityName: 'Ramesh Chandra Yadav',
      registrationNumber: 'UP-16-AB-1234',
      categoryName: selectedCategory.name,
      wardName: wards.find((w) => w.id === genWardId)?.name || wards[0].name,
      rateId: selectedRate.id,
      feeType: `${selectedRate.feeType} (${genPeriod.split(' ')[0]} 2026)`,
      periodStart: '01/11/2026',
      periodEnd: '30/11/2026',
      originalAmount: selectedRate.amountInr,
      adjustmentsAmount: 0,
      waiversAmount: 0,
      paidAmount: 0,
      outstandingAmount: selectedRate.amountInr,
      status: 'PENDING',
      generationDate: '10/10/2026',
    };
    onGenerateBatchDues([sampleNewDue]);
    setGenConfirmed(true);
  };

  const targetDue = dues.find((d) => d.id === selectedDueId) || dues[0];

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDue) return;
    const newAdj: DueAdjustment = {
      id: `ADJ-2026-0${adjustments.length + 20}`,
      dueId: targetDue.id,
      entityId: targetDue.entityId,
      entityName: `${targetDue.entityName} (${targetDue.registrationNumber})`,
      type: adjType,
      amountInr: adjAmount,
      beforeBalance: targetDue.outstandingAmount,
      afterBalance: Math.max(0, targetDue.outstandingAmount - adjAmount),
      reason: adjReason,
      supportingRef: adjRef,
      requestedBy: 'Rajeshwari Verma (Revenue Officer)',
      requestedAt: '10/10/2026 11:30',
      approvalStatus: 'PENDING',
    };
    onCreateAdjustment(newAdj);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Part E — Due Engine, Historical Ledger & Waiver Governance (Sec 17–19)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical dues retain their original generated amounts (<span className="font-mono">RT-2025-01 @ ₹400</span>) even when current rates increase (<span className="font-mono">RT-2026-01 @ ₹450</span>). Zero ordinary delete actions allowed.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'LEDGER', label: `Due Directory & Ledger (${dues.length})` },
            { id: 'BATCH_GENERATOR', label: 'Rate-Based Due Generation (Sec 18)' },
            { id: 'WAIVERS', label: `Adjustments & Waivers (${adjustments.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                subTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Filter Due Status:</span>
              {(['ALL', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'WAIVED'] as const).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded font-mono text-[11px] ${
                      statusFilter === st
                        ? 'bg-[#0B2545] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
            <div className="text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-700" />
              <span>Immutable Financial Ledger — Ordinary Delete Prohibited</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Due ID & Period</th>
                  <th className="py-2.5 px-3">Entity & Reg No</th>
                  <th className="py-2.5 px-3">Rate Reference & Fee Type</th>
                  <th className="py-2.5 px-3 text-right">Original Amt</th>
                  <th className="py-2.5 px-3 text-right">Waivers / Adj</th>
                  <th className="py-2.5 px-3 text-right">Allocated Paid</th>
                  <th className="py-2.5 px-3 text-right">Remaining Due</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDues.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{d.id}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {d.periodStart} – {d.periodEnd}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{d.entityName}</div>
                      <div className="font-mono text-slate-500">
                        {d.registrationNumber} · {d.wardName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{d.feeType}</div>
                      <div className="font-mono text-[11px] text-teal-700">
                        Rate ID: {d.rateId} · Generated: {d.generationDate}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                      {formatInr(d.originalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                      {d.waiversAmount + d.adjustmentsAmount > 0
                        ? `-${formatInr(d.waiversAmount + d.adjustmentsAmount)}`
                        : '₹0'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                      {formatInr(d.paidAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatInr(d.outstandingAmount)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      <span
                        className={
                          d.status === 'PAID'
                            ? 'text-emerald-700'
                            : d.status === 'DISPUTED'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'BATCH_GENERATOR' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-4xl text-xs">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Section 18 — Rate-Based Batch Due Generation Engine
            </h3>
            <p className="text-slate-500 mt-0.5">
              Preview exact affected entities, rate references, and duplicate-generation guards before committing new periodic dues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                1. Target Entity Category *
              </label>
              <select
                value={genCatId}
                onChange={(e) => {
                  setGenCatId(e.target.value);
                  setGenConfirmed(false);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                2. Jurisdiction Ward Scope *
              </label>
              <select
                value={genWardId}
                onChange={(e) => {
                  setGenWardId(e.target.value);
                  setGenConfirmed(false);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                3. Billing Period *
              </label>
              <select
                value={genPeriod}
                onChange={(e) => {
                  setGenPeriod(e.target.value);
                  setGenConfirmed(false);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              >
                <option value="Nov 2026 (01/11/2026 – 30/11/2026)">
                  Nov 2026 (01/11/2026 – 30/11/2026)
                </option>
                <option value="Oct 2026 (01/10/2026 – 31/10/2026) [DUPLICATE CHECK]">
                  Oct 2026 (01/10/2026 – 31/10/2026)
                </option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-500">Authoritative Rate ID</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {selectedRate.id} ({formatInr(selectedRate.amountInr)}/mo)
              </p>
            </div>
            <div>
              <span className="text-slate-500">Affected Active Entities</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {selectedCategory.entitiesCount} Entities
              </p>
            </div>
            <div>
              <span className="text-slate-500">Estimated Total Demand</span>
              <p className="font-mono font-bold text-emerald-700 mt-0.5">
                {formatInr(selectedCategory.entitiesCount * selectedRate.amountInr)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Duplicate Period Check</span>
              <p className="font-mono font-semibold text-slate-900 mt-0.5">
                {genPeriod.includes('Oct')
                  ? 'WARNING: 214 Already Generated'
                  : '0 Duplicates — Safe to Run'}
              </p>
            </div>
          </div>

          {genConfirmed ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <span>
                  Batch Generation Completed! New due records committed to immutable
                  ledger with Rate Reference <strong>{selectedRate.id}</strong>.
                </span>
              </div>
              <button
                onClick={() => setSubTab('LEDGER')}
                className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg font-medium"
              >
                View in Ledger
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={handleRunBatchGeneration}
                className="px-5 py-2.5 bg-[#0B2545] hover:bg-slate-800 text-white rounded-lg font-medium"
              >
                Confirm & Execute Batch Due Generation
              </button>
            </div>
          )}
        </div>
      )}

      {subTab === 'WAIVERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <form
            onSubmit={handleSubmitAdjustment}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Section 19 — Request Due Adjustment or Waiver
            </h3>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Target Due Record *
              </label>
              <select
                value={selectedDueId}
                onChange={(e) => setSelectedDueId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              >
                {dues.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.registrationNumber} (Bal: {formatInr(d.outstandingAmount)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Action Type *
                </label>
                <select
                  value={adjType}
                  onChange={(e) =>
                    setAdjType(e.target.value as 'WAIVER' | 'ADJUSTMENT')
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                >
                  <option value="WAIVER">WAIVER (Credit)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Amount (INR) *
                </label>
                <input
                  type="number"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            {targetDue && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between font-mono">
                <span>Before Balance: {formatInr(targetDue.outstandingAmount)}</span>
                <span>→</span>
                <span className="font-bold text-emerald-700">
                  After Balance:{' '}
                  {formatInr(Math.max(0, targetDue.outstandingAmount - adjAmount))}
                </span>
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Supporting Circular / Order Reference *
              </label>
              <input
                type="text"
                required
                value={adjRef}
                onChange={(e) => setAdjRef(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Mandatory Audit Justification *
              </label>
              <textarea
                rows={2}
                required
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-[#0B2545] text-white rounded-lg font-medium hover:bg-slate-800"
            >
              Submit Financial Adjustment for Approval
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Adjustment & Waiver Approval Audit Trail
            </h3>
            <div className="space-y-3">
              {adjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">
                      {adj.id} · Due {adj.dueId} · {adj.type} of{' '}
                      {formatInr(adj.amountInr)}
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      Status: {adj.approvalStatus}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">{adj.entityName}</p>
                  <p className="text-slate-600">
                    Reason: {adj.reason} (Ref:{' '}
                    <span className="font-mono">{adj.supportingRef}</span>)
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                    <span className="font-mono">
                      Balance: {formatInr(adj.beforeBalance)} →{' '}
                      {formatInr(adj.afterBalance)} · By {adj.requestedBy}
                    </span>
                    {adj.approvalStatus === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            onApproveRejectAdjustment(adj.id, 'APPROVED')
                          }
                          className="px-2.5 py-1 bg-emerald-700 text-white rounded font-medium"
                        >
                          Approve Waiver
                        </button>
                        <button
                          onClick={() =>
                            onApproveRejectAdjustment(adj.id, 'REJECTED')
                          }
                          className="px-2.5 py-1 bg-red-700 text-white rounded font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PaymentsReconciliationViewProps {
  payments: PaymentRecord[];
  reconciliations: ReconciliationItem[];
  disputes: RefundDisputeRecord[];
  onVerifyManualUpi: (paymentId: string) => void;
  onResolveReconciliation: (id: string, note: string) => void;
  onResolveDispute: (id: string, status: 'APPROVED' | 'REJECTED' | 'RESOLVED') => void;
}

export const PaymentsReconciliationView: React.FC<PaymentsReconciliationViewProps> = ({
  payments,
  reconciliations,
  disputes,
  onVerifyManualUpi,
  onResolveReconciliation,
  onResolveDispute,
}) => {
  const [subTab, setSubTab] = useState<
    'PAYMENTS_ALLOCATION' | 'GATEWAY_SIM' | 'RECONCILIATION' | 'REFUNDS_DISPUTES'
  >('PAYMENTS_ALLOCATION');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord>(payments[0]);
  const [gwSimState, setGwSimState] = useState<
    | 'ORDER_CREATED'
    | 'CUSTOMER_INITIATED'
    | 'PAYMENT_PENDING'
    | 'WEBHOOK_VERIFIED_SUCCESS'
    | 'PAYMENT_FAILED'
    | 'SETTLEMENT_COMPLETED'
  >('WEBHOOK_VERIFIED_SUCCESS');

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Part H — Payments, Atomic Multi-Due Allocation & Financial Reconciliation (Sec 28–32)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distinguishes processing status, settlement status, and receipt status. Browser redirects never mark a payment PAID without backend verification.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'PAYMENTS_ALLOCATION', label: 'Payments & Atomic Allocation (Sec 28–29)' },
            { id: 'GATEWAY_SIM', label: 'Online Gateway & Webhooks (Sec 30)' },
            { id: 'RECONCILIATION', label: `Settlement Reconciliation (${reconciliations.length})` },
            { id: 'REFUNDS_DISPUTES', label: `Refunds, Reversals & Disputes (${disputes.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                subTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'PAYMENTS_ALLOCATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Section 28 — Payment Ledger & Pending Manual UPI Queue
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2 px-3">Payment ID & Ref</th>
                    <th className="py-2 px-3">Entity</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Lifecycle & Settlement</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPayment(p)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selectedPayment?.id === p.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900">
                          {p.id}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {p.referenceNumber}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {p.entityName}
                        </div>
                        <div className="font-mono text-slate-500">
                          {p.registrationNumber}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{p.method}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatInr(p.amountInr)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-slate-900">
                          {p.processingStatus}
                        </div>
                        <div
                          className={`font-mono text-[11px] ${
                            p.settlementStatus === 'SETTLED'
                              ? 'text-emerald-700'
                              : 'text-amber-700 font-semibold'
                          }`}
                        >
                          {p.settlementStatus}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.settlementStatus === 'UNVERIFIED_MANUAL_REF' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerifyManualUpi(p.id);
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded font-medium"
                          >
                            Verify UTR
                          </button>
                        ) : (
                          <span className="font-mono text-slate-500">
                            {p.receiptNumber || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 29 Atomic Payment Allocation Breakdown */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-[11px] font-mono uppercase text-teal-700 font-semibold">
                Section 29 — Atomic Multi-Due Payment Allocation
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                {selectedPayment.id} — {formatInr(selectedPayment.amountInr)} Distributed Across Dues
              </h3>
              <p className="text-slate-500 mt-0.5">
                Entity: {selectedPayment.entityName} ({selectedPayment.registrationNumber}) · Timestamp: {selectedPayment.timestamp}
              </p>
            </div>

            <div className="space-y-2.5">
              {selectedPayment.allocations.map((alloc, idx) => (
                <div
                  key={`${alloc.dueId}-${idx}`}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-mono font-bold text-slate-900">
                      {alloc.dueId} ({alloc.periodLabel})
                    </p>
                    <p className="text-slate-500">
                      {alloc.feeType} · Original Due: {formatInr(alloc.dueOriginalAmount)}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-emerald-700">
                      Allocated: {formatInr(alloc.allocatedAmount)}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Remaining Bal: {formatInr(alloc.remainingDueBalance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-lg font-mono text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Total Payment Received:</span>
                <span>{formatInr(selectedPayment.amountInr)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Total Atomically Allocated:</span>
                <span>{formatInr(selectedPayment.amountInr)} (Unallocated: ₹0)</span>
              </div>
              <div className="pt-1 border-t border-slate-700 text-slate-400 font-sans">
                12-State Lifecycle: CREATED → PENDING → SUCCESS → ALLOCATED → RECEIPT_GENERATED → NOTIFIED
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'GATEWAY_SIM' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Section 30 — Online Payment Gateway, Dynamic QR & Authoritative Webhook State Machine
              </h3>
              <p className="text-slate-500">
                Active Provider: Razorpay Gov Node (Primary) & Cashfree (Failover) · Idempotency Key Enforced
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  'ORDER_CREATED',
                  'CUSTOMER_INITIATED',
                  'PAYMENT_PENDING',
                  'WEBHOOK_VERIFIED_SUCCESS',
                  'PAYMENT_FAILED',
                  'SETTLEMENT_COMPLETED',
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  onClick={() => setGwSimState(st)}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] border ${
                    gwSimState === st
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900">
                Current Simulated Gateway State: <span className="font-mono text-teal-700">{gwSimState}</span>
              </h4>
              <p className="text-slate-600 leading-relaxed">
                {gwSimState === 'PAYMENT_PENDING'
                  ? 'Browser callback received, but HMAC-SHA256 backend webhook has NOT arrived yet. UI strictly displays WAITING_FOR_CONFIRMATION and withholds final receipt.'
                  : gwSimState === 'WEBHOOK_VERIFIED_SUCCESS'
                  ? 'Authoritative Razorpay payment.captured webhook verified. Atomic due allocation and server receipt SUP/2026/000012346 generated.'
                  : 'Inspect how SuvidhaPay separates client browser interaction from backend cryptographic payment verification.'}
              </p>
              <div className="p-3 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-700">
                Order ID: order_Pf992kLm81xQz · Txn Ref: pay_Pf998zYq109Lm · Signature: HMAC_VERIFIED
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900">Recent Gateway Webhook Event Log</h4>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="p-2 bg-white border border-slate-200 rounded flex justify-between">
                  <span>10/10 09:32:14 · payment.captured</span>
                  <span className="text-emerald-700 font-semibold">200 OK (Processed)</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded flex justify-between">
                  <span>10/10 09:32:16 · payment.captured (Retry)</span>
                  <span className="text-slate-500">200 IDEMPOTENT_SKIP</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded flex justify-between">
                  <span>09/10 19:44:02 · order.paid (order_Pf810)</span>
                  <span className="text-red-700 font-semibold">502 TIMEOUT (Queued in Recon)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'RECONCILIATION' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Section 31 — Gateway vs SuvidhaPay Ledger vs Bank Settlement Reconciliation
              </h3>
              <p className="text-slate-500">
                Reconciliation never silently alters historical ledger records; discrepancies are resolved via auditable adjustment/replay workflows.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Recon ID & Provider</th>
                  <th className="py-2.5 px-3">Gateway Order / Txn</th>
                  <th className="py-2.5 px-3">SuvidhaPay Payment</th>
                  <th className="py-2.5 px-3 text-right">Gateway Amt</th>
                  <th className="py-2.5 px-3 text-right">Ledger Amt</th>
                  <th className="py-2.5 px-3 text-right">Diff</th>
                  <th className="py-2.5 px-3">Status & Notes</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reconciliations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{r.id}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {r.gatewayProvider} · {r.txnDate}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div>{r.gatewayOrderId}</div>
                      <div className="text-slate-500 text-[11px]">{r.gatewayTxnId}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-semibold text-slate-900">
                        {r.suvidhaPaymentId}
                      </div>
                      <div className="text-slate-500">{r.entityName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatInr(r.gatewayAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatInr(r.ledgerAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                      {formatInr(r.differenceAmount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">
                        {r.status}
                      </div>
                      <div className="text-slate-500 text-[11px] max-w-xs">
                        {r.reviewNotes}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {r.status !== 'MATCHED' && (
                        <button
                          onClick={() =>
                            onResolveReconciliation(
                              r.id,
                              'Verified against nodal bank UTR statement; idempotent ledger entry reconciled.'
                            )
                          }
                          className="px-2.5 py-1 bg-[#0B2545] text-white rounded font-medium"
                        >
                          Resolve Exception
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'REFUNDS_DISPUTES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-900">
            Section 32 — Refunds, Reversals & Citizen Disputes Queue
          </h3>
          <div className="space-y-3">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="font-mono font-bold text-slate-900">
                    {d.id} · {d.recordType} · {formatInr(d.amountInr)} · Reason:{' '}
                    {d.reasonCode}
                  </div>
                  <p className="text-slate-800 font-medium">
                    Entity: {d.entityName} ({d.registrationNumber}) · Payment:{' '}
                    <span className="font-mono">{d.paymentId}</span> · Receipt:{' '}
                    <span className="font-mono">{d.receiptNumber}</span>
                  </p>
                  <p className="text-slate-600">{d.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded">
                    {d.status}
                  </span>
                  {d.status !== 'RESOLVED' && d.status !== 'APPROVED' && (
                    <>
                      <button
                        onClick={() => onResolveDispute(d.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-medium"
                      >
                        Approve & Log Reversal
                      </button>
                      <button
                        onClick={() => onResolveDispute(d.id, 'REJECTED')}
                        className="px-3 py-1.5 bg-red-700 text-white rounded-lg font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CashControlAndReceiptsViewProps {
  closings: DailyClosingRecord[];
  receipts: ReceiptRecord[];
  onVerifyClosing: (id: string, status: 'OFFICER_VERIFIED' | 'CLOSED', comment: string) => void;
  onSelectReceipt: (r: ReceiptRecord) => void;
  onOpenPublicVerify: () => void;
}

export const CashControlAndReceiptsView: React.FC<CashControlAndReceiptsViewProps> = ({
  closings,
  receipts,
  onVerifyClosing,
  onSelectReceipt,
  onOpenPublicVerify,
}) => {
  const [officerNote, setOfficerNote] = useState(
    'Physical cash counted and verified against Ward chest challan.'
  );

  return (
    <div className="space-y-6 text-xs">
      {/* Section 26 & 27 Daily Cash Closing & Officer Reconciliation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Part G — Agent Daily Cash Closing & Officer Cash Reconciliation (Sec 26–27)
            </h2>
            <p className="text-slate-500 mt-0.5">
              Workflow: <span className="font-mono">OPEN → SUBMITTED → OFFICER_VERIFIED → CLOSED</span>. Submitted closings cannot be silently edited.
            </p>
          </div>
          <div className="w-full md:w-96">
            <input
              type="text"
              value={officerNote}
              onChange={(e) => setOfficerNote(e.target.value)}
              placeholder="Officer verification comment..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {closings.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                c.cashVariance !== 0
                  ? 'bg-amber-50/50 border-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {c.id}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-slate-900">
                    {c.agentName} ({c.agentId})
                  </span>
                  <span>·</span>
                  <span className="text-slate-600">{c.wardName}</span>
                </div>
                <div className="flex flex-wrap gap-4 font-mono text-slate-700 pt-1">
                  <span>Expected Cash: {formatInr(c.expectedCash)}</span>
                  <span>Actual Count: {formatInr(c.actualCashCount)}</span>
                  <span
                    className={
                      c.cashVariance < 0
                        ? 'text-red-700 font-bold'
                        : 'text-emerald-700 font-bold'
                    }
                  >
                    Variance: {formatInr(c.cashVariance)}
                  </span>
                  <span>Verified Digital: {formatInr(c.verifiedDigitalTotal)}</span>
                  <span>
                    Pending UPI UTRs: {c.pendingManualUpiCount} (
                    {formatInr(c.pendingManualUpiTotal)})
                  </span>
                </div>
                {c.discrepancyNote && (
                  <p className="text-slate-600 pt-1">
                    Agent Explanation: &ldquo;{c.discrepancyNote}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded">
                  {c.status}
                </span>
                {c.status === 'SUBMITTED' && (
                  <button
                    onClick={() =>
                      onVerifyClosing(c.id, 'CLOSED', officerNote)
                    }
                    className="px-3 py-1.5 bg-[#0B2545] hover:bg-slate-800 text-white rounded-lg font-medium"
                  >
                    Officer Verify & Close Chest
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 33 & 34 Official Receipts Directory */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Part I — Official Municipal Receipts Directory (Sec 33–34)
            </h3>
            <p className="text-slate-500 mt-0.5">
              Server-generated numbering (<span className="font-mono">SUP/2026/000012345</span>). Client never invents receipt IDs.
            </p>
          </div>
          <button
            onClick={onOpenPublicVerify}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Public Receipt Verifier (Sec 34)</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Receipt Number</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Payer / Entity</th>
                <th className="py-2.5 px-3">Method & Ref</th>
                <th className="py-2.5 px-3 text-right">Prev Due</th>
                <th className="py-2.5 px-3 text-right">Paid</th>
                <th className="py-2.5 px-3 text-right">Remaining</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {r.receiptNumber}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {r.dateTime}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">
                      {r.entityName}
                    </div>
                    <div className="font-mono text-slate-500">
                      {r.registrationNumber}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <div>{r.paymentMethod}</div>
                    <div className="text-slate-500 text-[11px]">
                      {r.transactionReference}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatInr(r.previousOutstanding)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                    {formatInr(r.currentPayment)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {formatInr(r.remainingOutstanding)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700">
                    {r.status}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onSelectReceipt(r)}
                      className="px-2.5 py-1 bg-[#0B2545] text-white rounded font-medium"
                    >
                      View / Print PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
