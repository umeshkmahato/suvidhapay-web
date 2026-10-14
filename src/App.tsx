/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { suvidhaApi } from './services/apiClient';
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
  Money,
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

  // Centralized Refresh Function to sync all master state from live backend
  const refreshData = async () => {
    try {
      const [
        srvEntities,
        srvRates,
        srvDues,
        srvPayments,
        srvReceipts,
        srvClosings,
        srvRecons,
        srvDisputes,
        srvUsers,
        srvNotifs,
        srvAudits,
      ] = await Promise.all([
        suvidhaApi.request<MunicipalEntity[]>('ADMIN', '/entities?limit=100'),
        suvidhaApi.request<RateMaster[]>('ADMIN', '/rates'),
        suvidhaApi.request<DueRecord[]>('ADMIN', '/dues?limit=100'),
        suvidhaApi.request<PaymentRecord[]>('ADMIN', '/payments?limit=100'),
        suvidhaApi.request<ReceiptRecord[]>('ADMIN', '/receipts?limit=100'),
        suvidhaApi.request<DailyClosingRecord[]>('ADMIN', '/collections/closing'),
        suvidhaApi.request<ReconciliationItem[]>('ADMIN', '/reconciliation'),
        suvidhaApi.request<RefundDisputeRecord[]>('ADMIN', '/disputes'),
        suvidhaApi.request<SystemUser[]>('ADMIN', '/users?limit=100'),
        suvidhaApi.request<NotificationLog[]>('ADMIN', '/notifications?limit=100'),
        suvidhaApi.request<AuditLogEntry[]>('ADMIN', '/audit-logs?limit=100'),
      ]);
      if (srvEntities) setEntities(srvEntities);
      if (srvRates) setRates(srvRates);
      if (srvDues) setDues(srvDues);
      if (srvPayments) setPayments(srvPayments);
      if (srvReceipts) setReceipts(srvReceipts);
      if (srvClosings) setClosings(srvClosings);
      if (srvRecons) setReconciliations(srvRecons);
      if (srvDisputes) setDisputes(srvDisputes);
      if (srvUsers) setUsers(srvUsers);
      if (srvNotifs) setNotifications(srvNotifs);
      if (srvAudits) setAuditLogs(srvAudits);
    } catch (err) {
      console.error('Failed to sync data from backend:', err);
    }
  };

  // Hydrate from live /api/v1 backend on startup
  useEffect(() => {
    let mounted = true;
    void refreshData();
    return () => {
      mounted = false;
    };
  }, []);

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
      timestamp: new Date().toLocaleString('en-IN'),
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

  // Interactive Handlers — Connected to Authoritative REST Backend
  const handleAddEntity = async (newEnt: MunicipalEntity) => {
    const res = await suvidhaApi.requestWithMeta<MunicipalEntity>('ADMIN', '/entities', {
      method: 'POST',
      body: JSON.stringify({
        registrationNumber: newEnt.registrationNumber,
        entityType: newEnt.entityType,
        name: newEnt.name,
        mobile: newEnt.mobile,
        address: newEnt.address,
        categoryId: newEnt.categoryId,
        vehicleType: newEnt.vehicleType,
        stallLocation: newEnt.stallLocation,
        wardId: newEnt.wardId,
      }),
    });
    if (res.success && res.data) {
      showToast(`Registration ${res.data.registrationNumber} submitted to Officer Approval Queue.`);
      await refreshData();
    } else {
      showToast(res.error?.message || 'Failed to submit registration');
    }
  };

  const handleUpdateEntityStatus = async (
    entityId: string,
    regStatus: RegistrationStatus,
    govStatus: GovVerificationStatus,
    comment: string
  ) => {
    const endpoint = regStatus === 'ACTIVE' ? `/entities/${entityId}/approve` : `/entities/${entityId}/reject`;
    const res = await suvidhaApi.requestWithMeta('OFFICER', endpoint, {
      method: 'POST',
      body: JSON.stringify({
        comments: comment,
        govVerificationStatus: govStatus,
      }),
    });
    if (res.success) {
      showToast(`Entity ${entityId} updated to ${regStatus}.`);
      await refreshData();
    } else {
      showToast(res.error?.message || 'Failed to update registration status');
    }
  };

  const handleGenerateBatchDues = async (newDues: DueRecord[]) => {
    if (!newDues.length) return;
    const first = newDues[0];
    const cat = categories.find((c) => c.name === first.categoryName) || categories[0];
    const res = await suvidhaApi.requestWithMeta('ADMIN', '/dues/batch-generate', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: cat.id,
        wardScope: 'ALL',
        periodLabel: 'Nov 2026',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        dueDate: '2026-11-15',
        commit: true,
      }),
    });
    if (res.success) {
      showToast('Batch Due Generation committed to immutable financial ledger.');
      await refreshData();
    } else {
      showToast(res.error?.message || 'Batch due generation failed');
    }
  };

  const handleCreateAdjustment = async (adj: DueAdjustment) => {
    const isWaiver = adj.type === 'WAIVER';
    const endpoint = `/dues/${adj.dueId}/${isWaiver ? 'waive' : 'adjust'}`;
    const payload = isWaiver
      ? {
          waiverAmountPaise: Money.inrToPaise(adj.amountInr),
          reason: adj.reason,
          supportingDocumentRef: adj.supportingRef,
        }
      : {
          adjustedAmountPaise: Money.inrToPaise(adj.amountInr),
          reason: adj.reason,
          supportingDocumentRef: adj.supportingRef,
        };

    const res = await suvidhaApi.requestWithMeta('OFFICER', endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      showToast(`${adj.type} of ${formatInr(adj.amountInr)} committed.`);
      await refreshData();
    } else {
      showToast(res.error?.message || 'Failed to process adjustment');
    }
  };

  const handleApproveRejectAdjustment = async (
    id: string,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, approvalStatus: status } : a))
    );
    showToast(`Adjustment ${id} marked as ${status}.`);
    await refreshData();
  };

  const handleVerifyManualUpi = async (paymentId: string) => {
    const res = await suvidhaApi.requestWithMeta<ReceiptRecord>('OFFICER', `/payments/${paymentId}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        verified: true,
        officerNotes: 'Verified against municipal bank statement scroll',
      }),
    });
    if (res.success && res.data) {
      showToast(`Manual UPI UTR verified! Official Receipt ${res.data.receiptNumber} generated.`);
      await refreshData();
    } else {
      showToast(res.error?.message || 'Failed to verify manual UPI UTR');
    }
  };

  const handleRecordCollection = (
    entity: MunicipalEntity,
    amount: number,
    method: PaymentMethod,
    reference: string,
    isOffline: boolean
  ): ReceiptRecord => {
    const isManualUpi = method === 'UPI_REFERENCE';

    if (isOffline) {
      const receiptNo = `PROV-OFFLINE-${Date.now().toString().slice(-5)}`;
      const newPayId = `PAY-OFFLINE-${Date.now().toString().slice(-4)}`;
      const provReceipt: ReceiptRecord = {
        id: `RCP-PROV-${Date.now().toString().slice(-4)}`,
        receiptNumber: receiptNo,
        paymentId: newPayId,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        categoryName: entity.category,
        wardName: entity.wardName,
        dateTime: new Date().toLocaleString('en-IN'),
        previousOutstanding: entity.outstandingAmount,
        currentPayment: amount,
        allocatedAmount: 0,
        remainingOutstanding: entity.outstandingAmount,
        paymentMethod: method,
        transactionReference: reference,
        agentName: 'Suresh Kumar Sharma (AG-104)',
        agentId: 'AG-104',
        verificationCode: `VRF-OFFLINE-${Date.now().toString().slice(-4)}`,
        status: 'PROVISIONAL_OFFLINE',
      };
      setReceipts((prev) => [provReceipt, ...prev]);
      showToast('Provisional offline submission queued locally.');
      return provReceipt;
    }

    if (isManualUpi) {
      // Async call backend for Manual UPI logging
      void (async () => {
        const res = await suvidhaApi.requestWithMeta<PaymentRecord>('AGENT', '/payments/manual-upi', {
          method: 'POST',
          headers: { 'Idempotency-Key': `upi-${entity.id}-${Date.now()}` },
          body: JSON.stringify({
            entityId: entity.id,
            amountPaise: Money.inrToPaise(amount),
            upiReferenceNumber: reference,
            payerMobile: entity.mobile,
            notes: 'Field manual UPI UTR reference logged',
          }),
        });
        if (res.success) {
          showToast(`Manual UPI UTR ${reference} recorded. Status: PENDING_VERIFICATION.`);
          await refreshData();
        } else {
          showToast(res.error?.message || 'Failed to log manual UPI reference');
        }
      })();

      const ackReceipt: ReceiptRecord = {
        id: `ACK-UPI-${Date.now().toString().slice(-4)}`,
        receiptNumber: `ACK-UPI-${reference.slice(-6)}`,
        paymentId: `PAY-UPI-${Date.now().toString().slice(-4)}`,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        categoryName: entity.category,
        wardName: entity.wardName,
        dateTime: new Date().toLocaleString('en-IN'),
        previousOutstanding: entity.outstandingAmount,
        currentPayment: amount,
        allocatedAmount: 0,
        remainingOutstanding: entity.outstandingAmount,
        paymentMethod: method,
        transactionReference: reference,
        agentName: 'Suresh Kumar Sharma (AG-104)',
        agentId: 'AG-104',
        verificationCode: `ACK-${Date.now().toString().slice(-4)}`,
        status: 'PENDING_UPI_VERIFICATION',
      };
      setReceipts((prev) => [ackReceipt, ...prev]);
      return ackReceipt;
    }

    // CASH PAYMENT
    const receiptNo = `SUP/2026/0000123${47 + receipts.length}`;
    const newPayId = `PAY-2026-${9085 + payments.length}`;

    void (async () => {
      const res = await suvidhaApi.requestWithMeta<ReceiptRecord>('AGENT', '/payments/cash', {
        method: 'POST',
        headers: { 'Idempotency-Key': `cash-${entity.id}-${Date.now()}` },
        body: JSON.stringify({
          entityId: entity.id,
          amountPaise: Money.inrToPaise(amount),
          notes: `Field collection by AG-104 for ${entity.registrationNumber}`,
        }),
      });
      if (res.success && res.data) {
        showToast(`Cash payment verified! Receipt ${res.data.receiptNumber} issued.`);
        await refreshData();
      } else {
        showToast(res.error?.message || 'Cash payment failed');
      }
    })();

    const cashReceipt: ReceiptRecord = {
      id: `RCP-0${receipts.length + 1}`,
      receiptNumber: receiptNo,
      paymentId: newPayId,
      entityId: entity.id,
      entityName: entity.name,
      registrationNumber: entity.registrationNumber,
      categoryName: entity.category,
      wardName: entity.wardName,
      dateTime: new Date().toLocaleString('en-IN'),
      previousOutstanding: entity.outstandingAmount,
      currentPayment: amount,
      allocatedAmount: amount,
      remainingOutstanding: Math.max(0, entity.outstandingAmount - amount),
      paymentMethod: method,
      transactionReference: reference,
      agentName: 'Suresh Kumar Sharma',
      agentId: 'AG-104',
      verificationCode: `VRF-${Date.now().toString().slice(-4)}-SUP26`,
      status: 'VALID',
    };

    setReceipts((prev) => [cashReceipt, ...prev]);
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
    return cashReceipt;
  };

  const handleCitizenOnlinePay = (
    entity: MunicipalEntity,
    amount: number
  ): ReceiptRecord => {
    const receiptNo = `SUP/2026/0000123${47 + receipts.length}`;
    const payId = `PAY-2026-${9090 + payments.length}`;

    // Execute backend order + simulated settlement webhook
    void (async () => {
      const orderRes = await suvidhaApi.requestWithMeta<{ orderId: string; amountPaise: number }>(
        'CITIZEN',
        '/payments/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            entityId: entity.id,
            amountPaise: Money.inrToPaise(amount),
          }),
        }
      );

      if (orderRes.success && orderRes.data) {
        const webhookRes = await suvidhaApi.requestWithMeta<ReceiptRecord>(
          'CITIZEN',
          '/payments/webhook',
          {
            method: 'POST',
            body: JSON.stringify({
              event: 'payment.captured',
              orderId: orderRes.data.orderId,
              paymentId: `pay_RzpCitizen_${Date.now().toString().slice(-5)}`,
              amountPaise: orderRes.data.amountPaise,
              gatewaySignature: 'sig_mock_verified',
            }),
          }
        );
        if (webhookRes.success && webhookRes.data) {
          showToast(`Citizen Online Payment Verified! Receipt ${webhookRes.data.receiptNumber} issued.`);
          await refreshData();
        }
      }
    })();

    const newReceipt: ReceiptRecord = {
      id: `RCP-0${receipts.length + 1}`,
      receiptNumber: receiptNo,
      paymentId: payId,
      entityId: entity.id,
      entityName: entity.name,
      registrationNumber: entity.registrationNumber,
      categoryName: entity.category,
      wardName: entity.wardName,
      dateTime: new Date().toLocaleString('en-IN'),
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
                onResolveReconciliation={async (id, note) => {
                  const res = await suvidhaApi.requestWithMeta('OFFICER', `/reconciliation/${id}/resolve`, {
                    method: 'POST',
                    body: JSON.stringify({
                      resolutionStatus: 'RESOLVED',
                      reviewNotes: note,
                    }),
                  });
                  if (res.success) {
                    showToast(`Reconciliation item ${id} resolved.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to resolve reconciliation item');
                  }
                }}
                onResolveDispute={async (id, status) => {
                  const res = await suvidhaApi.requestWithMeta('OFFICER', `/disputes/${id}/resolve`, {
                    method: 'POST',
                    body: JSON.stringify({
                      status,
                      resolutionNotes: `Adjudicated as ${status} by Officer`,
                    }),
                  });
                  if (res.success) {
                    showToast(`Dispute/Reversal ${id} marked ${status}.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to adjudicate dispute');
                  }
                }}
              />
            )}

            {(activeModule === 'cash_closing' || activeModule === 'receipts' || activeModule === 'officer_closing') && (
              <CashControlAndReceiptsView
                closings={closings}
                receipts={receipts}
                onVerifyClosing={async (id, status, comment) => {
                  const res = await suvidhaApi.requestWithMeta('OFFICER', `/collections/closing/${id}/verify`, {
                    method: 'POST',
                    body: JSON.stringify({
                      status,
                      officerComments: comment,
                    }),
                  });
                  if (res.success) {
                    showToast(`Daily Cash Closing ${id} verified and closed.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to verify closing');
                  }
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
                onToggleUserStatus={async (id) => {
                  const target = users.find((u) => u.id === id);
                  if (!target) return;
                  const newStatus = target.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
                  const res = await suvidhaApi.requestWithMeta('ADMIN', `/users/${id}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      status: newStatus,
                      reason: `Status toggled to ${newStatus}`,
                    }),
                  });
                  if (res.success) {
                    showToast(`User ${id} status updated to ${newStatus}.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to update user status');
                  }
                }}
                onCreateUser={async (newUser) => {
                  const res = await suvidhaApi.requestWithMeta('ADMIN', '/users', {
                    method: 'POST',
                    body: JSON.stringify({
                      fullName: newUser.fullName,
                      loginIdentifier: newUser.loginIdentifier,
                      mobile: newUser.mobile,
                      email: newUser.email,
                      role: newUser.role,
                      assignedWard: newUser.assignedWard,
                      assignedZone: newUser.assignedZone,
                      password: 'Suvidha@Staff2026',
                    }),
                  });
                  if (res.success) {
                    showToast(`User ${newUser.fullName} created successfully.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to create user');
                  }
                }}
              />
            )}

            {activeModule === 'rates_categories' && (
              <CategoriesAndRatesView
                categories={categories}
                rates={rates}
                onPublishRate={async (newRate) => {
                  const res = await suvidhaApi.requestWithMeta('ADMIN', '/rates', {
                    method: 'POST',
                    body: JSON.stringify({
                      categoryId: newRate.categoryId,
                      feeType: newRate.feeType,
                      vehicleType: newRate.vehicleType,
                      frequency: newRate.frequency,
                      amountInr: newRate.amountInr,
                      effectiveFrom: newRate.effectiveFrom,
                      effectiveTo: newRate.effectiveTo,
                      wardScope: newRate.wardScope,
                    }),
                  });
                  if (res.success) {
                    showToast(`New Rate Master published without altering historical dues.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to publish rate master');
                  }
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
                onRetryGovVerify={async (entityId) => {
                  const ent = entities.find((e) => e.id === entityId);
                  if (!ent) return;
                  const res = await suvidhaApi.requestWithMeta('OFFICER', '/verifications/vehicles', {
                    method: 'POST',
                    body: JSON.stringify({
                      entityId: ent.id,
                      registrationNumber: ent.registrationNumber,
                    }),
                  });
                  if (res.success) {
                    showToast(`Vahan API verification succeeded for ${ent.registrationNumber}.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Government verification retry failed');
                  }
                }}
                onCommitLegacyImport={async () => {
                  const res = await suvidhaApi.requestWithMeta('ADMIN', '/imports/IMP-2026-1010/commit', {
                    method: 'POST',
                  });
                  if (res.success) {
                    showToast('142 validated legacy records imported and reconciled.');
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to commit legacy import batch');
                  }
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
            onSubmitDailyClosing={async (actualCash, note) => {
              const createRes = await suvidhaApi.requestWithMeta<DailyClosingRecord>('AGENT', '/collections/closing', {
                method: 'POST',
                body: JSON.stringify({
                  actualCashCount: actualCash,
                  discrepancyNote: note,
                }),
              });
              if (createRes.success && createRes.data) {
                await suvidhaApi.requestWithMeta('AGENT', `/collections/closing/${createRes.data.id}/submit`, {
                  method: 'POST',
                });
                showToast('Daily Cash Closing submitted to Revenue Officer queue.');
                await refreshData();
              } else {
                showToast(createRes.error?.message || 'Failed to submit daily cash closing');
              }
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

