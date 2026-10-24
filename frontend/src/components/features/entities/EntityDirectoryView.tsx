import React, { useState } from 'react';
import {
  Search,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import {
  MunicipalEntity,
  Ward,
  EntityCategory,
  GovVerificationStatus,
  RegistrationStatus,
} from '../../../types/suvidha';
import { formatInr, normalizeVehicleNumber } from '../../../data/mockSuvidhaData';

interface UnifiedEntitiesViewProps {
  entities: MunicipalEntity[];
  wards: Ward[];
  categories: EntityCategory[];
  onAddEntity: (entity: MunicipalEntity) => void;
  onUpdateEntityStatus: (
    entityId: string,
    regStatus: RegistrationStatus,
    govStatus: GovVerificationStatus,
    comment: string
  ) => void;
  onOpenQuickCollect?: (entity: MunicipalEntity) => void;
}

export const UnifiedEntitiesView: React.FC<UnifiedEntitiesViewProps> = ({
  entities,
  wards,
  categories,
  onAddEntity,
  onUpdateEntityStatus,
  onOpenQuickCollect,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'DIRECTORY' | 'VEHICLE_WIZARD' | 'VENDOR_FORM' | 'APPROVAL_QUEUE'
  >('DIRECTORY');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VEHICLE' | 'VENDOR'>('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEntity, setSelectedEntity] = useState<MunicipalEntity | null>(null);

  const [wizardStep, setWizardStep] = useState(1);
  const [vehRegNo, setVehRegNo] = useState('UP-16-CD-5521');
  const [vehType, setVehType] = useState('Bajaj Maxima CNG');
  const [vehCatId, setVehCatId] = useState('CAT-AUTO');
  const [ownerName, setOwnerName] = useState('Vikramjeet Singh');
  const [ownerMobile, setOwnerMobile] = useState('9811908721');
  const [ownerAddress, setOwnerAddress] = useState('H.No 118, Mamura Chowk, Sector 66, Noida');
  const [vehWardId, setVehWardId] = useState('WD-12');
  const [vehGovStatus, setVehGovStatus] = useState<GovVerificationStatus>('VERIFIED');
  const [vehGovRef, setVehGovRef] = useState('VAHAN-UP16-7731902');

  const [vendorName, setVendorName] = useState('Kailash Chand Prajapati');
  const [vendorMobile, setVendorMobile] = useState('9871239011');
  const [vendorStall, setVendorStall] = useState('Kiosk Plot B-09, Botanical Bus Bay');
  const [vendorCatId, setVendorCatId] = useState('CAT-VEND');
  const [vendorWardId, setVendorWardId] = useState('WD-14');

  const [reviewComment, setReviewComment] = useState(
    'Physical RC & Municipal Stand allocation verified. Approved for active fee cycle.'
  );

  const normalizedQuery = normalizeVehicleNumber(searchQuery);

  const filteredEntities = entities.filter((e) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      e.normalizedIdentifier.includes(normalizedQuery) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.mobile.includes(searchQuery.trim()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || e.entityType === typeFilter;
    const matchesWard = wardFilter === 'ALL' || e.wardId === wardFilter;
    const matchesStatus = statusFilter === 'ALL' || e.registrationStatus === statusFilter;

    return matchesSearch && matchesType && matchesWard && matchesStatus;
  });

  const duplicateDetected = entities.some(
    (e) => e.normalizedIdentifier === normalizeVehicleNumber(vehRegNo)
  );

  const handleCreateVehicle = () => {
    const cat = categories.find((c) => c.id === vehCatId) || categories[0];
    const ward = wards.find((w) => w.id === vehWardId) || wards[0];
    const newEnt: MunicipalEntity = {
      id: `ENT-${1000 + entities.length + 1}`,
      registrationNumber: vehRegNo.toUpperCase(),
      normalizedIdentifier: normalizeVehicleNumber(vehRegNo),
      entityType: 'VEHICLE',
      name: ownerName,
      mobile: ownerMobile,
      address: ownerAddress,
      category: cat.name,
      categoryId: cat.id,
      vehicleType: vehType,
      wardId: ward.id,
      wardName: ward.name,
      zoneName: ward.zoneName,
      registrationDate: '10/10/2026',
      previousOutstanding: 0,
      newCharges: cat.activeRateAmount,
      adjustmentsTotal: 0,
      waiversTotal: 0,
      paidAllocated: 0,
      outstandingAmount: cat.activeRateAmount,
      registrationStatus: 'SUBMITTED',
      govVerificationStatus: vehGovStatus,
      govVerificationRef: vehGovRef,
      govLastChecked: '10/10/2026 11:20',
    };
    onAddEntity(newEnt);
    setActiveSubTab('APPROVAL_QUEUE');
    setWizardStep(1);
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === vendorCatId) || categories[3];
    const ward = wards.find((w) => w.id === vendorWardId) || wards[1];
    const regNo = `VND-NMC-2026-009${entities.length + 1}`;
    const newEnt: MunicipalEntity = {
      id: `ENT-${1000 + entities.length + 1}`,
      registrationNumber: regNo,
      normalizedIdentifier: normalizeVehicleNumber(regNo),
      entityType: 'VENDOR',
      name: vendorName,
      mobile: vendorMobile,
      address: vendorStall,
      category: cat.name,
      categoryId: cat.id,
      stallLocation: vendorStall,
      wardId: ward.id,
      wardName: ward.name,
      zoneName: ward.zoneName,
      registrationDate: '10/10/2026',
      previousOutstanding: 0,
      newCharges: cat.activeRateAmount,
      adjustmentsTotal: 0,
      waiversTotal: 0,
      paidAllocated: 0,
      outstandingAmount: cat.activeRateAmount,
      registrationStatus: 'SUBMITTED',
      govVerificationStatus: 'MANUAL_REVIEW',
      govVerificationRef: 'TEHBAZARI-SURVEY-2026',
      govLastChecked: '10/10/2026 11:25',
    };
    onAddEntity(newEnt);
    setActiveSubTab('APPROVAL_QUEUE');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Part D — Unified Entity Directory, Registration & Approval Workflow (Sec 13–16)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Supports normalized vehicle search (e.g. <span className="font-mono">UP16AB1234</span> = <span className="font-mono">up-16-ab-1234</span>) and strict distinction between Vahan Gov Verification & Municipal Approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'DIRECTORY', label: `Unified Entity Directory (${entities.length})` },
            { id: 'VEHICLE_WIZARD', label: '5-Step Vehicle Registration (Sec 14)' },
            { id: 'VENDOR_FORM', label: 'Vendor Registration (Sec 15)' },
            {
              id: 'APPROVAL_QUEUE',
              label: `Officer Approval Queue (${entities.filter((e) => e.registrationStatus === 'SUBMITTED' || e.registrationStatus === 'UNDER_REVIEW').length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as typeof activeSubTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === 'DIRECTORY' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Vehicle No (UP16AB1234 or up-16-ab-1234), Vendor ID, Mobile, Name..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Types (Vehicle & Vendor)</option>
                <option value="VEHICLE">Vehicles Only</option>
                <option value="VENDOR">Vendors / Hawkers Only</option>
              </select>

              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Wards</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Registration Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="REJECTED">REJECTED</option>
              </select>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2.5 py-2 text-slate-600 hover:text-slate-900 underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Entity ID & Reg No.</th>
                  <th className="py-2.5 px-3">Name & Mobile</th>
                  <th className="py-2.5 px-3">Category & Type</th>
                  <th className="py-2.5 px-3">Ward / Zone</th>
                  <th className="py-2.5 px-3">Municipal Status</th>
                  <th className="py-2.5 px-3">Gov Verification (Vahan/SVANidhi)</th>
                  <th className="py-2.5 px-3 text-right">Outstanding</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntities.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">
                        {e.registrationNumber}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {e.id} · Reg: {e.registrationDate}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{e.name}</div>
                      <div className="font-mono text-slate-500">+91 {e.mobile}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{e.category}</div>
                      <div className="text-slate-500">
                        {e.entityType} · {e.vehicleType || e.stallLocation}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800">{e.wardName}</div>
                      <div className="text-slate-500 text-[11px]">{e.zoneName}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      <span
                        className={
                          e.registrationStatus === 'ACTIVE'
                            ? 'text-emerald-700'
                            : e.registrationStatus === 'REJECTED'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {e.registrationStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-semibold text-slate-800">
                        {e.govVerificationStatus}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {e.govVerificationRef}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatInr(e.outstandingAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => setSelectedEntity(e)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium"
                      >
                        Profile & Ledger
                      </button>
                      {onOpenQuickCollect && e.outstandingAmount > 0 && (
                        <button
                          onClick={() => onOpenQuickCollect(e)}
                          className="px-2.5 py-1 bg-[#0B2545] hover:bg-slate-800 text-white rounded font-medium"
                        >
                          Collect
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedEntity && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="font-mono text-slate-500">
                    Unified Entity Profile & 6-Part Ledger Summary
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {selectedEntity.name} — {selectedEntity.registrationNumber}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="text-slate-500 hover:text-slate-900 font-medium"
                >
                  Close Profile
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-white p-3 rounded-lg border border-slate-200 font-mono">
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">1. Previous Due</p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {formatInr(selectedEntity.previousOutstanding)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">2. New Charges</p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    +{formatInr(selectedEntity.newCharges)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">3. Adjustments</p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {formatInr(selectedEntity.adjustmentsTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">4. Waivers</p>
                  <p className="font-semibold text-emerald-700 mt-0.5">
                    -{formatInr(selectedEntity.waiversTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">5. Payments Allocated</p>
                  <p className="font-semibold text-emerald-700 mt-0.5">
                    -{formatInr(selectedEntity.paidAllocated)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-sans text-[11px]">6. Remaining Balance</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {formatInr(selectedEntity.outstandingAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'VEHICLE_WIZARD' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-4xl">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Section 14 — 5-Step Vehicle Registration Wizard
            </h3>
            <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
              {[
                { step: 1, label: '1. Vehicle ID' },
                { step: 2, label: '2. Owner Info' },
                { step: 3, label: '3. Jurisdiction' },
                { step: 4, label: '4. Gov Verify' },
                { step: 5, label: '5. Review & Submit' },
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setWizardStep(s.step)}
                  className={`py-2 px-3 rounded-lg font-medium text-left border ${
                    wizardStep === s.step
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {wizardStep === 1 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Vehicle Registration Number * (Normalized Check)
                  </label>
                  <input
                    type="text"
                    value={vehRegNo}
                    onChange={(e) => setVehRegNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Normalized Ledger Key:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {normalizeVehicleNumber(vehRegNo)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Entity Category *
                  </label>
                  <select
                    value={vehCatId}
                    onChange={(e) => setVehCatId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {categories
                      .filter((c) => c.entityType === 'VEHICLE')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {formatInr(c.activeRateAmount)}/mo
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Vehicle Make / Model / Fuel Type *
                  </label>
                  <input
                    type="text"
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              {duplicateDetected && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Duplicate Vehicle Warning: Normalized number{' '}
                    <strong className="font-mono">
                      {normalizeVehicleNumber(vehRegNo)}
                    </strong>{' '}
                    already exists in the municipal registry!
                  </span>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
                >
                  Next: Owner Information →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Registered Owner Full Name *
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Mobile Number (10-digit SMS/OTP enabled) *
                  </label>
                  <input
                    type="text"
                    value={ownerMobile}
                    onChange={(e) => setOwnerMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Operational / Residential Address *
                  </label>
                  <input
                    type="text"
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
                >
                  Next: Jurisdiction →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Assigned Municipal Ward *
                  </label>
                  <select
                    value={vehWardId}
                    onChange={(e) => setVehWardId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.zoneName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Designated Stand / Transit Corridor
                  </label>
                  <input
                    type="text"
                    defaultValue="Sector 18 Metro Gate 2 Auto Stand"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
                >
                  Next: Government Verification →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Simulate abstract Government Verification Provider (Vahan API) response. External service outage (<span className="font-mono">SERVICE_UNAVAILABLE</span>) routes to manual officer fallback without invalidating the application.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Government Verification State (Sec 16 & 47)
                  </label>
                  <select
                    value={vehGovStatus}
                    onChange={(e) =>
                      setVehGovStatus(e.target.value as GovVerificationStatus)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  >
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="SERVICE_UNAVAILABLE">SERVICE_UNAVAILABLE (503 Fallback)</option>
                    <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
                    <option value="PENDING">PENDING</option>
                    <option value="NOT_FOUND">NOT_FOUND</option>
                    <option value="FAILED">FAILED</option>
                    <option value="NOT_REQUESTED">NOT_REQUESTED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Verification Reference ID
                  </label>
                  <input
                    type="text"
                    value={vehGovRef}
                    onChange={(e) => setVehGovRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-medium"
                >
                  Next: Review & Submit →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 5 && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Registration No (Normalized):</span>
                  <p className="font-mono font-bold text-slate-900">
                    {vehRegNo} ({normalizeVehicleNumber(vehRegNo)})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Owner Name & Mobile:</span>
                  <p className="font-semibold text-slate-900">
                    {ownerName} (+91 {ownerMobile})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Gov Verification Status:</span>
                  <p className="font-mono font-semibold text-teal-700">
                    {vehGovStatus} ({vehGovRef})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Target Workflow State:</span>
                  <p className="font-mono font-semibold text-amber-700">
                    SUBMITTED (Awaiting Officer Approval)
                  </p>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={handleCreateVehicle}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium"
                >
                  Submit Vehicle Registration for Approval
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'VENDOR_FORM' && (
        <form
          onSubmit={handleCreateVendor}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-3xl text-xs"
        >
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Section 15 — Municipal Vendor / Street Hawker Registration
            </h3>
            <p className="text-slate-500 mt-0.5">
              Data Minimization Policy: Collects only legally & operationally required municipal vending details. Aadhaar numbers are strictly excluded.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Vendor / License Holder Full Name *
              </label>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={vendorMobile}
                onChange={(e) => setVendorMobile(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Vendor Category *
              </label>
              <select
                value={vendorCatId}
                onChange={(e) => setVendorCatId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {categories
                  .filter((c) => c.entityType === 'VENDOR')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {formatInr(c.activeRateAmount)}/mo
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Assigned Municipal Ward *
              </label>
              <select
                value={vendorWardId}
                onChange={(e) => setVendorWardId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Stall / Pitch / Vending Zone Landmark *
              </label>
              <input
                type="text"
                required
                value={vendorStall}
                onChange={(e) => setVendorStall(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-[#0B2545] text-white rounded-lg font-medium hover:bg-slate-800"
            >
              Submit Vendor Registration to Officer Queue
            </button>
          </div>
        </form>
      )}

      {activeSubTab === 'APPROVAL_QUEUE' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Section 16 — Registration Approval Queue (Draft → Submitted → Under Review → Approved/Active or Rejected)
            </h3>
            <p className="text-slate-500 mt-0.5">
              Officer comments / rejection reasons are mandatory and logged in the immutable audit trail.
            </p>
          </div>

          <div className="mb-3">
            <label className="block font-medium text-slate-700 mb-1">
              Officer Review Comment / Rejection Reason *
            </label>
            <input
              type="text"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="space-y-3">
            {entities.map((ent) => (
              <div
                key={ent.id}
                className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {ent.registrationNumber}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-900">{ent.name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600">{ent.category}</span>
                  </div>
                  <p className="text-slate-600">
                    Ward: {ent.wardName} · Mobile: +91 {ent.mobile} · Gov Verify:{' '}
                    <strong className="font-mono text-slate-900">
                      {ent.govVerificationStatus}
                    </strong>{' '}
                    ({ent.govVerificationRef})
                  </p>
                  {ent.officerComments && (
                    <p className="text-slate-500 italic">
                      Last Review Note: &ldquo;{ent.officerComments}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-800">
                    State: {ent.registrationStatus}
                  </span>
                  <button
                    onClick={() =>
                      onUpdateEntityStatus(
                        ent.id,
                        'ACTIVE',
                        'VERIFIED',
                        reviewComment
                      )
                    }
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve & Activate
                  </button>
                  <button
                    onClick={() =>
                      onUpdateEntityStatus(
                        ent.id,
                        'REJECTED',
                        ent.govVerificationStatus,
                        reviewComment
                      )
                    }
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-medium flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

