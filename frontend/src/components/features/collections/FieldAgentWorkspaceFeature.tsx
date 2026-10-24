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
  SystemUser,
  EntityCategory,
} from '../../../types/suvidha';
import { formatInr, normalizeVehicleNumber } from '../../../data/mockSuvidhaData';

export interface FieldAgentWorkspaceProps {
  entities: MunicipalEntity[];
  categories: EntityCategory[];
  dues: DueRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  closings: DailyClosingRecord[];
  collectionSummary: {
    cashCollectionInr: number;
    verifiedDigitalCollectionInr: number;
    totalVerifiedCollectionInr: number;
    pendingManualUpiInr: number;
    paymentsCount: number;
  } | null;
  currentUser: SystemUser;
  lastSyncedAt: string | null;
  onNotify: (message: string) => void;
  onCreateRegistration: (payload: {
    registrationNumber: string;
    entityType: 'VEHICLE' | 'VENDOR';
    name: string;
    mobile: string;
    address: string;
    categoryId: string;
    vehicleType?: string;
    stallLocation?: string;
    wardId: string;
  }) => Promise<boolean>;
  onRecordCollection: (
    entity: MunicipalEntity,
    amount: number,
    method: PaymentMethod,
    reference: string,
    isOffline: boolean,
    idempotencyKey?: string
  ) => Promise<ReceiptRecord | null>;
  onSubmitDailyClosing: (actualCash: number, note: string) => Promise<boolean>;
  onSelectReceipt: (r: ReceiptRecord) => void;
}

