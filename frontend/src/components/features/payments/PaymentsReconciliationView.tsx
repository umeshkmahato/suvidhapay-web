import React, { useState } from 'react';
import { PaymentRecord, ReconciliationItem, RefundDisputeRecord } from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

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
                        <div className="font-mono font-bold text-slate-900">{p.id}</div>
                        <div className="font-mono text-[11px] text-slate-500">{p.referenceNumber}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{p.entityName}</div>
                        <div className="font-mono text-slate-500">{p.registrationNumber}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{p.method}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatInr(p.amountInr)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-slate-900">{p.processingStatus}</div>
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
                          <span className="font-mono text-slate-500">{p.receiptNumber || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
                      <div className="font-mono font-semibold text-slate-900">{r.suvidhaPaymentId}</div>
                      <div className="text-slate-500">{r.entityName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatInr(r.gatewayAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatInr(r.ledgerAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                      {formatInr(r.differenceAmount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{r.status}</div>
                      <div className="text-slate-500 text-[11px] max-w-xs">{r.reviewNotes}</div>
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
                    {d.id} · {d.recordType} · {formatInr(d.amountInr)} · Reason: {d.reasonCode}
                  </div>
                  <p className="text-slate-800 font-medium">
                    Entity: {d.entityName} ({d.registrationNumber}) · Payment: <span className="font-mono">{d.paymentId}</span> · Receipt: <span className="font-mono">{d.receiptNumber}</span>
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

