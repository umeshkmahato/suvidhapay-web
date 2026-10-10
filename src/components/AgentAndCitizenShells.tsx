import React, { useState } from 'react';
import {
  Search,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  FileText,
  UserPlus,
  IndianRupee,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  HelpCircle,
  Lock,
} from 'lucide-react';
import {
  MunicipalEntity,
  PaymentRecord,
  ReceiptRecord,
  DailyClosingRecord,
  DueRecord,
  PaymentMethod,
} from '../types/suvidha';
import { formatInr, normalizeVehicleNumber } from '../data/mockSuvidhaData';

interface FieldAgentWorkspaceProps {
  entities: MunicipalEntity[];
  dues: DueRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  closings: DailyClosingRecord[];
  onRecordCollection: (
    entity: MunicipalEntity,
    amount: number,
    method: PaymentMethod,
    reference: string,
    isOffline: boolean
  ) => ReceiptRecord;
  onSubmitDailyClosing: (actualCash: number, note: string) => void;
  onSelectReceipt: (r: ReceiptRecord) => void;
  onNavigateNewReg: () => void;
}

export const FieldAgentWorkspace: React.FC<FieldAgentWorkspaceProps> = ({
  entities,
  dues,
  payments,
  receipts,
  closings,
  onRecordCollection,
  onSubmitDailyClosing,
  onSelectReceipt,
  onNavigateNewReg,
}) => {
  const [agentTab, setAgentTab] = useState<
    'HOME' | 'SEARCH_COLLECT' | 'RECEIPTS' | 'CLOSING' | 'OFFLINE_QUEUE'
  >('HOME');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineSyncCount, setOfflineSyncCount] = useState(1);

  // Fast Search & Collection State (Sections 21–24)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<MunicipalEntity>(
    entities[0]
  );
  const [collectAmount, setCollectAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI_REFERENCE'>(
    'CASH'
  );
  const [upiReference, setUpiReference] = useState('UTR-628910442190');
  const [collectionOutcome, setCollectionOutcome] = useState<
    | null
    | 'VERIFIED_CASH_SUCCESS'
    | 'PENDING_MANUAL_UPI'
    | 'PROVISIONAL_OFFLINE'
    | 'DUPLICATE_GUARD'
    | 'OVERPAYMENT_BLOCKED'
  >(null);
  const [lastGeneratedReceipt, setLastGeneratedReceipt] =
    useState<ReceiptRecord | null>(null);

  // Daily Closing State (Section 26)
  const expectedCashToday = 14250;
  const [actualCashCount, setActualCashCount] = useState<number>(14250);
  const [closingNote, setClosingNote] = useState(
    'All physical currency notes tallied with Ward 12 collection pouch.'
  );
  const [closingSubmitted, setClosingSubmitted] = useState(false);

  const normalizedSearch = normalizeVehicleNumber(searchQuery);
  const matchedEntities = entities.filter(
    (e) =>
      searchQuery.trim() === '' ||
      e.normalizedIdentifier.includes(normalizedSearch) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.mobile.includes(searchQuery.trim())
  );

  const entityDues = dues.filter(
    (d) => d.entityId === selectedEntity.id && d.outstandingAmount > 0
  );

  const handleConfirmCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (collectAmount > selectedEntity.outstandingAmount) {
      setCollectionOutcome('OVERPAYMENT_BLOCKED');
      return;
    }
    if (collectAmount <= 0) return;

    const ref =
      paymentMethod === 'CASH'
        ? `CASH-AG104-${Date.now().toString().slice(-4)}`
        : upiReference;

    const generated = onRecordCollection(
      selectedEntity,
      collectAmount,
      paymentMethod,
      ref,
      isOfflineMode
    );
    setLastGeneratedReceipt(generated);

    if (isOfflineMode) {
      setOfflineSyncCount((c) => c + 1);
      setCollectionOutcome('PROVISIONAL_OFFLINE');
    } else if (paymentMethod === 'UPI_REFERENCE') {
      setCollectionOutcome('PENDING_MANUAL_UPI');
    } else {
      setCollectionOutcome('VERIFIED_CASH_SUCCESS');
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Agent Mobile Top Status Bar (Section 20 & 52) */}
      <div className="bg-[#0B2545] text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-teal-300 font-mono">
            <span>FIELD COLLECTOR TERMINAL · AG-104</span>
            <span>·</span>
            <span>Ward 12 (Atta Market & Sec 18)</span>
          </div>
          <h2 className="text-lg font-bold mt-0.5">
            Suresh Kumar Sharma — Fast Field Collection Shell
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`px-3 py-2 rounded-xl font-medium flex items-center gap-2 border transition-colors min-h-[44px] ${
              isOfflineMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 text-emerald-300 border-slate-700'
            }`}
          >
            {isOfflineMode ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span>OFFLINE MODE (Provisional Queue Active)</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>ONLINE · Last Sync 11:14 IST</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setCollectionOutcome(null);
              setAgentTab('SEARCH_COLLECT');
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl min-h-[44px] flex items-center gap-1.5"
          >
            <IndianRupee className="w-4 h-4" />
            <span>Quick Collect (&lt;30s Flow)</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Grid for Field Agent */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Summary Metrics & Fast Search List */}
        <div className="lg:col-span-5 space-y-4">
          {/* 7 Required Agent Summary Cards (Sec 20) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-slate-500">Today&apos;s Total Collection</span>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatInr(22650)}
              </p>
              <span className="text-[11px] text-slate-500">38 Receipts Issued</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-slate-500">Cash in Hand (Expected)</span>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatInr(expectedCashToday)}
              </p>
              <span className="text-[11px] text-emerald-700 font-medium">
                Closing: SUBMITTED
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="text-slate-500">Verified Digital</span>
              <p className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                {formatInr(8400)}
              </p>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
              <span className="text-amber-900 font-medium">
                Pending Manual UPI / Sync
              </span>
              <p className="text-base font-bold font-mono text-amber-800 mt-0.5">
                2 UTRs · {offlineSyncCount} Offline
              </p>
            </div>
          </div>

          {/* Section 21 Fast Search Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Section 21 — Fast Vehicle / Vendor Search
              </h3>
              <button
                onClick={onNavigateNewReg}
                className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ New Registration</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Vehicle No (up16ab1234), Vendor ID, Mobile..."
                className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {matchedEntities.map((ent) => (
                <button
                  key={ent.id}
                  onClick={() => {
                    setSelectedEntity(ent);
                    setCollectAmount(ent.outstandingAmount > 0 ? Math.min(500, ent.outstandingAmount) : 0);
                    setCollectionOutcome(null);
                    setAgentTab('SEARCH_COLLECT');
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors min-h-[60px] flex items-center justify-between ${
                    selectedEntity.id === ent.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-mono font-bold text-sm">
                      {ent.registrationNumber}
                    </div>
                    <div
                      className={`text-xs ${
                        selectedEntity.id === ent.id
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {ent.name} · {ent.category}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold">
                      {formatInr(ent.outstandingAmount)}
                    </div>
                    <div
                      className={`text-[10px] ${
                        selectedEntity.id === ent.id
                          ? 'text-teal-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {ent.registrationStatus}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Agent Workflow Screen */}
        <div className="lg:col-span-7">
          {(agentTab === 'HOME' || agentTab === 'SEARCH_COLLECT') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
              {/* Entity Quick Profile Header (Section 22) */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-xs font-mono text-teal-700 font-semibold">
                    Section 22 & 23 — Entity Quick Profile & Under-30s Collection
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedEntity.name} ({selectedEntity.registrationNumber})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedEntity.category} · {selectedEntity.wardName} · Gov Status:{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedEntity.govVerificationStatus}
                    </span>
                  </p>
                </div>
                <div className="text-right bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500">Total Outstanding Due</span>
                  <p className="text-xl font-bold font-mono text-slate-900">
                    {formatInr(selectedEntity.outstandingAmount)}
                  </p>
                </div>
              </div>

              {/* Collection Form */}
              <form onSubmit={handleConfirmCollection} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      1. Collection Amount (INR) *
                    </label>
                    <input
                      type="number"
                      value={collectAmount}
                      onChange={(e) => {
                        setCollectAmount(Number(e.target.value));
                        setCollectionOutcome(null);
                      }}
                      className="w-full px-3.5 py-3 text-base font-mono font-bold border border-slate-300 rounded-xl"
                    />
                    <div className="flex gap-1.5 mt-2">
                      {[250, 450, 500, selectedEntity.outstandingAmount].map(
                        (preset) => (
                          <button
                            type="button"
                            key={preset}
                            onClick={() => setCollectAmount(preset)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-[11px] font-medium"
                          >
                            {formatInr(preset)}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      2. Payment Method (MVP: Cash or Manual UPI Ref) *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('CASH');
                          setCollectionOutcome(null);
                        }}
                        className={`py-3 px-3 rounded-xl font-semibold border min-h-[48px] ${
                          paymentMethod === 'CASH'
                            ? 'bg-[#0B2545] text-white border-[#0B2545]'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        CASH (Immediate)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('UPI_REFERENCE');
                          setCollectionOutcome(null);
                        }}
                        className={`py-3 px-3 rounded-xl font-semibold border min-h-[48px] ${
                          paymentMethod === 'UPI_REFERENCE'
                            ? 'bg-[#0B2545] text-white border-[#0B2545]'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        MANUAL UPI UTR
                      </button>
                    </div>
                  </div>
                </div>

                {paymentMethod === 'UPI_REFERENCE' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="font-semibold">
                        Manual UPI Reference Rule (Section 23 & 24): A manually entered 12-digit UTR is NOT proof of verified payment. Status will be recorded as PENDING_VERIFICATION until Officer bank reconciliation.
                      </p>
                    </div>
                    <div>
                      <label className="block font-medium text-amber-900 mb-1">
                        12-Digit UPI UTR / Reference Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-amber-400 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Atomic Allocation & Remaining Balance Preview */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>Atomic FIFO Due Allocation Preview</span>
                    <span className="font-mono">
                      Remaining After Collection:{' '}
                      {formatInr(
                        Math.max(0, selectedEntity.outstandingAmount - collectAmount)
                      )}
                    </span>
                  </div>
                  {entityDues.length > 0 ? (
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      {entityDues.map((d) => (
                        <div key={d.id} className="flex justify-between">
                          <span>
                            {d.id} ({d.periodStart} – {d.periodEnd})
                          </span>
                          <span>Due Bal: {formatInr(d.outstandingAmount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-emerald-700 font-medium">
                      All dues settled for this entity.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl min-h-[48px] transition-colors"
                >
                  {isOfflineMode
                    ? `Save Provisional Offline Collection (${formatInr(collectAmount)})`
                    : paymentMethod === 'UPI_REFERENCE'
                    ? `Submit Manual UPI UTR for Officer Verification (${formatInr(
                        collectAmount
                      )})`
                    : `Confirm Cash Collection & Issue Official Receipt (${formatInr(
                        collectAmount
                      )})`}
                </button>
              </form>

              {/* Distinct Collection Result States (Section 24) */}
              {collectionOutcome === 'OVERPAYMENT_BLOCKED' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                  <strong>Overpayment Blocked (Section 23):</strong> Entered amount (
                  {formatInr(collectAmount)}) exceeds outstanding balance (
                  {formatInr(selectedEntity.outstandingAmount)}). Advance collection
                  is disabled by municipal policy.
                </div>
              )}

              {collectionOutcome === 'VERIFIED_CASH_SUCCESS' &&
                lastGeneratedReceipt && (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between text-emerald-900">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        VERIFIED CASH COLLECTION CONFIRMED
                      </span>
                      <span className="font-mono font-bold">
                        {lastGeneratedReceipt.receiptNumber}
                      </span>
                    </div>
                    <p className="text-emerald-800">
                      Server-generated receipt issued and SMS/WhatsApp queued asynchronously.
                    </p>
                    <button
                      onClick={() => onSelectReceipt(lastGeneratedReceipt)}
                      className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
                    >
                      Open Printable Official Receipt & QR
                    </button>
                  </div>
                )}

              {collectionOutcome === 'PENDING_MANUAL_UPI' &&
                lastGeneratedReceipt && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between text-amber-900">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        MANUAL UPI REFERENCE RECORDED — PENDING VERIFICATION
                      </span>
                      <span className="font-mono font-bold">
                        {lastGeneratedReceipt.transactionReference}
                      </span>
                    </div>
                    <p className="text-amber-800">
                      Status is strictly <strong>UNVERIFIED_MANUAL_REF</strong> (Not marked PAID). Queued in Revenue Officer Payment Verification console.
                    </p>
                    <button
                      onClick={() => onSelectReceipt(lastGeneratedReceipt)}
                      className="px-4 py-2 bg-amber-800 text-white rounded-lg font-medium"
                    >
                      View Provisional UPI Acknowledgement Slip
                    </button>
                  </div>
                )}

              {collectionOutcome === 'PROVISIONAL_OFFLINE' &&
                lastGeneratedReceipt && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between text-amber-900">
                      <span className="font-bold text-sm">
                        PROVISIONAL OFFLINE SUBMISSION STORED LOCALLY
                      </span>
                      <span className="font-mono">Sync Queue #{offlineSyncCount}</span>
                    </div>
                    <p className="text-amber-800">
                      Per Section 25 & 52, offline collections do not represent final financial settlement until online server synchronization completes.
                    </p>
                    <button
                      onClick={() => onSelectReceipt(lastGeneratedReceipt)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium"
                    >
                      View Provisional Offline Acknowledgement
                    </button>
                  </div>
                )}
            </div>
          )}

          {agentTab === 'RECEIPTS' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Section 25 — Agent Issued Receipts Today
              </h3>
              <div className="space-y-2.5">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono font-bold text-slate-900">
                        {r.receiptNumber} · {formatInr(r.currentPayment)} (
                        {r.paymentMethod})
                      </p>
                      <p className="text-slate-600">
                        {r.entityName} ({r.registrationNumber}) · {r.dateTime}
                      </p>
                    </div>
                    <button
                      onClick={() => onSelectReceipt(r)}
                      className="px-3 py-2 bg-[#0B2545] text-white rounded-lg font-medium min-h-[40px]"
                    >
                      View QR Receipt
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentTab === 'CLOSING' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
              <h3 className="text-base font-bold text-slate-900">
                Section 26 — Agent Daily Cash Closing & Handover
              </h3>
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-sans">Expected Cash</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {formatInr(expectedCashToday)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-sans">Actual Physical Count</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {formatInr(actualCashCount)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-sans">Cash Variance</span>
                  <p
                    className={`text-base font-bold mt-0.5 ${
                      actualCashCount - expectedCashToday < 0
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {formatInr(actualCashCount - expectedCashToday)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Enter Physical Cash Counted (INR) *
                </label>
                <input
                  type="number"
                  value={actualCashCount}
                  onChange={(e) => setActualCashCount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Discrepancy / Handover Explanation *
                </label>
                <textarea
                  rows={2}
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {closingSubmitted ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
                  Daily Cash Closing Submitted (Status: SUBMITTED). Locked against silent edits; awaiting Revenue Officer verification.
                </div>
              ) : (
                <button
                  onClick={() => {
                    onSubmitDailyClosing(actualCashCount, closingNote);
                    setClosingSubmitted(true);
                  }}
                  className="w-full py-3 bg-[#0B2545] text-white font-bold rounded-xl min-h-[48px]"
                >
                  Submit Daily Cash Closing to Revenue Officer
                </button>
              )}
            </div>
          )}

          {agentTab === 'OFFLINE_QUEUE' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Section 52 — Offline & Poor Connectivity Sync Queue
                </h3>
                <button
                  onClick={() => {
                    setIsOfflineMode(false);
                    setOfflineSyncCount(0);
                  }}
                  className="px-3.5 py-2 bg-teal-700 text-white rounded-xl font-medium flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Synchronize Queue Now</span>
                </button>
              </div>
              <p className="text-slate-600">
                Pending Offline Records: <strong>{offlineSyncCount}</strong>. Offline records carry provisional client UUIDs and receive authoritative <span className="font-mono">SUP/2026/...</span> receipt numbers only upon server reconciliation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ergonomic Mobile Bottom Navigation Bar (44px+ hitboxes, <15% sticky height cap) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-1.5">
        <div className="max-w-4xl mx-auto grid grid-cols-5 gap-2">
          {[
            { id: 'HOME', label: 'Agent Home' },
            { id: 'SEARCH_COLLECT', label: 'Search & Collect' },
            { id: 'RECEIPTS', label: 'Receipts' },
            { id: 'CLOSING', label: 'Daily Closing' },
            { id: 'OFFLINE_QUEUE', label: `Sync Queue (${offlineSyncCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAgentTab(tab.id as typeof agentTab)}
              className={`min-h-[44px] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center ${
                agentTab === tab.id
                  ? 'bg-[#0B2545] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface CitizenPortalWorkspaceProps {
  entities: MunicipalEntity[];
  dues: DueRecord[];
  receipts: ReceiptRecord[];
  onCitizenOnlinePay: (entity: MunicipalEntity, amount: number) => ReceiptRecord;
  onSelectReceipt: (r: ReceiptRecord) => void;
}

export const CitizenPortalWorkspace: React.FC<CitizenPortalWorkspaceProps> = ({
  entities,
  dues,
  receipts,
  onCitizenOnlinePay,
  onSelectReceipt,
}) => {
  // Citizen only sees their own linked entities (Section 37 & 53 Ownership Rule)
  const citizenEntities = entities.slice(0, 2);
  const [selectedEntity, setSelectedEntity] = useState<MunicipalEntity>(
    citizenEntities[0]
  );
  const [paymentFlowState, setPaymentFlowState] = useState<
    | 'IDLE'
    | 'UPI_QR_REVIEW'
    | 'WAITING_WEBHOOK_CONFIRMATION'
    | 'VERIFIED_SUCCESS'
    | 'EXPIRED'
  >('IDLE');
  const [latestCitizenReceipt, setLatestCitizenReceipt] =
    useState<ReceiptRecord | null>(null);

  const entityDues = dues.filter((d) => d.entityId === selectedEntity.id);
  const entityReceipts = receipts.filter(
    (r) => r.entityId === selectedEntity.id
  );

  const handleCompleteWebhookVerification = () => {
    const rcp = onCitizenOnlinePay(
      selectedEntity,
      selectedEntity.outstandingAmount || 450
    );
    setLatestCitizenReceipt(rcp);
    setPaymentFlowState('VERIFIED_SUCCESS');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Citizen Portal Header (Section 37) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-teal-700 font-semibold">
            PART K · SECTIONS 37–40 — CITIZEN SELF-SERVICE PORTAL (OTP VERIFIED)
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            Welcome, Ramesh Chandra Yadav (+91 98114 52310)
          </h2>
          <p className="text-xs text-slate-500">
            Strict Record Ownership Enforced: Displaying only vehicles and vendor permits linked to your verified mobile number.
          </p>
        </div>
        <div className="flex gap-2">
          {citizenEntities.map((ce) => (
            <button
              key={ce.id}
              onClick={() => {
                setSelectedEntity(ce);
                setPaymentFlowState('IDLE');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border min-h-[44px] ${
                selectedEntity.id === ce.id
                  ? 'bg-[#0B2545] text-white border-[#0B2545]'
                  : 'bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              {ce.registrationNumber} ({ce.category.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Citizen Due Details (Section 38) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Section 38 — Linked Entity & Detailed Due Breakdown
              </h3>
              <p className="text-slate-500">
                {selectedEntity.registrationNumber} · {selectedEntity.category} ·{' '}
                {selectedEntity.wardName}
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-slate-500 font-sans">Total Payable</span>
              <p className="text-lg font-bold text-slate-900">
                {formatInr(selectedEntity.outstandingAmount)}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {entityDues.map((d) => (
              <div
                key={d.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900">{d.feeType}</p>
                  <p className="font-mono text-slate-500 mt-0.5">
                    Period: {d.periodStart} – {d.periodEnd} · Original:{' '}
                    {formatInr(d.originalAmount)} · Waivers:{' '}
                    {formatInr(d.waiversAmount)}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-sm font-bold text-slate-900">
                    {formatInr(d.outstandingAmount)}
                  </p>
                  <span className="text-[11px] text-amber-700 font-semibold">
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2">
              Section 40 — Official Receipts & Payment History
            </h4>
            <div className="space-y-2">
              {entityReceipts.map((r) => (
                <div
                  key={r.id}
                  className="p-3 border border-slate-200 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-mono font-bold text-slate-900">
                      {r.receiptNumber} · {formatInr(r.currentPayment)}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      {r.dateTime} · {r.paymentMethod}
                    </p>
                  </div>
                  <button
                    onClick={() => onSelectReceipt(r)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium"
                  >
                    Download PDF Receipt
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Citizen Online Payment Journey (Section 39) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Section 39 — Citizen Online UPI / Dynamic QR Payment
            </h3>
            <p className="text-slate-500 mt-0.5">
              Browser redirect never marks a payment successful without verified server confirmation.
            </p>
          </div>

          {paymentFlowState === 'IDLE' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Selected Vehicle / Stall</span>
                  <span className="font-mono font-bold">
                    {selectedEntity.registrationNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Net Payable Amount</span>
                  <span className="font-mono text-emerald-700">
                    {formatInr(selectedEntity.outstandingAmount)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPaymentFlowState('UPI_QR_REVIEW')}
                disabled={selectedEntity.outstandingAmount <= 0}
                className="w-full py-3.5 bg-[#0B2545] disabled:bg-slate-300 text-white font-bold rounded-xl min-h-[48px]"
              >
                Pay {formatInr(selectedEntity.outstandingAmount)} via UPI / QR Gateway
              </button>
            </div>
          )}

          {paymentFlowState === 'UPI_QR_REVIEW' && (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
                <QrCode className="w-28 h-28 text-slate-900" />
                <p className="font-mono font-semibold text-slate-900 mt-2">
                  Scan Dynamic BharatQR / UPI Intent
                </p>
                <p className="text-slate-500 font-mono text-[11px]">
                  Order ID: order_Pf992kCitizen · Expires in 04:45
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setPaymentFlowState('WAITING_WEBHOOK_CONFIRMATION')
                  }
                  className="flex-1 py-3 bg-teal-700 text-white font-bold rounded-xl"
                >
                  Simulate Customer Paid in UPI App
                </button>
                <button
                  onClick={() => setPaymentFlowState('EXPIRED')}
                  className="px-3 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  Simulate Expiry
                </button>
              </div>
            </div>
          )}

          {paymentFlowState === 'WAITING_WEBHOOK_CONFIRMATION' && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                <span>WAITING FOR GATEWAY WEBHOOK CONFIRMATION</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Your browser returned from the UPI app, but SuvidhaPay does <strong>not</strong> mark dues as PAID until our server verifies the cryptographic webhook from the payment gateway.
              </p>
              <button
                onClick={handleCompleteWebhookVerification}
                className="w-full py-2.5 bg-emerald-700 text-white font-bold rounded-lg"
              >
                Simulate Backend Webhook Verified → Issue Receipt
              </button>
            </div>
          )}

          {paymentFlowState === 'VERIFIED_SUCCESS' && latestCitizenReceipt && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <span>GATEWAY-VERIFIED PAYMENT SUCCESS</span>
              </div>
              <p className="text-emerald-800 font-mono">
                Official Receipt: {latestCitizenReceipt.receiptNumber}
              </p>
              <button
                onClick={() => onSelectReceipt(latestCitizenReceipt)}
                className="w-full py-2.5 bg-[#0B2545] text-white font-semibold rounded-lg"
              >
                View & Download Official PDF Receipt
              </button>
            </div>
          )}

          {paymentFlowState === 'EXPIRED' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <p className="font-bold text-red-900">
                Transaction Order Expired (Timeout)
              </p>
              <p className="text-red-700">
                If money was debited from your bank account, it will be automatically reconciled or refunded within T+2 working days. Safe retry generates a new idempotent order.
              </p>
              <button
                onClick={() => setPaymentFlowState('UPI_QR_REVIEW')}
                className="w-full py-2 bg-[#0B2545] text-white rounded-lg font-medium"
              >
                Safe Retry Payment
              </button>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-slate-600">
            <p className="font-bold text-slate-900">
              Municipal Helpdesk & Grievance Support
            </p>
            <p>Toll-Free Civic Helpline: 1800-180-5599 (08:00 – 20:00 IST)</p>
            <p>Ward 12 Revenue Nodal Office: Sector 18 Municipal Complex</p>
          </div>
        </div>
      </div>
    </div>
  );
};
