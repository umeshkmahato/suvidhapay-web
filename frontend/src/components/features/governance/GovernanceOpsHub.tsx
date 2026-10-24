import React, { useState } from 'react';
import { suvidhaApi } from '../../../services/apiClient';
import {
  NotificationLog,
  AuditLogEntry,
  MunicipalEntity,
} from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

interface OperationsAndGovernanceHubProps {
  notifications: NotificationLog[];
  auditLogs: AuditLogEntry[];
  entities: MunicipalEntity[];
  onRetryNotification: (id: string) => void;
  onRetryGovVerify: (entityId: string) => void;
  onCommitLegacyImport: () => void;
}

export const OperationsAndGovernanceHub: React.FC<OperationsAndGovernanceHubProps> = ({
  notifications,
  auditLogs,
  entities,
  onRetryNotification,
  onRetryGovVerify,
  onCommitLegacyImport,
}) => {
  const [subTab, setSubTab] = useState<
    | 'REPORTS'
    | 'NOTIFICATIONS'
    | 'GOV_VERIFY'
    | 'AUDIT_LOGS'
    | 'LEGACY_IMPORT'
    | 'SETTINGS_HEALTH'
  >('REPORTS');

  const [reportJobState, setReportJobState] = useState<
    'IDLE' | 'REQUESTED' | 'PROCESSING' | 'READY'
  >('READY');
  const [importStep, setImportStep] = useState<'STAGING_PREVIEW' | 'COMMITTED'>(
    'STAGING_PREVIEW'
  );

  const handleExportReport = async (reportTitle: string, format: 'CSV' | 'EXCEL') => {
    const typeMap: Record<string, string> = {
      '1. Collection Reports (Sec 42)': 'COLLECTIONS',
      '2. Outstanding & Aging Reports (Sec 43)': 'OUTSTANDING',
      '3. Agent, Ward & Category Reports (Sec 44)': 'AGENTS',
      '4. Cash & Gateway Reconciliation': 'RECONCILIATION',
      '5. Registration & Vahan Verification': 'VERIFICATIONS',
      '6. Dispute, Waiver & Anomaly Audit': 'AUDIT',
    };
    const key = typeMap[reportTitle] || 'COLLECTIONS';
    const res = await suvidhaApi.requestWithMeta<{ fileName: string; csvContent: string }>('ADMIN', `/reports/export?type=${key}`);
    if (res.success && res.data) {
      const mime = format === 'CSV' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
      const ext = format === 'CSV' ? '.csv' : '.xls';
      const fileName = (res.data.fileName || `SuvidhaPay_${key}.csv`).replace('.csv', ext);
      const blob = new Blob([res.data.csvContent], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadErrorReport = () => {
    const errorCsv = [
      'CSV Row,Identifier,PayerName,Mobile,OpeningArrears,ValidationResult',
      'Row #048,UP-16-AB-1234,Ramesh Yadav,9811452310,1150,BLOCKED: Duplicate Normalized Vehicle Key UP16AB1234',
      'Row #092,VND-NMC-2026-0112,Munna Bhai,98114,600,BLOCKED: Invalid 10-Digit Indian Mobile Format',
    ].join('\n');
    const blob = new Blob([errorCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Ward12_Legacy_Import_Errors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Parts L, M, N, O & P — Reports, Notifications, Vahan Integration, Audit, Legacy Import & System Health
          </h2>
          <p className="text-slate-500 mt-0.5">
            Complete operational administration covering Sections 12 & 41–50.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'REPORTS', label: 'Reports & Async Export (Sec 41–45)' },
            { id: 'NOTIFICATIONS', label: 'Notifications SMS/WA (Sec 46)' },
            { id: 'GOV_VERIFY', label: 'Gov Verification (Sec 47)' },
            { id: 'AUDIT_LOGS', label: 'Immutable Audit Logs (Sec 48)' },
            { id: 'LEGACY_IMPORT', label: 'Legacy CSV Import (Sec 50)' },
            { id: 'SETTINGS_HEALTH', label: 'Settings & Health (Sec 12, 49)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-2.5 py-1.5 font-medium rounded-md transition-colors ${
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

      {subTab === 'REPORTS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Sections 41–45 — Standardized Municipal Reports & Background Job Queue
              </h3>
              <p className="text-slate-500">
                Async Job Workflow: <span className="font-mono">Requested → Processing → Ready → Download CSV / Excel</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-600">
                Async Job Status: <strong>{reportJobState}</strong>
              </span>
              <button
                onClick={() => {
                  setReportJobState('PROCESSING');
                  setTimeout(() => setReportJobState('READY'), 600);
                }}
                className="px-3 py-1.5 bg-[#0B2545] text-white rounded-lg font-medium"
              >
                Run New Report Batch
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[
              { cat: '1. Collection Reports (Sec 42)', desc: 'Daily/Monthly Cash, Verified Digital, Payment & Receipt counts, Refunds.' },
              { cat: '2. Outstanding & Aging Reports (Sec 43)', desc: '0–30, 31–60, 61–90, 90+ day aging buckets by Ward & Category.' },
              { cat: '3. Agent, Ward & Category Reports (Sec 44)', desc: 'Collector variance, receipt counts, pending manual UPI verifications.' },
              { cat: '4. Cash & Gateway Reconciliation', desc: 'Daily chest tally vs bank nodal settlement UTR match report.' },
              { cat: '5. Registration & Vahan Verification', desc: 'Approved, pending, rejected entities & external API timeout logs.' },
              { cat: '6. Dispute, Waiver & Anomaly Audit', desc: 'Full ledger adjustments, high-cash warnings, and correlation logs.' },
            ].map((rep) => (
              <div
                key={rep.cat}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <h4 className="font-bold text-slate-900">{rep.cat}</h4>
                  <p className="text-slate-600 mt-1">{rep.desc}</p>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleExportReport(rep.cat, 'CSV')}
                    className="flex-1 py-1.5 bg-white border border-slate-300 rounded font-medium hover:bg-slate-100"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExportReport(rep.cat, 'EXCEL')}
                    className="flex-1 py-1.5 bg-[#0B2545] text-white rounded font-medium hover:bg-slate-800"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'NOTIFICATIONS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Section 46 — SMS, WhatsApp & In-App Notification Delivery Logs
            </h3>
            <p className="text-slate-500">
              Non-blocking architecture: Payment confirmation and receipt generation never wait on SMS/WhatsApp operator latency.
            </p>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">ID & Timestamp</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Channel & Template</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">Status & Retries</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-slate-900">{n.id}</div>
                      <div className="text-slate-500 text-[11px]">{n.timestamp}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{n.recipientName}</div>
                      <div className="font-mono text-slate-500">+91 {n.recipientMobile}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{n.channel} · {n.templateId}</td>
                    <td className="py-2.5 px-3 font-mono">{n.eventType}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{n.status} (Retries: {n.retryCount})</div>
                      {n.failureReason && (
                        <div className="text-red-700 text-[11px]">{n.failureReason}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {n.status !== 'DELIVERED' && (
                        <button
                          onClick={() => onRetryNotification(n.id)}
                          className="px-2.5 py-1 bg-[#0B2545] text-white rounded font-medium"
                        >
                          Retry Dispatch
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

      {subTab === 'GOV_VERIFY' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Section 47 — Government Verification Workspace (Vahan & PM SVANidhi Adapter)
            </h3>
            <p className="text-slate-500">
              Supports all 7 required states: <span className="font-mono">NOT_REQUESTED, PENDING, VERIFIED, FAILED, NOT_FOUND, SERVICE_UNAVAILABLE, MANUAL_REVIEW</span>.
            </p>
          </div>
          <div className="space-y-3">
            {entities.map((e) => (
              <div
                key={e.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono font-bold text-slate-900">{e.registrationNumber} — {e.name}</p>
                  <p className="text-slate-600">
                    Gov Status: <strong className="font-mono">{e.govVerificationStatus}</strong> · Ref: <span className="font-mono">{e.govVerificationRef}</span> · Municipal Status: <strong className="font-mono">{e.registrationStatus}</strong>
                  </p>
                </div>
                {e.govVerificationStatus !== 'VERIFIED' && (
                  <button
                    onClick={() => onRetryGovVerify(e.id)}
                    className="px-3 py-1.5 bg-teal-700 text-white rounded-lg font-medium"
                  >
                    Retry Vahan API Lookup
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'AUDIT_LOGS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Section 48 — Read-Only Cryptographic Audit Workspace
              </h3>
              <p className="text-slate-500">
                Tracks Actor, Action, Module, Previous/New Value Summary, IP Address, and Correlation ID.
              </p>
            </div>
            <span className="font-mono text-emerald-700 font-semibold">READ-ONLY LEDGER</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Audit ID & Time</th>
                  <th className="py-2.5 px-3">Actor & IP</th>
                  <th className="py-2.5 px-3">Action & Module</th>
                  <th className="py-2.5 px-3">Previous Value</th>
                  <th className="py-2.5 px-3">New Value Summary</th>
                  <th className="py-2.5 px-3">Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditLogs.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-slate-900">{a.id}</div>
                      <div className="text-slate-500 text-[11px]">{a.timestamp}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{a.actorName}</div>
                      <div className="font-mono text-slate-500 text-[11px]">{a.actorRole} · IP: {a.ipAddress}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-teal-800">{a.action}</div>
                      <div className="text-slate-500 text-[11px]">{a.module} ({a.entityId})</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{a.previousValueSummary}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{a.newValueSummary}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{a.correlationId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'LEGACY_IMPORT' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Section 50 — Controlled Legacy Register Excel/CSV Staging Import
            </h3>
            <p className="text-slate-500">
              Direct unreviewed bulk insertion into production financial tables is prohibited. All rows undergo duplicate & format validation first.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-sans">Uploaded File</span>
              <p className="font-bold text-slate-900 mt-0.5">Ward12_Legacy_Autos_Oct26.csv</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-800 font-sans">Valid Staging Rows</span>
              <p className="font-bold text-emerald-800 mt-0.5">142 Rows (₹63,900)</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-800 font-sans">Row-Level Errors Blocked</span>
              <p className="font-bold text-red-800 mt-0.5">2 Rows (Duplicate / Bad Mobile)</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-sans">Staging Status</span>
              <p className="font-bold text-slate-900 mt-0.5">{importStep}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3">CSV Row</th>
                  <th className="py-2 px-3">Vehicle / Vendor ID</th>
                  <th className="py-2 px-3">Name & Mobile</th>
                  <th className="py-2 px-3 text-right">Opening Arrears</th>
                  <th className="py-2 px-3">Validation Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr>
                  <td className="py-2 px-3">Row #014</td>
                  <td className="py-2 px-3 font-bold">UP-16-az-9910</td>
                  <td className="py-2 px-3 font-sans">Sohan Lal (9811203910)</td>
                  <td className="py-2 px-3 text-right">₹900</td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold">VALID (Normalized → UP16AZ9910)</td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="py-2 px-3">Row #048</td>
                  <td className="py-2 px-3 font-bold">UP-16-AB-1234</td>
                  <td className="py-2 px-3 font-sans">Ramesh Yadav (9811452310)</td>
                  <td className="py-2 px-3 text-right">₹1,150</td>
                  <td className="py-2 px-3 text-red-700 font-semibold">BLOCKED: Duplicate Normalized Vehicle Key UP16AB1234</td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="py-2 px-3">Row #092</td>
                  <td className="py-2 px-3 font-bold">VND-NMC-2026-0112</td>
                  <td className="py-2 px-3 font-sans">Munna Bhai (98114)</td>
                  <td className="py-2 px-3 text-right">₹600</td>
                  <td className="py-2 px-3 text-red-700 font-semibold">BLOCKED: Invalid 10-Digit Indian Mobile Format</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleDownloadErrorReport}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Download 2-Row Error CSV Report
            </button>
            {importStep === 'STAGING_PREVIEW' ? (
              <button
                onClick={() => {
                  setImportStep('COMMITTED');
                  onCommitLegacyImport();
                }}
                className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
              >
                Confirm & Import 142 Validated Records
              </button>
            ) : (
              <span className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold">
                142 Validated Records Imported & Reconciled
              </span>
            )}
          </div>
        </div>
      )}

      {subTab === 'SETTINGS_HEALTH' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Section 12 — System Settings & Masked Credentials
            </h3>
            <div className="space-y-2 text-slate-700">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Municipality Name</span>
                <span className="font-semibold">Noida Municipal Corporation</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Receipt Prefix & FY Numbering</span>
                <span className="font-mono font-semibold">SUP/2026/000012345 (FY 2026-27)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Timezone & Currency</span>
                <span className="font-mono">Asia/Kolkata (IST) · INR (₹)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Razorpay Key Secret (Masked per Sec 12)</span>
                <span className="font-mono text-slate-500">rzp_live_••••••••••••91xQ (HSM Vault)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Advance Overpayment Policy</span>
                <span className="font-mono text-amber-800 font-semibold">DISABLED (Strict Due Cap)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Section 49 — System Health, BullMQ Queues & Infrastructure
            </h3>
            <div className="space-y-2 font-mono">
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span>PostgreSQL 16 Primary + Read Replica</span>
                <span className="text-emerald-700 font-bold">HEALTHY (WAL Sync OK)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span>Redis + BullMQ Background Workers</span>
                <span className="text-emerald-700 font-bold">ACTIVE (0 Stuck Jobs)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span>Payment Webhook Receiver</span>
                <span className="text-emerald-700 font-bold">99.98% Uptime</span>
              </div>
              <div className="flex justify-between p-2 bg-amber-50 rounded border border-amber-200">
                <span>Vahan External Gov Gateway</span>
                <span className="text-amber-800 font-bold">INTERRUPTENT (Manual Fallback Active)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

