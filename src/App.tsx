/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Car,
  IndianRupee,
  Scale,
  Receipt,
  Users,
  Sliders,
  FileBarChart,
  ShieldCheck,
  KeyRound,
  BookOpen,
  QrCode,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  UserRole,
  MunicipalEntity,
  DueRecord,
  DueAdjustment,
  PaymentRecord,
  ReceiptRecord,
  DailyClosingRecord,
  ReconciliationItem,
  RefundDisputeRecord,
  SystemUser,
  Ward,
  Zone,
  EntityCategory,
  RateMaster,
  NotificationLog,
  AuditLogEntry,
  GovVerificationStatus,
  RegistrationStatus,
  PaymentMethod,
  TraceabilityRequirement,
} from './types/suvidha';
import {
  INITIAL_ZONES,
  INITIAL_WARDS,
  INITIAL_CATEGORIES,
  INITIAL_RATES,
  INITIAL_ENTITIES,
  INITIAL_DUES,
  INITIAL_ADJUSTMENTS,
  INITIAL_PAYMENTS,
  INITIAL_RECEIPTS,
  INITIAL_CLOSINGS,
  INITIAL_RECONCILIATION,
  INITIAL_REFUNDS_DISPUTES,
  INITIAL_USERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  formatInr,
} from './data/mockSuvidhaData';
import {
  ReceiptDetailModal,
  PublicVerificationModal,
  AuthSimulatorModal,
  BlueprintDeliverablesModal,
} from './components/SharedModals';
import {
  AdminDashboardView,
  UnifiedEntitiesView,
} from './components/AdminDashboardAndEntities';
import {
  DueLedgerAndGeneratorView,
  PaymentsReconciliationView,
  CashControlAndReceiptsView,
} from './components/AdminDuesPaymentsReceipts';
import {
  UsersAgentsWardsView,
  CategoriesAndRatesView,
  OperationsAndGovernanceHub,
} from './components/AdminGovernanceAndOps';
import {
  FieldAgentWorkspace,
  CitizenPortalWorkspace,
} from './components/AgentAndCitizenShells';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');

  // Master State across all SuvidhaPay modules
  const [zones] = useState<Zone[]>(INITIAL_ZONES);
  const [wards] = useState<Ward[]>(INITIAL_WARDS);
  const [categories] = useState<EntityCategory[]>(INITIAL_CATEGORIES);
  const [rates, setRates] = useState<RateMaster[]>(INITIAL_RATES);
  const [entities, setEntities] = useState<MunicipalEntity[]>(INITIAL_ENTITIES);
  const [dues, setDues] = useState<DueRecord[]>(INITIAL_DUES);
  const [adjustments, setAdjustments] = useState<DueAdjustment[]>(INITIAL_ADJUSTMENTS);
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>(INITIAL_RECEIPTS);
  const [closings, setClosings] = useState<DailyClosingRecord[]>(INITIAL_CLOSINGS);
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>(
    INITIAL_RECONCILIATION
  );
  const [disputes, setDisputes] = useState<RefundDisputeRecord[]>(
    INITIAL_REFUNDS_DISPUTES
  );
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);
  const [notifications, setNotifications] = useState<NotificationLog[]>(
    INITIAL_NOTIFICATIONS
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Modals State
  const [selectedReceiptModal, setSelectedReceiptModal] =
    useState<ReceiptRecord | null>(null);
  const [isPublicVerifyOpen, setIsPublicVerifyOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const appendAuditLog = (
    action: string,
    module: string,
    entityType: string,
    entityId: string,
    prevVal: string,
    newVal: string
  ) => {
    const newEntry: AuditLogEntry = {
      id: `AUD-${10090 + auditLogs.length + 1}`,
      timestamp: '10/10/2026 11:42:10',
      actorName:
        activeRole === 'ADMIN'
          ? 'Anupam Kulkarni (Admin)'
          : activeRole === 'OFFICER'
          ? 'Rajeshwari Verma (RO)'
          : activeRole === 'AGENT'
          ? 'Suresh Kumar Sharma (AG-104)'
          : 'Citizen Portal User',
      actorRole: activeRole,
      action,
      module,
      entityType,
      entityId,
      previousValueSummary: prevVal,
      newValueSummary: newVal,
      ipAddress: '14.139.240.11',
      correlationId: `corr-${Date.now().toString().slice(-6)}`,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Interactive Handlers
  const handleAddEntity = (newEnt: MunicipalEntity) => {
    setEntities((prev) => [newEnt, ...prev]);
    appendAuditLog(
      'ENTITY_REGISTRATION_SUBMITTED',
      'ENTITY_REGISTRY',
      newEnt.entityType,
      newEnt.id,
      'None',
      `Registered ${newEnt.registrationNumber} (${newEnt.name}) — Status: SUBMITTED`
    );
    showToast(
      `Registration ${newEnt.registrationNumber} submitted to Officer Approval Queue.`
    );
  };

  const handleUpdateEntityStatus = (
    entityId: string,
    regStatus: RegistrationStatus,
    govStatus: GovVerificationStatus,
    comment: string
  ) => {
    setEntities((prev) =>
      prev.map((e) =>
        e.id === entityId
          ? {
              ...e,
              registrationStatus: regStatus,
              govVerificationStatus: govStatus,
              officerComments: comment,
            }
          : e
      )
    );
    appendAuditLog(
      regStatus === 'ACTIVE'
        ? 'OFFICERAPPROVEDREGISTRATION'
        : 'OFFICERREJECTEDREGISTRATION',
      'REGISTRATION_APPROVAL',
      'ENTITY',
      entityId,
      'Status: SUBMITTED',
      `Status: ${regStatus}, GovVerify: ${govStatus}, Note: ${comment}`
    );
    showToast(`Entity ${entityId} updated to ${regStatus}.`);
  };

  const handleGenerateBatchDues = (newDues: DueRecord[]) => {
    setDues((prev) => [...newDues, ...prev]);
    appendAuditLog(
      'BATCH_DUES_GENERATED',
      'DUE_ENGINE',
      'DUE_BATCH',
      newDues[0]?.id || 'BATCH',
      '0 records for Nov 2026',
      `Generated ${newDues.length} sample ledger records using Rate ${newDues[0]?.rateId}`
    );
    showToast('Batch Due Generation committed to immutable financial ledger.');
  };

  const handleCreateAdjustment = (adj: DueAdjustment) => {
    setAdjustments((prev) => [adj, ...prev]);
    appendAuditLog(
      'ADJUSTMENT_WAIVER_REQUESTED',
      'DUE_LEDGER',
      adj.type,
      adj.id,
      `Before Balance: ${formatInr(adj.beforeBalance)}`,
      `Requested ${adj.type} of ${formatInr(adj.amountInr)} (Pending Approval)`
    );
    showToast(`${adj.type} request ${adj.id} submitted for approval.`);
  };

  const handleApproveRejectAdjustment = (
    id: string,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    const target = adjustments.find((a) => a.id === id);
    setAdjustments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              approvalStatus: status,
              reviewedBy: 'Anupam Kulkarni (Admin)',
              reviewedAt: '10/10/2026 11:45',
            }
          : a
      )
    );
    if (target && status === 'APPROVED') {
      setDues((prev) =>
        prev.map((d) =>
          d.id === target.dueId
            ? {
                ...d,
                waiversAmount: d.waiversAmount + target.amountInr,
                outstandingAmount: Math.max(
                  0,
                  d.outstandingAmount - target.amountInr
                ),
                status:
                  d.outstandingAmount - target.amountInr <= 0
                    ? 'WAIVED'
                    : d.status,
              }
            : d
        )
      );
    }
    appendAuditLog(
      status === 'APPROVED' ? 'OFFICERAPPROVEDWAIVER' : 'OFFICERREJECTEDWAIVER',
      'DUE_LEDGER',
      'ADJUSTMENT',
      id,
      'Status: PENDING',
      `Status: ${status}`
    );
    showToast(`Adjustment ${id} marked as ${status}.`);
  };

  const handleVerifyManualUpi = (paymentId: string) => {
    const targetPay = payments.find((p) => p.id === paymentId);
    if (!targetPay) return;
    const newReceiptNo = `SUP/2026/0000123${47 + receipts.length}`;
    const newReceipt: ReceiptRecord = {
      id: `RCP-0${receipts.length + 1}`,
      receiptNumber: newReceiptNo,
      paymentId: targetPay.id,
      entityId: targetPay.entityId,
      entityName: targetPay.entityName,
      registrationNumber: targetPay.registrationNumber,
      categoryName: targetPay.categoryName,
      wardName: targetPay.wardName,
      dateTime: '10/10/2026 11:46:00',
      previousOutstanding: targetPay.amountInr + 300,
      currentPayment: targetPay.amountInr,
      allocatedAmount: targetPay.amountInr,
      remainingOutstanding: 300,
      paymentMethod: targetPay.method,
      transactionReference: targetPay.referenceNumber,
      agentName: targetPay.collectedBy,
      agentId: 'AG-104',
      verificationCode: `VRF-${Date.now().toString().slice(-4)}-SUP26`,
      status: 'VALID',
    };
    setReceipts((prev) => [newReceipt, ...prev]);
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? {
              ...p,
              processingStatus: 'RECEIPT_GENERATED',
              settlementStatus: 'SETTLED',
              receiptNumber: newReceiptNo,
              verifiedBy: 'Rajeshwari Verma (RO)',
              verifiedAt: '10/10/2026 11:46:00',
            }
          : p
      )
    );
    appendAuditLog(
      'OFFICER_VERIFIED_MANUAL_UPI_UTR',
      'PAYMENT_VERIFICATION',
      'PAYMENT',
      paymentId,
      'Status: UNVERIFIED_MANUAL_REF',
      `Verified UTR ${targetPay.referenceNumber} -> Issued ${newReceiptNo}`
    );
    showToast(
      `Manual UPI UTR verified! Official Receipt ${newReceiptNo} generated.`
    );
  };

  const handleRecordCollection = (
    entity: MunicipalEntity,
    amount: number,
    method: PaymentMethod,
    reference: string,
    isOffline: boolean
  ): ReceiptRecord => {
    const isManualUpi = method === 'UPI_REFERENCE';
    const receiptNo = isOffline
      ? `PROV-OFFLINE-${Date.now().toString().slice(-5)}`
      : isManualUpi
      ? `ACK-UPI-PENDING-${Date.now().toString().slice(-4)}`
      : `SUP/2026/0000123${47 + receipts.length}`;

    const newPayId = `PAY-2026-${9085 + payments.length}`;
    const newPay: PaymentRecord = {
      id: newPayId,
      entityId: entity.id,
      entityName: entity.name,
      registrationNumber: entity.registrationNumber,
      wardName: entity.wardName,
      categoryName: entity.category,
      amountInr: amount,
      method,
      referenceNumber: reference,
      processingStatus:
        isOffline || isManualUpi ? 'PENDING' : 'RECEIPT_GENERATED',
      settlementStatus: isOffline
        ? 'PROVISIONAL_OFFLINE'
        : isManualUpi
        ? 'UNVERIFIED_MANUAL_REF'
        : 'SETTLED',
      receiptNumber: receiptNo,
      collectedBy: 'Suresh Kumar Sharma (AG-104)',
      collectedByRole: 'AGENT',
      timestamp: '10/10/2026 11:48:12',
      allocations: [
        {
          dueId: 'DUE-2026-101',
          periodLabel: 'FIFO Due Allocation',
          feeType: entity.category,
          dueOriginalAmount: entity.outstandingAmount,
          allocatedAmount: amount,
          remainingDueBalance: Math.max(0, entity.outstandingAmount - amount),
        },
      ],
    };

    const newReceipt: ReceiptRecord = {
      id: `RCP-0${receipts.length + 1}`,
      receiptNumber: receiptNo,
      paymentId: newPayId,
      entityId: entity.id,
      entityName: entity.name,
      registrationNumber: entity.registrationNumber,
      categoryName: entity.category,
      wardName: entity.wardName,
      dateTime: '10/10/2026 11:48:12',
      previousOutstanding: entity.outstandingAmount,
      currentPayment: amount,
      allocatedAmount: isManualUpi || isOffline ? 0 : amount,
      remainingOutstanding:
        isManualUpi || isOffline
          ? entity.outstandingAmount
          : Math.max(0, entity.outstandingAmount - amount),
      paymentMethod: method,
      transactionReference: reference,
      agentName: 'Suresh Kumar Sharma',
      agentId: 'AG-104',
      verificationCode: `VRF-${Date.now().toString().slice(-4)}-SUP26`,
      status: isOffline
        ? 'PROVISIONAL_OFFLINE'
        : isManualUpi
        ? 'PENDING_UPI_VERIFICATION'
        : 'VALID',
    };

    setPayments((prev) => [newPay, ...prev]);
    setReceipts((prev) => [newReceipt, ...prev]);

    // Only deduct from authoritative balance if verified Cash (not unverified manual UPI or provisional offline)
    if (!isManualUpi && !isOffline) {
      setEntities((prev) =>
        prev.map((e) =>
          e.id === entity.id
            ? {
                ...e,
                paidAllocated: e.paidAllocated + amount,
                outstandingAmount: Math.max(0, e.outstandingAmount - amount),
              }
            : e
        )
      );
    }

    appendAuditLog(
      isManualUpi
        ? 'AGENTCREATEDMANUAL_UPI_REF'
        : 'AGENTCREATEDCASH_PAYMENT',
      'FIELD_COLLECTIONS',
      'PAYMENT',
      newPayId,
      `Entity ${entity.registrationNumber} Due: ${formatInr(
        entity.outstandingAmount
      )}`,
      `Amount: ${formatInr(amount)} (${method}), Ref: ${reference}, Doc: ${receiptNo}`
    );

    return newReceipt;
  };

  const handleCitizenOnlinePay = (
    entity: MunicipalEntity,
    amount: number
  ): ReceiptRecord => {
    const receiptNo = `SUP/2026/0000123${47 + receipts.length}`;
    const newReceipt: ReceiptRecord = {
      id: `RCP-0${receipts.length + 1}`,
      receiptNumber: receiptNo,
      paymentId: `PAY-2026-${9090 + payments.length}`,
      entityId: entity.id,
      entityName: entity.name,
      registrationNumber: entity.registrationNumber,
      categoryName: entity.category,
      wardName: entity.wardName,
      dateTime: '10/10/2026 11:50:00',
      previousOutstanding: amount,
      currentPayment: amount,
      allocatedAmount: amount,
      remainingOutstanding: 0,
      paymentMethod: 'PAYMENT_GATEWAY',
      transactionReference: `pay_RzpCitizen_${Date.now().toString().slice(-5)}`,
      agentName: 'Citizen Online Gateway',
      agentId: 'SELF-PORTAL',
      verificationCode: `VRF-${Date.now().toString().slice(-4)}-SUP26`,
      status: 'VALID',
    };
    setReceipts((prev) => [newReceipt, ...prev]);
    setEntities((prev) =>
      prev.map((e) =>
        e.id === entity.id
          ? {
              ...e,
              paidAllocated: e.paidAllocated + amount,
              outstandingAmount: 0,
            }
          : e
      )
    );
    appendAuditLog(
      'PAYMENTWEBHOOKRECEIVED',
      'CITIZEN_PORTAL',
      'PAYMENT',
      newReceipt.paymentId,
      `Due: ${formatInr(amount)}`,
      `Verified Gateway Payment -> Receipt ${receiptNo}`
    );
    showToast(`Citizen Online Payment Verified! Receipt ${receiptNo} issued.`);
    return newReceipt;
  };

  const handleNavigateRequirement = (req: TraceabilityRequirement) => {
    setActiveRole(req.targetRoleShell);
    setActiveModule(req.targetModuleKey);
  };

  const adminNavItems = [
    { id: 'dashboard', label: '1. Operational Dashboard', icon: LayoutDashboard },
    { id: 'entities', label: '2. Entities & Registrations', icon: Car },
    { id: 'dues', label: '3. Due Engine & Waivers', icon: IndianRupee },
    { id: 'payments_recon', label: '4. Payments & Reconciliation', icon: Scale },
    { id: 'cash_closing', label: '5. Cash Closing & Receipts', icon: Receipt },
    { id: 'users_wards', label: '6. Users, Agents & Wards', icon: Users },
    { id: 'rates_categories', label: '7. Categories & Rate Master', icon: Sliders },
    { id: 'reports_audit', label: '8. Reports, Vahan, Audit & Import', icon: FileBarChart },
  ];

  const officerNavItems = [
    { id: 'dashboard', label: 'Officer Overview (Sec 35)', icon: LayoutDashboard },
    { id: 'entities', label: 'Registration Approvals (Sec 16)', icon: Car },
    { id: 'cash_closing', label: 'Cash Closing Review (Sec 27)', icon: Receipt },
    { id: 'payments_recon', label: 'UPI Verification & Disputes', icon: Scale },
    { id: 'dues', label: 'Due Review & Waivers (Sec 19)', icon: IndianRupee },
    { id: 'reports_audit', label: 'Ward Reports & Audit Logs', icon: FileBarChart },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-[#0B2545] whitespace-nowrap shrink-0 font-display"
        >
          SuvidhaPay
        </a>

        {/* Zone 2: 4 Concise Single-Line Role Shell Switchers */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          {(
            [
              { role: 'ADMIN', label: 'Admin Console' },
              { role: 'OFFICER', label: 'Officer Console' },
              { role: 'AGENT', label: 'Field Agent App' },
              { role: 'CITIZEN', label: 'Citizen Portal' },
            ] as const
          ).map((item) => (
            <button
              key={item.role}
              onClick={() => {
                setActiveRole(item.role);
                if (item.role === 'ADMIN' || item.role === 'OFFICER') {
                  setActiveModule('dashboard');
                }
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeRole === item.role
                  ? 'border-[#0B2545] text-[#0B2545] font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setIsBlueprintModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Traceability Matrix
          </button>
        </div>
      </header>

      {/* Secondary Contextual Workspace Strip (Below Header) */}
      <div className="bg-slate-900 text-slate-200 px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-white">
            Noida Municipal Corporation
          </span>
          <span className="text-slate-500">·</span>
          <span>Tagline: Transparent Collections. Trusted Governance.</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-teal-300">
            Active Shell: {activeRole}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsPublicVerifyOpen(true)}
            className="text-slate-200 hover:text-white underline font-medium flex items-center gap-1"
          >
            <QrCode className="w-3.5 h-3.5 text-teal-400" />
            <span>Public Receipt Verification (Sec 34)</span>
          </button>
          <span className="text-slate-600">·</span>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="text-slate-200 hover:text-white underline font-medium flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5 text-teal-400" />
            <span>Auth & Security States Simulator (Sec 5)</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Role-Specific Application Shells */}
      {(activeRole === 'ADMIN' || activeRole === 'OFFICER') && (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Left Sidebar Navigation for Admin & Officer Shells */}
          <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 shrink-0 no-print">
            <div className="mb-3 px-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                {activeRole === 'ADMIN'
                  ? 'Part C — Admin ERP Console'
                  : 'Part J — Revenue Officer Ops'}
              </p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {activeRole === 'ADMIN'
                  ? 'Anupam Kulkarni, IAS (Admin)'
                  : 'Rajeshwari Verma (Zone 2 RO)'}
              </p>
            </div>

            <div className="space-y-1">
              {(activeRole === 'ADMIN' ? adminNavItems : officerNavItems).map(
                (nav) => {
                  const Icon = nav.icon;
                  const isActive = activeModule === nav.id;
                  return (
                    <button
                      key={nav.id}
                      onClick={() => setActiveModule(nav.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                        isActive
                          ? 'bg-[#0B2545] text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{nav.label}</span>
                    </button>
                  );
                }
              )}
            </div>

            <div className="mt-6 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-900">
                Core Financial Guardrails
              </p>
              <p>
                • Unverified manual UPI UTRs never count as verified revenue.
              </p>
              <p>
                • Historical dues retain original generated rates.
              </p>
              <p>
                • Zero ordinary delete buttons on financial records.
              </p>
            </div>
          </aside>

          {/* Main Admin / Officer Workspace Content */}
          <main className="flex-1 p-5 lg:p-6 overflow-x-hidden">
            {activeModule === 'dashboard' && (
              <AdminDashboardView
                entities={entities}
                payments={payments}
                closings={closings}
                reconciliations={reconciliations}
                disputes={disputes}
                wards={wards}
                categories={categories}
                selectedWardFilter={selectedWardFilter}
                setSelectedWardFilter={setSelectedWardFilter}
                onNavigateModule={setActiveModule}
              />
            )}

            {activeModule === 'entities' && (
              <UnifiedEntitiesView
                entities={entities}
                wards={wards}
                categories={categories}
                onAddEntity={handleAddEntity}
                onUpdateEntityStatus={handleUpdateEntityStatus}
                onOpenQuickCollect={() => {
                  setActiveRole('AGENT');
                }}
              />
            )}

            {activeModule === 'dues' && (
              <DueLedgerAndGeneratorView
                dues={dues}
                adjustments={adjustments}
                rates={rates}
                categories={categories}
                wards={wards}
                onGenerateBatchDues={handleGenerateBatchDues}
                onApproveRejectAdjustment={handleApproveRejectAdjustment}
                onCreateAdjustment={handleCreateAdjustment}
              />
            )}

            {activeModule === 'payments_recon' && (
              <PaymentsReconciliationView
                payments={payments}
                reconciliations={reconciliations}
                disputes={disputes}
                onVerifyManualUpi={handleVerifyManualUpi}
                onResolveReconciliation={(id, note) => {
                  setReconciliations((prev) =>
                    prev.map((r) =>
                      r.id === id
                        ? { ...r, status: 'MATCHED', reviewNotes: note }
                        : r
                    )
                  );
                  appendAuditLog(
                    'RECONCILIATION_EXCEPTION_RESOLVED',
                    'RECONCILIATION',
                    'RECON_ITEM',
                    id,
                    'Status: EXCEPTION',
                    `Resolved -> MATCHED (${note})`
                  );
                  showToast(`Reconciliation item ${id} resolved and audited.`);
                }}
                onResolveDispute={(id, status) => {
                  setDisputes((prev) =>
                    prev.map((d) => (d.id === id ? { ...d, status } : d))
                  );
                  appendAuditLog(
                    'DISPUTE_REVERSAL_ADJUDICATED',
                    'DISPUTES',
                    'DISPUTE',
                    id,
                    'Status: OPEN',
                    `Adjudicated -> ${status}`
                  );
                  showToast(`Dispute/Reversal ${id} marked ${status}.`);
                }}
              />
            )}

            {(activeModule === 'cash_closing' || activeModule === 'receipts' || activeModule === 'officer_closing') && (
              <CashControlAndReceiptsView
                closings={closings}
                receipts={receipts}
                onVerifyClosing={(id, status, comment) => {
                  setClosings((prev) =>
                    prev.map((c) =>
                      c.id === id
                        ? {
                            ...c,
                            status,
                            verifyingOfficer: 'Rajeshwari Verma (RO)',
                            officerComments: comment,
                            verifiedAt: '10/10/2026 11:52',
                          }
                        : c
                    )
                  );
                  appendAuditLog(
                    'OFFICER_VERIFIED_CASH_CLOSING',
                    'CASH_CLOSING',
                    'CLOSING',
                    id,
                    'Status: SUBMITTED',
                    `Status: ${status}, Comment: ${comment}`
                  );
                  showToast(`Daily Cash Closing ${id} verified and closed.`);
                }}
                onSelectReceipt={setSelectedReceiptModal}
                onOpenPublicVerify={() => setIsPublicVerifyOpen(true)}
              />
            )}

            {activeModule === 'users_wards' && (
              <UsersAgentsWardsView
                users={users}
                wards={wards}
                zones={zones}
                onToggleUserStatus={(id) => {
                  setUsers((prev) =>
                    prev.map((u) =>
                      u.id === id
                        ? {
                            ...u,
                            status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          }
                        : u
                    )
                  );
                  appendAuditLog(
                    'ADMINDISABLEDUSER',
                    'USER_MANAGEMENT',
                    'USER',
                    id,
                    'Toggled Account Status',
                    'Updated User Status'
                  );
                  showToast(`User ${id} account status updated.`);
                }}
                onCreateUser={(newUser) => {
                  setUsers((prev) => [newUser, ...prev]);
                  appendAuditLog(
                    'ADMIN_CREATED_USER',
                    'USER_MANAGEMENT',
                    'USER',
                    newUser.id,
                    'None',
                    `Created ${newUser.fullName} (${newUser.role}) in ${newUser.assignedWard}`
                  );
                  showToast(`User ${newUser.fullName} created.`);
                }}
              />
            )}

            {activeModule === 'rates_categories' && (
              <CategoriesAndRatesView
                categories={categories}
                rates={rates}
                onPublishRate={(newRate) => {
                  setRates((prev) => [newRate, ...prev]);
                  appendAuditLog(
                    'ADMINCHANGEDRATE',
                    'RATE_MASTER',
                    'RATE',
                    newRate.id,
                    'Existing historical dues preserved',
                    `Published ${newRate.id}: ${formatInr(
                      newRate.amountInr
                    )}/mo effective ${newRate.effectiveFrom}`
                  );
                  showToast(
                    `New Rate Master ${newRate.id} published without altering historical dues.`
                  );
                }}
              />
            )}

            {activeModule === 'reports_audit' && (
              <OperationsAndGovernanceHub
                notifications={notifications}
                auditLogs={auditLogs}
                entities={entities}
                onRetryNotification={(id) => {
                  setNotifications((prev) =>
                    prev.map((n) =>
                      n.id === id
                        ? {
                            ...n,
                            status: 'DELIVERED',
                            retryCount: n.retryCount + 1,
                            failureReason: undefined,
                          }
                        : n
                    )
                  );
                  showToast(`Notification ${id} re-dispatched and delivered.`);
                }}
                onRetryGovVerify={(entityId) => {
                  setEntities((prev) =>
                    prev.map((e) =>
                      e.id === entityId
                        ? {
                            ...e,
                            govVerificationStatus: 'VERIFIED',
                            govVerificationRef: `VAHAN-RETRY-OK-${Date.now()
                              .toString()
                              .slice(-4)}`,
                          }
                        : e
                    )
                  );
                  showToast(`Vahan API verification succeeded for ${entityId}.`);
                }}
                onCommitLegacyImport={() => {
                  appendAuditLog(
                    'LEGACY_CSV_STAGING_COMMITTED',
                    'DATA_MIGRATION',
                    'IMPORT_BATCH',
                    'IMP-2026-1010',
                    'Staging Preview (142 valid, 2 blocked)',
                    'Committed 142 validated legacy records; 2 duplicate/invalid rows rejected'
                  );
                  showToast(
                    '142 validated legacy records imported and reconciled.'
                  );
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Field Agent Mobile-First Shell (Part F) */}
      {activeRole === 'AGENT' && (
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <FieldAgentWorkspace
            entities={entities}
            dues={dues}
            payments={payments}
            receipts={receipts}
            closings={closings}
            onRecordCollection={handleRecordCollection}
            onSubmitDailyClosing={(actualCash, note) => {
              const newCls: DailyClosingRecord = {
                id: `CLS-2026-1010-AG104-NEW`,
                agentId: 'AG-104',
                agentName: 'Suresh Kumar Sharma',
                wardName: 'Ward 12 — Atta Market & Sector 18',
                date: '10/10/2026',
                expectedCash: 14250,
                actualCashCount: actualCash,
                cashVariance: actualCash - 14250,
                verifiedDigitalTotal: 8400,
                pendingManualUpiCount: 2,
                pendingManualUpiTotal: 750,
                receiptsCount: 39,
                cancelledCount: 0,
                status: 'SUBMITTED',
                submittedAt: '10/10/2026 11:55',
                discrepancyNote: note,
              };
              setClosings((prev) => [newCls, ...prev]);
              appendAuditLog(
                'AGENT_SUBMITTED_DAILY_CLOSING',
                'CASH_CLOSING',
                'CLOSING',
                newCls.id,
                'Status: OPEN',
                `Submitted Physical Cash: ${formatInr(
                  actualCash
                )}, Variance: ${formatInr(actualCash - 14250)}`
              );
              showToast(
                'Daily Cash Closing submitted to Revenue Officer queue.'
              );
            }}
            onSelectReceipt={setSelectedReceiptModal}
            onNavigateNewReg={() => {
              setActiveRole('ADMIN');
              setActiveModule('entities');
            }}
          />
        </main>
      )}

      {/* Citizen Self-Service Portal Shell (Part K) */}
      {activeRole === 'CITIZEN' && (
        <main className="flex-1 p-4 lg:p-6">
          <CitizenPortalWorkspace
            entities={entities}
            dues={dues}
            receipts={receipts}
            onCitizenOnlinePay={handleCitizenOnlinePay}
            onSelectReceipt={setSelectedReceiptModal}
          />
        </main>
      )}

      {/* Shared Modals */}
      <ReceiptDetailModal
        receipt={selectedReceiptModal}
        onClose={() => setSelectedReceiptModal(null)}
      />
      <PublicVerificationModal
        isOpen={isPublicVerifyOpen}
        onClose={() => setIsPublicVerifyOpen(false)}
        receipts={receipts}
      />
      <AuthSimulatorModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentRole={activeRole}
        onSelectRole={setActiveRole}
      />
      <BlueprintDeliverablesModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        onNavigateRequirement={handleNavigateRequirement}
      />
    </div>
  );
}

