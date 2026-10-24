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
} from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={genCatId}
                onChange={(e) => setGenCatId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Ward Scope</label>
              <select
                value={genWardId}
                onChange={(e) => setGenWardId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Generation Period</label>
              <input
                value={genPeriod}
                onChange={(e) => setGenPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <p className="font-semibold text-slate-900">Preview</p>
            <div className="flex justify-between text-slate-700">
              <span>Selected Rate</span>
              <span className="font-mono font-bold">{selectedRate.id} · {formatInr(selectedRate.amountInr)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Category</span>
              <span>{selectedCategory.name}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Ward</span>
              <span>{wards.find((w) => w.id === genWardId)?.name || wards[0].name}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleRunBatchGeneration}
              className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
            >
              Generate Preview Batch Due
            </button>
          </div>

          {genConfirmed && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium">
              Due preview generated successfully for the current period. New ledger rows are ready to commit.
            </div>
          )}
        </div>
      )}

      {subTab === 'WAIVERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Section 19 — Adjustment / Waiver Request Queue
            </h3>
            <div className="space-y-3">
              {adjustments.map((adj) => (
                <div key={adj.id} className="p-3.5 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{adj.id} · {adj.entityName}</div>
                      <div className="text-slate-600 mt-0.5">{adj.reason}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-900">{formatInr(adj.amountInr)}</div>
                      <div className="text-slate-500">{adj.type}</div>
                    </div>
                  </div>
                  {adj.approvalStatus === 'PENDING' && (
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        onClick={() => onApproveRejectAdjustment(adj.id, 'APPROVED')}
                        className="px-2.5 py-1 bg-emerald-700 text-white rounded font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onApproveRejectAdjustment(adj.id, 'REJECTED')}
                        className="px-2.5 py-1 bg-red-700 text-white rounded font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              New Waiver / Due Adjustment
            </h3>
            <form onSubmit={handleSubmitAdjustment} className="space-y-3 mt-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Due</label>
                <select
                  value={selectedDueId}
                  onChange={(e) => setSelectedDueId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {dues.map((d) => (
                    <option key={d.id} value={d.id}>{d.id} — {d.entityName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as 'WAIVER' | 'ADJUSTMENT')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="WAIVER">WAIVER</option>
                    <option value="ADJUSTMENT">ADJUSTMENT</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason</label>
                <textarea
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Supporting Ref</label>
                <input
                  value={adjRef}
                  onChange={(e) => setAdjRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#0B2545] text-white rounded-lg font-medium"
              >
                Submit Adjustment Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

