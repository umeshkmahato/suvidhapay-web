import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Layers,
  Sliders,
  FileBarChart,
  Bell,
  ShieldCheck,
  History,
  Activity,
  Upload,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
} from 'lucide-react';
import {
  SystemUser,
  Ward,
  Zone,
  EntityCategory,
  RateMaster,
  NotificationLog,
  AuditLogEntry,
  MunicipalEntity,
} from '../types/suvidha';
import { formatInr } from '../data/mockSuvidhaData';

interface UsersAgentsWardsViewProps {
  users: SystemUser[];
  wards: Ward[];
  zones: Zone[];
  onToggleUserStatus: (id: string) => void;
  onCreateUser: (u: SystemUser) => void;
}

export const UsersAgentsWardsView: React.FC<UsersAgentsWardsViewProps> = ({
  users,
  wards,
  zones,
  onToggleUserStatus,
  onCreateUser,
}) => {
  const [subTab, setSubTab] = useState<'USERS' | 'AGENTS_OFFICERS' | 'WARDS_ZONES'>('USERS');
  const [fullName, setFullName] = useState('Deepak Kumar Verma');
  const [loginId, setLoginId] = useState('AG-119');
  const [mobile, setMobile] = useState('9811776655');
  const [role, setRole] = useState<'ADMIN' | 'OFFICER' | 'AGENT'>('AGENT');
  const [wardCode, setWardCode] = useState('W-12');

  const duplicateLogin = users.some(
    (u) => u.loginIdentifier.toLowerCase() === loginId.trim().toLowerCase()
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateLogin) return;
    const newUser: SystemUser = {
      id: `USR-${role.slice(0, 3)}-${120 + users.length}`,
      fullName,
      loginIdentifier: loginId,
      mobile,
      email: `${loginId.toLowerCase()}@suvidhapay.in`,
      role,
      assignedWard: wardCode,
      assignedZone: 'Zone 2 — Central Commercial Hub',
      status: 'ACTIVE',
      createdDate: '10/10/2026',
      lastLogin: 'Never (Pending First Sign-In)',
      todayCashCollected: 0,
      todayDigitalCollected: 0,
      receiptCount: 0,
      closingStatus: 'OPEN',
      reconciliationVariance: 0,
    };
    onCreateUser(newUser);
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Sections 7, 8 & 9 — Users, Agents, Officers, Wards & Zones Governance
          </h2>
          <p className="text-slate-500 mt-0.5">
            Role-based jurisdiction assignment, duplicate-user prevention, and collection variance oversight. (Note: Attendance & live GPS tracking are explicitly labeled as Future Scope per Section 8).
          </p>
          {/* TODO [Municipal Hardware Attendance & Live GPS]: Intentionally deferred per Phase 8 architectural roadmap (Section 8). Implement real-time GPS tracking coordinates and biometric field terminal synchronization when municipal IoT devices and vehicle stand sensors are provisioned. */}
        </div>
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'USERS', label: `User Directory & Create (${users.length})` },
            { id: 'AGENTS_OFFICERS', label: 'Agent & Officer Performance (Sec 8)' },
            { id: 'WARDS_ZONES', label: `Wards (${wards.length}) & Zones (${zones.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
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

      {subTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleAdd}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
          >
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Create Municipal Staff / Collector User
            </h3>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Login Identifier / Agent Code *
              </label>
              <input
                type="text"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              {duplicateLogin && (
                <p className="text-red-700 text-[11px] mt-1 font-medium">
                  Duplicate Login ID Warning: {loginId} is already assigned!
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                >
                  <option value="AGENT">AGENT</option>
                  <option value="OFFICER">OFFICER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Assigned Ward *
                </label>
                <select
                  value={wardCode}
                  onChange={(e) => setWardCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                >
                  {wards.map((w) => (
                    <option key={w.id} value={w.code}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Official Mobile Number *
              </label>
              <input
                type="text"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={duplicateLogin}
              className="w-full py-2 bg-[#0B2545] disabled:bg-slate-300 text-white rounded-lg font-medium"
            >
              Create & Assign Jurisdiction
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">User & Login ID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Ward / Zone Scope</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {u.fullName}
                        </div>
                        <div className="font-mono text-slate-500">
                          {u.loginIdentifier} · +91 {u.mobile}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {u.role}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">
                          {u.assignedWard}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {u.assignedZone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {u.lastLogin}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        <span
                          className={
                            u.status === 'ACTIVE'
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onToggleUserStatus(u.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium"
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'AGENTS_OFFICERS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Section 8 — Field Agent Collection Performance & Daily Closing Variance
            </h3>
            <span className="font-mono text-[11px] text-slate-500">
              Future Scope Note: Biometric Attendance & Live Route GPS are disabled in MVP
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {users
              .filter((u) => u.role === 'AGENT')
              .map((ag) => (
                <div
                  key={ag.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {ag.fullName}
                      </p>
                      <p className="font-mono text-slate-500">
                        Code: {ag.loginIdentifier} · Ward: {ag.assignedWard}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-slate-800">
                      {ag.status}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Today Cash:</span>
                      <span className="font-semibold">
                        {formatInr(ag.todayCashCollected || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Verified Digital:</span>
                      <span className="font-semibold text-emerald-700">
                        {formatInr(ag.todayDigitalCollected || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Receipts Issued:</span>
                      <span>{ag.receiptCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Closing Variance:</span>
                      <span
                        className={
                          (ag.reconciliationVariance || 0) < 0
                            ? 'text-red-700 font-bold'
                            : 'text-emerald-700'
                        }
                      >
                        {formatInr(ag.reconciliationVariance || 0)} (
                        {ag.closingStatus})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {subTab === 'WARDS_ZONES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Municipal Zones Hierarchy (Sec 9)
            </h3>
            {zones.map((z) => (
              <div
                key={z.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1"
              >
                <div className="flex justify-between font-bold text-slate-900">
                  <span>
                    {z.name} ({z.code})
                  </span>
                  <span className="font-mono text-emerald-700">{z.status}</span>
                </div>
                <p className="font-mono text-slate-600">
                  Wards: {z.wardsCount} · Entities: {z.totalEntities} · Total Due:{' '}
                  {formatInr(z.totalOutstanding)}
                </p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Ward-to-Zone Mapping & Assigned Revenue Officers
            </h3>
            <div className="space-y-2.5">
              {wards.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {w.name} ({w.code})
                    </p>
                    <p className="text-slate-500">
                      {w.zoneName} · Officer: {w.assignedOfficerName} · Agents:{' '}
                      {w.assignedAgentsCount}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-emerald-700">
                      Today: {formatInr(w.todayCollection)}
                    </p>
                    <p className="text-slate-600">
                      Outstanding: {formatInr(w.outstandingDues)}
                    </p>
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

interface CategoriesAndRatesViewProps {
  categories: EntityCategory[];
  rates: RateMaster[];
  onPublishRate: (r: RateMaster) => void;
}

export const CategoriesAndRatesView: React.FC<CategoriesAndRatesViewProps> = ({
  categories,
  rates,
  onPublishRate,
}) => {
  const [catId, setCatId] = useState('CAT-ERICK');
  const [feeType, setFeeType] = useState('Revised Green Transit Fee (FY 2027-28)');
  const [amount, setAmount] = useState(350);
  const [effFrom, setEffFrom] = useState('01/04/2027');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePublish = () => {
    const cat = categories.find((c) => c.id === catId) || categories[0];
    const newRate: RateMaster = {
      id: `RT-2027-0${rates.length + 1}`,
      categoryId: cat.id,
      categoryName: cat.name,
      feeType,
      frequency: 'MONTHLY',
      amountInr: amount,
      effectiveFrom: effFrom,
      effectiveTo: null,
      wardScope: 'ALL',
      status: 'UPCOMING',
      createdBy: 'Anupam Kulkarni (Admin)',
      createdAt: '10/10/2026 11:35',
    };
    onPublishRate(newRate);
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Section 10 Configurable Entity Categories */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Section 10 — Configurable Entity Categories (Unified Profile + Category-Specific Fields)
          </h2>
          <p className="text-slate-500 mt-0.5">
            Categories already in active use by registered entities are protected from destructive schema deletion.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {categories.map((c) => (
            <div
              key={c.id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
            >
              <div className="flex justify-between font-bold text-slate-900">
                <span>{c.name}</span>
                <span className="font-mono text-teal-700">{c.entityType}</span>
              </div>
              <p className="text-slate-600">
                Specific Fields: {c.specificFields.join(' · ')}
              </p>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-mono text-slate-700">
                <span>Active Rate: {formatInr(c.activeRateAmount)}/mo</span>
                <span>{c.entitiesCount} Linked Entities</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 11 Rate Master */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            Section 11 — Publish New Rate Master
          </h3>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
            <strong>Non-Retroactive Rule:</strong> Publishing a new rate applies strictly from its Effective-From date. Historical unpaid dues are never silently recalculated.
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Entity Category *
            </label>
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
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
              Fee Head Description *
            </label>
            <input
              type="text"
              value={feeType}
              onChange={(e) => setFeeType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Amount (INR) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Effective From *
              </label>
              <input
                type="text"
                value={effFrom}
                onChange={(e) => setEffFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full py-2 bg-[#0B2545] text-white rounded-lg font-medium"
            >
              Validate Overlap & Preview Rate Publication
            </button>
          ) : (
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg space-y-2">
              <p className="font-semibold text-slate-900">
                Confirm Rate Master Publication?
              </p>
              <p className="text-slate-600">
                Existing historical dues will retain their original rate reference.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePublish}
                  className="flex-1 py-1.5 bg-emerald-700 text-white rounded font-medium"
                >
                  Confirm & Publish
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            Rate Master Schedule (Active, Upcoming & Historical Expired Rates)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Rate ID</th>
                  <th className="py-2.5 px-3">Category & Fee Type</th>
                  <th className="py-2.5 px-3">Frequency & Scope</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Effective Period</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {r.id}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">
                        {r.categoryName}
                      </div>
                      <div className="text-slate-500">{r.feeType}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {r.frequency} · Ward: {r.wardScope}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatInr(r.amountInr)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {r.effectiveFrom} → {r.effectiveTo || 'Open'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      <span
                        className={
                          r.status === 'ACTIVE'
                            ? 'text-emerald-700'
                            : r.status === 'UPCOMING'
                            ? 'text-teal-700'
                            : 'text-slate-500'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

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
                  <button className="flex-1 py-1.5 bg-white border border-slate-300 rounded font-medium hover:bg-slate-100">
                    Export CSV
                  </button>
                  <button className="flex-1 py-1.5 bg-[#0B2545] text-white rounded font-medium hover:bg-slate-800">
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
                      <div className="font-semibold text-slate-900">
                        {n.recipientName}
                      </div>
                      <div className="font-mono text-slate-500">
                        +91 {n.recipientMobile}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {n.channel} · {n.templateId}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{n.eventType}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">
                        {n.status} (Retries: {n.retryCount})
                      </div>
                      {n.failureReason && (
                        <div className="text-red-700 text-[11px]">
                          {n.failureReason}
                        </div>
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
                  <p className="font-mono font-bold text-slate-900">
                    {e.registrationNumber} — {e.name}
                  </p>
                  <p className="text-slate-600">
                    Gov Status:{' '}
                    <strong className="font-mono">{e.govVerificationStatus}</strong> ·
                    Ref: <span className="font-mono">{e.govVerificationRef}</span> ·
                    Municipal Status:{' '}
                    <strong className="font-mono">{e.registrationStatus}</strong>
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
            <span className="font-mono text-emerald-700 font-semibold">
              READ-ONLY LEDGER
            </span>
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
                      <div className="font-mono text-slate-500 text-[11px]">
                        {a.actorRole} · IP: {a.ipAddress}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-teal-800">{a.action}</div>
                      <div className="text-slate-500 text-[11px]">
                        {a.module} ({a.entityId})
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {a.previousValueSummary}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {a.newValueSummary}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {a.correlationId}
                    </td>
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
              <p className="font-bold text-slate-900 mt-0.5">
                Ward12_Legacy_Autos_Oct26.csv
              </p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-800 font-sans">Valid Staging Rows</span>
              <p className="font-bold text-emerald-800 mt-0.5">142 Rows (₹63,900)</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-800 font-sans">Row-Level Errors Blocked</span>
              <p className="font-bold text-red-800 mt-0.5">
                2 Rows (Duplicate / Bad Mobile)
              </p>
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
                  <td className="py-2 px-3 text-emerald-700 font-semibold">
                    VALID (Normalized → UP16AZ9910)
                  </td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="py-2 px-3">Row #048</td>
                  <td className="py-2 px-3 font-bold">UP-16-AB-1234</td>
                  <td className="py-2 px-3 font-sans">Ramesh Yadav (9811452310)</td>
                  <td className="py-2 px-3 text-right">₹1,150</td>
                  <td className="py-2 px-3 text-red-700 font-semibold">
                    BLOCKED: Duplicate Normalized Vehicle Key UP16AB1234
                  </td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="py-2 px-3">Row #092</td>
                  <td className="py-2 px-3 font-bold">VND-NMC-2026-0112</td>
                  <td className="py-2 px-3 font-sans">Munna Bhai (98114)</td>
                  <td className="py-2 px-3 text-right">₹600</td>
                  <td className="py-2 px-3 text-red-700 font-semibold">
                    BLOCKED: Invalid 10-Digit Indian Mobile Format
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium">
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
                <span className="font-mono font-semibold">
                  SUP/2026/000012345 (FY 2026-27)
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Timezone & Currency</span>
                <span className="font-mono">Asia/Kolkata (IST) · INR (₹)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Razorpay Key Secret (Masked per Sec 12)</span>
                <span className="font-mono text-slate-500">
                  rzp_live_••••••••••••91xQ (HSM Vault)
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Advance Overpayment Policy</span>
                <span className="font-mono text-amber-800 font-semibold">
                  DISABLED (Strict Due Cap)
                </span>
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
                <span className="text-amber-800 font-bold">
                  INTERMITTENT (Manual Fallback Active)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
