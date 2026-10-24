import React, { useState } from 'react';
import { QrCode } from 'lucide-react';
import { DailyClosingRecord, ReceiptRecord } from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

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
                  <span className="font-mono font-bold text-sm text-slate-900">{c.id}</span>
                  <span>·</span>
                  <span className="font-semibold text-slate-900">{c.agentName} ({c.agentId})</span>
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
                    Pending UPI UTRs: {c.pendingManualUpiCount} ({formatInr(c.pendingManualUpiTotal)})
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
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.receiptNumber}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{r.dateTime}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{r.entityName}</div>
                    <div className="font-mono text-slate-500">{r.registrationNumber}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <div>{r.paymentMethod}</div>
                    <div className="text-slate-500 text-[11px]">{r.transactionReference}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatInr(r.previousOutstanding)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                    {formatInr(r.currentPayment)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {formatInr(r.remainingOutstanding)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700">{r.status}</td>
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

