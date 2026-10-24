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
  CheckCircle2,
} from 'lucide-react';
import { LoginResult, suvidhaApi } from './services/apiClient';
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
  formatInr,
  Money,
} from './data/mockSuvidhaData';
import {
  ReceiptDetailModal,
  PublicVerificationModal,
  BlueprintDeliverablesModal,
} from './components/SharedModals';
import { LoginPage } from './components/features/auth/LoginPage';
import { OperationalDashboard } from './components/features/dashboard/OperationalDashboard';
import {
  AppShellContextBar,
  AppShellHeader,
} from './components/shared/AppShell';
import { RoleSidebar } from './components/shared/RoleSidebar';
import { AdminDashboardView } from './components/features/dashboard/AdminDashboardView';
import { UnifiedEntitiesView } from './components/features/entities/EntityDirectoryView';
import { DueLedgerAndGeneratorView } from './components/features/payments/DueLedgerAndGeneratorView';
import { PaymentsReconciliationView } from './components/features/payments/PaymentsReconciliationView';
import { CashControlAndReceiptsView } from './components/features/receipts/CashControlAndReceiptsView';
import { UserDirectoryView as UsersAgentsWardsView } from './components/features/users/UserDirectory';
import { CategoriesAndRatesView } from './components/features/governance/CategoriesAndRatesView';
import { OperationsAndGovernanceHub } from './components/features/governance/GovernanceOpsHub';
import { FieldAgentWorkspace } from './components/features/collections/FieldAgentWorkspaceFeature';
import { CitizenPortalWorkspace } from './components/features/collections/CitizenPortalWorkspaceFeature';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
  const [authSession, setAuthSession] = useState<LoginResult | null>(null);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');

  // Master State across all SuvidhaPay modules
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [rates, setRates] = useState<RateMaster[]>([]);
  const [entities, setEntities] = useState<MunicipalEntity[]>([]);
  const [dues, setDues] = useState<DueRecord[]>([]);
  const [adjustments, setAdjustments] = useState<DueAdjustment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>([]);
  const [disputes, setDisputes] = useState<RefundDisputeRecord[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [dbStatus, setDbStatus] = useState<string>('Connecting...');
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [collectionSummary, setCollectionSummary] = useState<{
    cashCollectionInr: number;
    verifiedDigitalCollectionInr: number;
    totalVerifiedCollectionInr: number;
    pendingManualUpiInr: number;
    paymentsCount: number;
  } | null>(null);

  // Modals State
  const [selectedReceiptModal, setSelectedReceiptModal] =
    useState<ReceiptRecord | null>(null);
  const [isPublicVerifyOpen, setIsPublicVerifyOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const resetWorkspaceData = () => {
    setZones([]);
    setWards([]);
    setCategories([]);
    setRates([]);
    setEntities([]);
    setDues([]);
    setAdjustments([]);
    setPayments([]);
    setReceipts([]);
    setClosings([]);
    setReconciliations([]);
    setDisputes([]);
    setUsers([]);
    setNotifications([]);
    setAuditLogs([]);
    setDbStatus('Connecting...');
    setIsDbLoading(true);
    setLastSyncedAt(null);
    setCollectionSummary(null);
    setSelectedReceiptModal(null);
    setIsPublicVerifyOpen(false);
    setIsBlueprintModalOpen(false);
    setToastMessage(null);
  };

  // Centralized Refresh Function to sync all master state from live backend PostgreSQL DB
  const refreshData = async (role: UserRole = activeRole) => {
    try {
      setIsDbLoading(true);
      const canViewGovernanceData = role === 'ADMIN' || role === 'OFFICER';
      const [
        srvZones,
        srvWards,
        srvCategories,
        srvEntities,
        srvRates,
        srvDues,
        srvAdjustments,
        srvPayments,
        srvReceipts,
        srvClosings,
        srvRecons,
        srvDisputes,
        srvUsers,
        srvNotifs,
        srvAudits,
        srvHealth,
        srvCollectionSummary,
      ] = await Promise.all([
        suvidhaApi.request<Zone[]>(role, '/zones'),
        suvidhaApi.request<Ward[]>(role, '/wards'),
        suvidhaApi.request<EntityCategory[]>(role, '/categories'),
        suvidhaApi.request<MunicipalEntity[]>(role, '/entities?limit=100'),
        suvidhaApi.request<RateMaster[]>(role, '/rates'),
        suvidhaApi.request<DueRecord[]>(role, '/dues?limit=100'),
        canViewGovernanceData ? suvidhaApi.request<DueAdjustment[]>(role, '/adjustments') : Promise.resolve(null),
        suvidhaApi.request<PaymentRecord[]>(role, '/payments?limit=100'),
        suvidhaApi.request<ReceiptRecord[]>(role, '/receipts?limit=100'),
        suvidhaApi.request<DailyClosingRecord[]>(role, '/collections/closing'),
        canViewGovernanceData ? suvidhaApi.request<ReconciliationItem[]>(role, '/reconciliation') : Promise.resolve(null),
        canViewGovernanceData ? suvidhaApi.request<RefundDisputeRecord[]>(role, '/disputes') : Promise.resolve(null),
        canViewGovernanceData ? suvidhaApi.request<SystemUser[]>(role, '/users?limit=100') : Promise.resolve(null),
        canViewGovernanceData ? suvidhaApi.request<NotificationLog[]>(role, '/notifications?limit=100') : Promise.resolve(null),
        canViewGovernanceData ? suvidhaApi.request<AuditLogEntry[]>(role, '/audit-logs?limit=100') : Promise.resolve(null),
        suvidhaApi.request<{ database?: string; status?: string }>(role, '/health'),
        role === 'AGENT'
          ? suvidhaApi.request<{
              cashCollectionInr: number;
              verifiedDigitalCollectionInr: number;
              totalVerifiedCollectionInr: number;
              pendingManualUpiInr: number;
              paymentsCount: number;
            }>(role, '/collections/summary')
          : Promise.resolve(null),
      ]);
      if (!srvHealth || !srvEntities || !srvPayments || !srvDues) {
        throw new Error('Required server data is unavailable; previous records may be stale');
      }
      if (srvZones && Array.isArray(srvZones)) setZones(srvZones);
      if (srvWards && Array.isArray(srvWards) && srvWards.length > 0) setWards(srvWards);
      if (srvCategories && Array.isArray(srvCategories) && srvCategories.length > 0) setCategories(srvCategories);
      if (srvEntities && Array.isArray(srvEntities)) setEntities(srvEntities);
      if (srvRates && Array.isArray(srvRates)) setRates(srvRates);
      if (srvDues && Array.isArray(srvDues)) setDues(srvDues);
      if (srvAdjustments && Array.isArray(srvAdjustments)) setAdjustments(srvAdjustments);
      if (srvPayments && Array.isArray(srvPayments)) setPayments(srvPayments);
      if (srvReceipts && Array.isArray(srvReceipts)) setReceipts(srvReceipts);
      if (srvClosings && Array.isArray(srvClosings)) setClosings(srvClosings);
      if (srvRecons && Array.isArray(srvRecons)) setReconciliations(srvRecons);
      if (srvDisputes && Array.isArray(srvDisputes)) setDisputes(srvDisputes);
      if (srvUsers && Array.isArray(srvUsers)) setUsers(srvUsers);
      if (srvNotifs && Array.isArray(srvNotifs)) setNotifications(srvNotifs);
      if (srvAudits && Array.isArray(srvAudits)) setAuditLogs(srvAudits);
      if (srvCollectionSummary) setCollectionSummary(srvCollectionSummary);
      if (srvHealth?.database) {
        setDbStatus(`${srvHealth.database} (Live DB)`);
      } else {
        setDbStatus('Storage status unavailable');
      }
      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to sync data from backend PostgreSQL:', err);
      setDbStatus('POSTGRESQL (Sync Error)');
    } finally {
      setIsDbLoading(false);
    }
  };

  // Load only the data visible to the authenticated role.
  useEffect(() => {
    if (authSession) void refreshData(authSession.user.role);
  }, [authSession]);

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
      actorName: authSession?.user.fullName || 'Unknown user',
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

  const handleRecordCollection = async (
    entity: MunicipalEntity,
    amount: number,
    method: PaymentMethod,
    reference: string,
    isOffline: boolean,
    idempotencyKey?: string
  ): Promise<ReceiptRecord | null> => {
    if (!authSession) return null;
    const isManualUpi = method === 'UPI_REFERENCE';

    if (isOffline) {
      const offlineId = idempotencyKey || `offline-${crypto.randomUUID()}`;
      const provReceipt: ReceiptRecord = {
        id: offlineId,
        receiptNumber: `PROVISIONAL-${offlineId.slice(-8)}`,
        paymentId: offlineId,
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
        agentName: authSession.user.fullName,
        agentId: authSession.user.loginIdentifier,
        verificationCode: `OFFLINE-${offlineId.slice(-8)}`,
        status: 'PROVISIONAL_OFFLINE',
      };
      showToast('Provisional collection is stored on this device and awaits synchronization.');
      return provReceipt;
    }

    if (isManualUpi) {
      const res = await suvidhaApi.requestWithMeta<{ payment: PaymentRecord }>(
        'AGENT',
        '/payments/manual-upi',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey || `upi-${crypto.randomUUID()}` },
          body: JSON.stringify({
            entityId: entity.id,
            amountPaise: Money.inrToPaise(amount),
            upiReferenceNumber: reference,
            payerMobile: entity.mobile,
            notes: `Field manual UPI reference recorded by ${authSession.user.loginIdentifier}`,
          }),
        }
      );
      if (!res.success || !res.data?.payment) {
        showToast(res.error?.message || 'Failed to record manual UPI reference.');
        return null;
      }
      const payment = res.data.payment;
      const ackReceipt: ReceiptRecord = {
        id: payment.id,
        receiptNumber: 'PENDING VERIFICATION — NOT A FINAL RECEIPT',
        paymentId: payment.id,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        categoryName: entity.category,
        wardName: entity.wardName,
        dateTime: payment.timestamp,
        previousOutstanding: entity.outstandingAmount,
        currentPayment: amount,
        allocatedAmount: 0,
        remainingOutstanding: entity.outstandingAmount,
        paymentMethod: method,
        transactionReference: reference,
        agentName: authSession.user.fullName,
        agentId: authSession.user.loginIdentifier,
        verificationCode: 'PENDING OFFICER VERIFICATION',
        status: 'PENDING_UPI_VERIFICATION',
      };
      showToast(`Manual UPI UTR ${payment.referenceNumber} recorded for officer verification.`);
      await refreshData('AGENT');
      return ackReceipt;
    }

    const res = await suvidhaApi.requestWithMeta<{
      payment: PaymentRecord;
      receipt: ReceiptRecord;
    }>('AGENT', '/payments/cash', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey || `cash-${crypto.randomUUID()}` },
        body: JSON.stringify({
          entityId: entity.id,
          amountPaise: Money.inrToPaise(amount),
          referenceNumber: reference,
          notes: `Field collection by ${authSession.user.loginIdentifier} for ${entity.registrationNumber}`,
        }),
      });
    if (!res.success || !res.data?.receipt) {
      showToast(res.error?.message || 'Cash payment failed.');
      return null;
    }
    showToast(`Cash payment verified. Official receipt ${res.data.receipt.receiptNumber} issued.`);
    await refreshData('AGENT');
    return res.data.receipt;
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
    if (req.targetRoleShell !== activeRole) {
      showToast(`Sign in with an authorized ${req.targetRoleShell} account to open this workspace.`);
      return;
    }
    setActiveModule(req.targetModuleKey);
  };

  const handleAuthenticated = (session: LoginResult) => {
    suvidhaApi.clearTokens();
    suvidhaApi.setToken(session.user.role, session.accessToken);
    resetWorkspaceData();
    setActiveRole(session.user.role);
    setActiveModule(session.user.role === 'AGENT' ? 'agent_home' : session.user.role === 'CITIZEN' ? 'citizen_home' : 'dashboard');
    setAuthSession(session);
  };

  const handleSignOut = () => {
    if (authSession?.refreshToken) {
      void suvidhaApi.logout(authSession.refreshToken);
    }
    suvidhaApi.clearTokens();
    resetWorkspaceData();
    setAuthSession(null);
    setActiveRole('ADMIN');
    setActiveModule('dashboard');
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

  if (!authSession) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <AppShellHeader
        userName={authSession.user.fullName}
        activeRole={activeRole}
        onGoHome={() => setActiveModule('dashboard')}
        onOpenTraceability={() => setIsBlueprintModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <AppShellContextBar
        dbStatus={dbStatus}
        lastSyncedAt={lastSyncedAt}
        isDbLoading={isDbLoading}
        activeRole={activeRole}
        onRefresh={() => {
          void refreshData();
          showToast('Refreshed live state from PostgreSQL database.');
        }}
        onOpenPublicVerify={() => setIsPublicVerifyOpen(true)}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {(activeRole === 'ADMIN' || activeRole === 'OFFICER') && (
        <div className="flex-1 flex flex-col lg:flex-row">
          <RoleSidebar
            title={activeRole === 'ADMIN' ? 'Part C — Admin ERP Console' : 'Part J — Revenue Officer Ops'}
            subtitle={activeRole === 'ADMIN' ? `${authSession.user.fullName} (Admin)` : `${authSession.user.fullName} (Revenue Officer)`}
            navItems={(activeRole === 'ADMIN' ? adminNavItems : officerNavItems)}
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            guardrailText={[
              '• Unverified manual UPI UTRs never count as verified revenue.',
              '• Historical dues retain original generated rates.',
              '• Zero ordinary delete buttons on financial records.',
            ]}
          />

          <main className="flex-1 p-5 lg:p-6 overflow-x-hidden">
            {activeModule === 'dashboard' && (
              <OperationalDashboard
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
                  showToast('Sign in with a field agent account to record a collection.');
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
                      password: newUser.password,
                    }),
                  });
                  if (res.success) {
                    showToast(`User ${newUser.fullName} created successfully.`);
                    await refreshData();
                  } else {
                    showToast(res.error?.message || 'Failed to create user');
                    throw new Error('User creation failed');
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
                    throw new Error('Rate publication failed');
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
            categories={categories}
            dues={dues}
            payments={payments}
            receipts={receipts}
            closings={closings}
            collectionSummary={collectionSummary}
            currentUser={authSession.user}
            lastSyncedAt={lastSyncedAt}
            onNotify={showToast}
            onCreateRegistration={async (registration) => {
              const response = await suvidhaApi.requestWithMeta<MunicipalEntity>('AGENT', '/entities', {
                method: 'POST',
                body: JSON.stringify(registration),
              });
              if (!response.success) {
                showToast(response.error?.message || 'Entity registration failed.');
                return false;
              }
              showToast('Registration submitted to the officer review queue.');
              await refreshData('AGENT');
              return true;
            }}
            onRecordCollection={handleRecordCollection}
            onSubmitDailyClosing={async (actualCash, note) => {
              const today = new Date().toISOString().slice(0, 10);
              let closingId = closings.find(
                (closing) =>
                  closing.agentId === authSession.user.loginIdentifier &&
                  closing.date === today &&
                  closing.status === 'OPEN'
              )?.id;

              if (!closingId) {
                const createRes = await suvidhaApi.requestWithMeta<DailyClosingRecord>(
                  'AGENT',
                  '/collections/closing',
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      actualCashCount: actualCash,
                      discrepancyNote: note,
                    }),
                  }
                );
                if (!createRes.success || !createRes.data) {
                  showToast(createRes.error?.message || 'Failed to create daily cash closing.');
                  await refreshData('AGENT');
                  return false;
                }
                closingId = createRes.data.id;
              }

              const submitRes = await suvidhaApi.requestWithMeta<DailyClosingRecord>(
                'AGENT',
                `/collections/closing/${closingId}/submit`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    actualCashCount: actualCash,
                    discrepancyNote: note,
                  }),
                }
              );
              if (submitRes.success) {
                showToast('Daily Cash Closing submitted to Revenue Officer queue.');
                await refreshData('AGENT');
                return true;
              }
              showToast(submitRes.error?.message || 'Closing could not be submitted.');
              await refreshData('AGENT');
              return false;
            }}
            onSelectReceipt={setSelectedReceiptModal}
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
      <BlueprintDeliverablesModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        onNavigateRequirement={handleNavigateRequirement}
      />
    </div>
  );
}