export const FieldAgentWorkspace: React.FC<FieldAgentWorkspaceProps> = ({
  entities,
  categories,
  dues,
  payments,
  receipts,
  closings,
  collectionSummary,
  currentUser,
  lastSyncedAt,
  onNotify,
  onCreateRegistration,
  onRecordCollection,
  onSubmitDailyClosing,
  onSelectReceipt,
}) => {
  const [agentTab, setAgentTab] = useState<
    'HOME' | 'SEARCH_COLLECT' | 'RECEIPTS' | 'CLOSING' | 'OFFLINE_QUEUE'
  >('HOME');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const queueStorageKey = `suvidhapay.offlineQueue.${currentUser.id}`;
  const [offlineQueue, setOfflineQueue] = useState<Array<{
    id: string;
    entityId: string;
    amount: number;
    method: 'CASH' | 'UPI_REFERENCE';
    reference: string;
  }>>(() => {
    try {
      const stored = localStorage.getItem(queueStorageKey);
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is {
        id: string;
        entityId: string;
        amount: number;
        method: 'CASH' | 'UPI_REFERENCE';
        reference: string;
      } => item && typeof item.id === 'string' && typeof item.entityId === 'string'
        && typeof item.amount === 'number'
        && (item.method === 'CASH' || item.method === 'UPI_REFERENCE')
        && typeof item.reference === 'string');
    } catch {
      return [];
    }
  });
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isSavingRegistration, setIsSavingRegistration] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    registrationNumber: '',
    name: '',
    mobile: '',
    address: '',
    categoryId: '',
    vehicleType: '',
    stallLocation: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<MunicipalEntity | undefined>(
    entities[0]
  );
  const [collectAmount, setCollectAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI_REFERENCE'>(
    'CASH'
  );
  const [upiReference, setUpiReference] = useState('');
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

  const agentCashPayments = payments.filter(
    (p) =>
      p.method === 'CASH' &&
      p.collectedBy.toLowerCase() === currentUser.loginIdentifier.toLowerCase() &&
      p.settlementStatus !== 'REVERSED'
  );
  const expectedCashToday =
    collectionSummary?.cashCollectionInr ??
    agentCashPayments.reduce((acc, p) => acc + p.amountInr, 0);
  const [actualCashCount, setActualCashCount] = useState<number>(expectedCashToday);
  const [closingNote, setClosingNote] = useState(`Cash count for assigned ward ${currentUser.assignedWard}.`);
  const [closingSubmitted, setClosingSubmitted] = useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(queueStorageKey, JSON.stringify(offlineQueue));
    } catch (error) {
      onNotify(error instanceof Error ? `Could not save offline queue: ${error.message}` : 'Could not save offline queue.');
    }
  }, [offlineQueue, queueStorageKey]);

  React.useEffect(() => {
    if (entities.length > 0 && !entities.some((entity) => entity.id === selectedEntity?.id)) {
      setSelectedEntity(entities[0]);
      setCollectAmount(Math.min(500, entities[0].outstandingAmount));
    }
  }, [entities, selectedEntity?.id]);

  React.useEffect(() => {
    setActualCashCount(expectedCashToday);
  }, [expectedCashToday]);

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setClosingSubmitted(closings.some(
      (closing) => closing.date === today && closing.status !== 'OPEN'
    ));
  }, [closings]);

  const normalizedSearch = normalizeVehicleNumber(searchQuery);
  const matchedEntities = entities.filter(
    (e) =>
      searchQuery.trim() === '' ||
      e.normalizedIdentifier.includes(normalizedSearch) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.mobile.includes(searchQuery.trim())
  );

  const entityDues = dues.filter(
    (d) => d.entityId === selectedEntity?.id && d.outstandingAmount > 0
  );

  const handleConfirmCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCollection || !selectedEntity) return;
    if (collectAmount > selectedEntity.outstandingAmount) {
      setCollectionOutcome('OVERPAYMENT_BLOCKED');
      return;
    }
    if (collectAmount <= 0) return;

    const ref =
      paymentMethod === 'CASH'
        ? `CASH-${currentUser.loginIdentifier}-${Date.now()}`
        : upiReference;

    const idempotencyKey = isOfflineMode ? `offline-${crypto.randomUUID()}` : `${paymentMethod.toLowerCase()}-${crypto.randomUUID()}`;
    setIsSubmittingCollection(true);
    try {
      const generated = await onRecordCollection(
        selectedEntity,
        collectAmount,
        paymentMethod,
        ref,
        isOfflineMode,
        idempotencyKey
      );
      if (!generated) return;
      setLastGeneratedReceipt(generated);

      if (isOfflineMode) {
        setOfflineQueue((queue) => [
          ...queue,
          {
            id: idempotencyKey,
            entityId: selectedEntity.id,
            amount: collectAmount,
            method: paymentMethod,
            reference: ref,
          },
        ]);
        setCollectionOutcome('PROVISIONAL_OFFLINE');
      } else if (paymentMethod === 'UPI_REFERENCE') {
        setCollectionOutcome('PENDING_MANUAL_UPI');
      } else {
        setCollectionOutcome('VERIFIED_CASH_SUCCESS');
      }
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  const synchronizeOfflineQueue = async () => {
    if (isSyncingQueue || offlineQueue.length === 0) return;
    if (!navigator.onLine) {
      setIsOfflineMode(true);
      return;
    }

    setIsSyncingQueue(true);
    try {
      const pendingOnly = offlineQueue.slice();
      const synced = await Promise.all(
        pendingOnly.map(async (item) => {
          const entity = entities.find((e) => e.id === item.entityId) ?? entities[0];
          if (!entity) return null;
          return onRecordCollection(
            entity,
            item.amount,
            item.method,
            item.reference,
            false,
            item.id
          );
        })
      );

      const successful = synced.filter(Boolean).length;
      if (successful > 0) {
        onNotify(`${successful} offline collections synced and receipt(s) generated.`);
      }
      setOfflineQueue([]);
      setIsOfflineMode(false);
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const handleCreateRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registrationForm.registrationNumber || !registrationForm.name || !registrationForm.mobile) return;
    setIsSavingRegistration(true);
    try {
      const success = await onCreateRegistration({
        registrationNumber: registrationForm.registrationNumber,
        name: registrationForm.name,
        mobile: registrationForm.mobile,
        address: registrationForm.address,
        categoryId: registrationForm.categoryId,
        entityType: 'VEHICLE',
        vehicleType: registrationForm.vehicleType,
        stallLocation: registrationForm.stallLocation,
        wardId: currentUser.assignedWard || 'WD-12',
      });
      if (success) {
        setRegistrationForm({
          registrationNumber: '',
          name: '',
          mobile: '',
          address: '',
          categoryId: '',
          vehicleType: '',
          stallLocation: '',
        });
        setIsRegistrationOpen(false);
      }
    } finally {
      setIsSavingRegistration(false);
    }
  };

  const handleClosingSubmit = async () => {
    const ok = await onSubmitDailyClosing(actualCashCount, closingNote);
    if (ok) {
      setClosingSubmitted(true);
      onNotify('Daily cash closing submitted for approval.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Field Agent Workspace</h2>
          <p className="text-slate-500 mt-0.5">
            Agent {currentUser.fullName} · Ward {currentUser.assignedWard} · {lastSyncedAt ?? 'Awaiting sync'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAgentTab('HOME')}
            className={`px-3 py-1.5 rounded-lg ${agentTab === 'HOME' ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Home
          </button>
          <button
            onClick={() => setAgentTab('SEARCH_COLLECT')}
            className={`px-3 py-1.5 rounded-lg ${agentTab === 'SEARCH_COLLECT' ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Search & Collect
          </button>
          <button
            onClick={() => setAgentTab('RECEIPTS')}
            className={`px-3 py-1.5 rounded-lg ${agentTab === 'RECEIPTS' ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Receipts
          </button>
          <button
            onClick={() => setAgentTab('CLOSING')}
            className={`px-3 py-1.5 rounded-lg ${agentTab === 'CLOSING' ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Closing
          </button>
          <button
            onClick={() => setAgentTab('OFFLINE_QUEUE')}
            className={`px-3 py-1.5 rounded-lg ${agentTab === 'OFFLINE_QUEUE' ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Offline Queue
          </button>
        </div>
      </div>

      {agentTab === 'HOME' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Expected Cash</span>
              <IndianRupee className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {formatInr(expectedCashToday)}
            </div>
            <p className="text-slate-500 mt-1">Today's assigned collections</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Network</span>
              {navigator.onLine ? <Wifi className="w-4 h-4 text-emerald-700" /> : <WifiOff className="w-4 h-4 text-red-700" />}
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900">
              {navigator.onLine ? 'Online' : 'Offline'}
            </div>
            <p className="text-slate-500 mt-1">Synchronization status</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Pending Queue</span>
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {offlineQueue.length}
            </div>
            <p className="text-slate-500 mt-1">Stored provisional collections</p>
          </div>
        </div>
      )}

      {agentTab === 'SEARCH_COLLECT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by vehicle, name, mobile"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              {matchedEntities.slice(0, 8).map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={`w-full text-left p-3 rounded-xl border ${selectedEntity?.id === entity.id ? 'border-[#0B2545] bg-slate-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="font-semibold text-slate-900">{entity.name}</div>
                  <div className="font-mono text-slate-500 text-[11px]">{entity.registrationNumber}</div>
                  <div className="mt-1 text-slate-600">Outstanding: {formatInr(entity.outstandingAmount)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4">
            {selectedEntity && (
              <form onSubmit={handleConfirmCollection} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{selectedEntity.registrationNumber}</div>
                    <div className="text-slate-600">{selectedEntity.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 text-[11px]">Due balance</div>
                    <div className="font-mono font-bold text-slate-900">{formatInr(selectedEntity.outstandingAmount)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Amount</label>
                    <input
                      type="number"
                      min={1}
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'UPI_REFERENCE')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="CASH">CASH</option>
                      <option value="UPI_REFERENCE">UPI_REFERENCE</option>
                    </select>
                  </div>
                </div>

                {paymentMethod === 'UPI_REFERENCE' && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">UPI / UTR / Ref</label>
                    <input
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOfflineMode}
                    onChange={(e) => setIsOfflineMode(e.target.checked)}
                  />
                  <label>Offline provisional mode</label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmittingCollection}
                    className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium disabled:opacity-60"
                  >
                    {isSubmittingCollection ? 'Submitting...' : 'Confirm Collection'}
                  </button>
                  {isOfflineMode && (
                    <span className="text-amber-700 font-medium">Queue pending sync</span>
                  )}
                </div>
              </form>
            )}

            {collectionOutcome && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">
                  {collectionOutcome === 'VERIFIED_CASH_SUCCESS' && 'Cash verified and receipt generated'}
                  {collectionOutcome === 'PENDING_MANUAL_UPI' && 'Manual UPI verification pending'}
                  {collectionOutcome === 'PROVISIONAL_OFFLINE' && 'Stored in offline queue'}
                  {collectionOutcome === 'DUPLICATE_GUARD' && 'Duplicate payment blocked'}
                  {collectionOutcome === 'OVERPAYMENT_BLOCKED' && 'Overpayment blocked'}
                </div>
                {lastGeneratedReceipt && (
                  <button
                    onClick={() => onSelectReceipt(lastGeneratedReceipt)}
                    className="mt-2 underline text-slate-700"
                  >
                    View receipt {lastGeneratedReceipt.receiptNumber}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {agentTab === 'RECEIPTS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-base font-bold text-slate-900 mb-3">Recent receipts</h3>
          <div className="space-y-2">
            {receipts.slice(0, 8).map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                <div>
                  <div className="font-mono font-bold text-slate-900">{receipt.receiptNumber}</div>
                  <div className="text-slate-500">{receipt.dateTime} · {receipt.paymentMethod}</div>
                </div>
                <button
                  onClick={() => onSelectReceipt(receipt)}
                  className="px-3 py-2 bg-slate-100 rounded-lg text-slate-800 font-medium"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {agentTab === 'CLOSING' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daily closing</h3>
              <p className="text-slate-500">Actual physical cash count must match expected collection.</p>
            </div>
            <div className="font-mono font-bold text-slate-900">{formatInr(expectedCashToday)}</div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Actual cash counted</label>
            <input
              type="number"
              value={actualCashCount}
              onChange={(e) => setActualCashCount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Narrative note</label>
            <textarea
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              rows={3}
            />
          </div>
          <button
            onClick={handleClosingSubmit}
            disabled={closingSubmitted}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {closingSubmitted ? 'Submitted' : 'Submit daily closing'}
          </button>
        </div>
      )}

      {agentTab === 'OFFLINE_QUEUE' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Offline collection queue</h3>
              <p className="text-slate-500">Queued collections are synced when connectivity returns.</p>
            </div>
            <button
              onClick={synchronizeOfflineQueue}
              disabled={isSyncingQueue || offlineQueue.length === 0}
              className="px-3 py-2 bg-[#0B2545] text-white rounded-lg font-medium disabled:opacity-60"
            >
              {isSyncingQueue ? 'Syncing...' : 'Sync queue'}
            </button>
          </div>
          {offlineQueue.length === 0 ? (
            <div className="p-4 border border-slate-200 rounded-lg text-slate-600">No queued collections.</div>
          ) : (
            <div className="space-y-2">
              {offlineQueue.map((item) => (
                <div key={item.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{item.reference}</div>
                    <div className="text-slate-500">{item.amount} · {item.method}</div>
                  </div>
                  <button
                    onClick={() => setOfflineQueue((queue) => queue.filter((q) => q.id !== item.id))}
                    className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { FieldAgentWorkspace as AgentWorkspace };

