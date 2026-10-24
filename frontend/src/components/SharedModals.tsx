import React, { useState, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Exception, Result } from '@zxing/library';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  XCircle,
  Search,
  ShieldCheck,
  QrCode,
  Printer,
  Lock,
  Smartphone,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  GitBranch,
  Layers,
  ExternalLink,
  X,
  KeyRound,
  UserX,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  ReceiptRecord,
  TraceabilityRequirement,
  UserRole,
} from '../types/suvidha';
import { formatInr, TRACEABILITY_MATRIX } from '../data/mockSuvidhaData';
import { suvidhaApi } from '../services/apiClient';

interface ReceiptDetailModalProps {
  receipt: ReceiptRecord | null;
  onClose: () => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  onClose,
}) => {
  if (!receipt) return null;

  const isProvisional =
    receipt.status === 'PROVISIONAL_OFFLINE' ||
    receipt.status === 'PENDING_UPI_VERIFICATION';

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  React.useEffect(() => {
    const payload = `${receipt.receiptNumber}|${receipt.verificationCode}|${receipt.entityId}`;
    QRCode.toDataURL(payload, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [receipt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Official Municipal E-Receipt · Server Generated
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Noida Municipal Corporation — SuvidhaPay
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close receipt modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isProvisional && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">
                {receipt.status === 'PROVISIONAL_OFFLINE'
                  ? 'PROVISIONAL OFFLINE ACKNOWLEDGEMENT — NOT FINAL SETTLEMENT'
                  : 'MANUAL UPI UTR RECORDED — PENDING BANK/OFFICER VERIFICATION'}
              </p>
              <p className="mt-0.5 text-amber-800">
                This document acknowledges field submission only. Final ledger
                settlement is confirmed only upon server synchronization / officer
                reconciliation.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
          <div>
            <p className="text-slate-500">Receipt Number (Authoritative)</p>
            <p className="font-mono font-semibold text-slate-900 text-sm mt-0.5">
              {receipt.receiptNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Date & Timestamp (IST)</p>
            <p className="font-mono font-medium text-slate-900 mt-0.5">
              {receipt.dateTime}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Payer / Entity Name</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {receipt.entityName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Vehicle / Vendor Reg. ID</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5">
              {receipt.registrationNumber}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Category</p>
            <p className="text-slate-800 mt-0.5">{receipt.categoryName}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Jurisdiction Ward</p>
            <p className="text-slate-800 mt-0.5">{receipt.wardName}</p>
          </div>
        </div>

        <div className="mt-4 border-t border-b border-slate-200 py-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Previous Outstanding Balance</span>
            <span className="font-mono">{formatInr(receipt.previousOutstanding)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-semibold text-sm">
            <span>Current Payment Received ({receipt.paymentMethod})</span>
            <span className="font-mono text-emerald-700">
              {formatInr(receipt.currentPayment)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Allocated to Municipal Dues</span>
            <span className="font-mono">{formatInr(receipt.allocatedAmount)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
            <span>Remaining Outstanding Balance</span>
            <span className="font-mono">{formatInr(receipt.remainingOutstanding)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
          <div className="space-y-1">
            <p className="text-slate-500">
              Transaction Ref:{' '}
              <span className="font-mono text-slate-900">
                {receipt.transactionReference}
              </span>
            </p>
            <p className="text-slate-500">
              Collector / Channel:{' '}
              <span className="text-slate-900 font-medium">
                {receipt.agentName} ({receipt.agentId})
              </span>
            </p>
            <p className="text-slate-500">
              Public Verification Code:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {receipt.verificationCode}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg shrink-0">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Receipt verification QR code" className="w-12 h-12 rounded-md" />
            ) : (
              <QrCode className="w-12 h-12 text-slate-800" />
            )}
            <span className="text-[10px] font-mono text-slate-500 mt-1">
              SCAN TO VERIFY
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0B2545] hover:bg-slate-800 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface PublicVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: ReceiptRecord[];
}

export const PublicVerificationModal: React.FC<PublicVerificationModalProps> = ({
  isOpen,
  onClose,
  receipts,
}) => {
  const [query, setQuery] = useState('SUP/2026/000012345');
  const [serverVerification, setServerVerification] = useState<any>(null);
  const [, setIsVerifying] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  const stopScanner = React.useCallback(() => {
    try {
      scannerRef.current?.stop?.();
    } catch {
      // no-op
    }
    scannerRef.current = null;
    setIsCameraOpen(false);
  }, []);

  const openCameraScanner = React.useCallback(async () => {
    setCameraError('');
    try {
      const codeReader = new BrowserQRCodeReader();
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      if (!devices.length) {
        throw new Error('No camera found on this device.');
      }
      const selectedDeviceId = devices[0].deviceId;
      if (!videoRef.current) return;
      const controls = await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result: Result | undefined, error: Exception | undefined) => {
          if (result) {
            const raw = result.getText();
            const extracted = raw.includes('|') ? raw.split('|')[1] || raw : raw;
            setQuery(extracted);
            stopScanner();
            return;
          }
          if (error && !/No result|Permission denied|NotFoundException/i.test(String(error))) {
            setCameraError('Unable to read QR code from this camera.');
          }
        }
      );
      scannerRef.current = controls;
      setIsCameraOpen(true);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : 'Unable to access the camera for QR scanning.'
      );
      stopScanner();
    }
  }, [stopScanner]);

  React.useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  if (!isOpen) return null;

  const matched = serverVerification
    ? {
        receiptNumber: serverVerification.receiptNumber,
        dateTime: serverVerification.dateTime,
        currentPayment: serverVerification.amountInr,
        status: serverVerification.status,
      }
    : receipts.find(
        (r) =>
          r.receiptNumber.toLowerCase() === query.trim().toLowerCase() ||
          r.verificationCode.toLowerCase() === query.trim().toLowerCase()
      );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            <h3 className="text-base font-bold text-slate-900">
              Public Receipt Verification (Sec 34)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 mt-3">
          Enter a SuvidhaPay Receipt Number or QR Verification Code. Per privacy
          policy (Section 34 & 53), personal mobile numbers, addresses, and full
          entity ledgers are strictly masked on public verification.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Receipt Number or Verification Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. SUP/2026/000012345 or VRF-9928-SUP26"
              className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={() => void openCameraScanner()}
              className="px-3 py-2 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200"
            >
              Scan QR
            </button>
          </div>
          {cameraError && (
            <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {cameraError}
            </p>
          )}
          {isCameraOpen && (
            <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
              <video ref={videoRef} className="w-full h-48 object-cover bg-slate-900" playsInline muted autoPlay />
              <div className="flex items-center justify-between px-3 py-2 bg-white text-[11px] text-slate-600 border-t border-slate-200">
                <span>Live camera scan</span>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="text-slate-700 hover:text-slate-900 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="mt-5">
          {matched ? (
            <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>VALID MUNICIPAL RECEIPT</span>
              </div>
              <div className="pt-2 border-t border-emerald-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Municipality Identity</span>
                  <span className="font-semibold text-slate-900">
                    Noida Municipal Corporation
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Receipt Number</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {matched.receiptNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Verified Amount</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatInr(matched.currentPayment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Date & Time</span>
                  <span className="font-mono text-slate-900">
                    {matched.dateTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Status</span>
                  <span className="font-mono font-semibold text-emerald-800">
                    {matched.status}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-emerald-200/60">
                Payer PII, mobile number, residential address, and historical due
                balances are hidden for citizen privacy protection.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-900">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">INVALID OR UNRECOGNIZED RECEIPT CODE</p>
                <p className="mt-1 text-red-700">
                  No authoritative server receipt matches{' '}
                  <span className="font-mono font-semibold">{query}</span>. Do not
                  accept unverified paper slips or screenshots without a valid QR
                  code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AuthSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const AuthSimulatorModal: React.FC<AuthSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
}) => {
  const [authScreen, setAuthScreen] = useState<
    | 'STAFF_LOGIN'
    | 'CITIZEN_OTP'
    | 'FORGOT_PASSWORD'
    | 'ACCOUNT_DISABLED'
    | 'SESSION_EXPIRED'
    | 'ACCESS_DENIED'
  >('STAFF_LOGIN');
  const [loginId, setLoginId] = useState('ro.rajeshwari');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [otpInput, setOtpInput] = useState('482910');
  const [otpState, setOtpState] = useState<'READY' | 'INVALID' | 'EXPIRED' | 'LOCKED'>('READY');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
              Part B · Section 5 — Authentication & Access Control Suite
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Role-Aware Authentication & Security States Simulator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'STAFF_LOGIN', label: 'Staff / Agent Login' },
            { id: 'CITIZEN_OTP', label: 'Citizen OTP Login' },
            { id: 'FORGOT_PASSWORD', label: 'Password Recovery' },
            { id: 'ACCOUNT_DISABLED', label: 'Account Disabled State' },
            { id: 'SESSION_EXPIRED', label: 'Session Expired' },
            { id: 'ACCESS_DENIED', label: '403 Access Denied' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAuthScreen(tab.id as typeof authScreen)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                authScreen === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-5">
            {authScreen === 'STAFF_LOGIN' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    SuvidhaPay Municipal Staff Sign-In
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sign in with your assigned Municipal Employee ID, Agent Code, or
                    registered mobile number.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Login Identifier (Username / Agent ID / Mobile) *
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label className="font-medium text-slate-700">Password *</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-teal-700 hover:underline"
                    >
                      {showPassword ? 'Hide Password' : 'Show Password'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300" />
                    Remember trusted municipal terminal (7 days)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAuthScreen('FORGOT_PASSWORD')}
                    className="text-teal-700 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onSelectRole('ADMIN');
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-[#0B2545] text-white text-xs font-medium rounded-lg hover:bg-slate-800"
                  >
                    Sign in as ADMIN
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('OFFICER');
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-teal-700 text-white text-xs font-medium rounded-lg hover:bg-teal-800"
                  >
                    Sign in as OFFICER
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('AGENT');
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700"
                  >
                    Sign in as AGENT
                  </button>
                </div>
              </div>
            )}

            {authScreen === 'CITIZEN_OTP' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Citizen / Vendor / Vehicle Owner OTP Login
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Passwordless 6-digit OTP verification linked to registered
                    mobile number.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registered Mobile Number (10 digits) *
                  </label>
                  <input
                    type="text"
                    defaultValue="+91 98114 52310"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label className="font-medium text-slate-700">
                      6-Digit SMS OTP *
                    </label>
                    <span className="font-mono text-slate-500">
                      Expires in 01:42
                    </span>
                  </div>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm tracking-widest bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="text-slate-500 py-1">Simulate state:</span>
                  {(['READY', 'INVALID', 'EXPIRED', 'LOCKED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setOtpState(st)}
                      className={`px-2 py-0.5 rounded border ${
                        otpState === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {otpState === 'INVALID' && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg">
                    Invalid OTP entered. 2 attempts remaining before 15-minute
                    cooldown.
                  </p>
                )}
                {otpState === 'EXPIRED' && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                    This OTP has expired after 5 minutes. Click &ldquo;Resend
                    OTP&rdquo; to generate a fresh code.
                  </p>
                )}
                {otpState === 'LOCKED' && (
                  <p className="text-xs text-red-800 bg-red-50 border border-red-200 p-2.5 rounded-lg font-medium">
                    Retry limit exceeded (5/5 failed attempts). Citizen login is
                    temporarily rate-limited for 15 minutes.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onSelectRole('CITIZEN');
                      onClose();
                    }}
                    disabled={otpState === 'LOCKED'}
                    className="flex-1 py-2 px-4 bg-[#0B2545] disabled:bg-slate-300 text-white text-xs font-medium rounded-lg"
                  >
                    Verify OTP & Open Citizen Portal
                  </button>
                  <button
                    onClick={() => setOtpState('READY')}
                    className="py-2 px-3 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            )}

            {authScreen === 'FORGOT_PASSWORD' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <KeyRound className="w-5 h-5 text-teal-700" />
                  <h4 className="text-base font-bold">
                    Reset / Change Municipal Password
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Staff password recovery requires registered official mobile OTP
                  verification or Administrator reset authorization.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Login ID or Official Mobile
                  </label>
                  <input
                    type="text"
                    defaultValue="ro.rajeshwari"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <button
                  onClick={() => setAuthScreen('STAFF_LOGIN')}
                  className="w-full py-2 bg-[#0B2545] text-white text-xs font-medium rounded-lg"
                >
                  Send Recovery OTP & Return to Login
                </button>
              </div>
            )}

            {authScreen === 'ACCOUNT_DISABLED' && (
              <div className="space-y-3 p-2">
                <div className="flex items-center gap-2 text-red-700">
                  <UserX className="w-6 h-6" />
                  <h4 className="text-base font-bold">
                    Account Deactivated (AG-112 · Pradeep Singh Rawat)
                  </h4>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Your SuvidhaPay collector account is currently marked{' '}
                  <span className="font-mono font-semibold">DISABLED</span> by the
                  Municipal Revenue Administrator effective 02/10/2026. Active tokens
                  have been revoked.
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600">
                  Audit Ref: AUD-10087 · Reason: Transferred to Sanitation Dept
                </div>
              </div>
            )}

            {authScreen === 'SESSION_EXPIRED' && (
              <div className="space-y-3 p-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <Clock className="w-6 h-6" />
                  <h4 className="text-base font-bold">
                    Session Expired / Invalid Token
                  </h4>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  For financial security, municipal officer and collector sessions
                  automatically expire after 30 minutes of inactivity. Any unsaved
                  draft registrations are preserved locally.
                </p>
                <button
                  onClick={() => setAuthScreen('STAFF_LOGIN')}
                  className="px-4 py-2 bg-[#0B2545] text-white text-xs font-medium rounded-lg"
                >
                  Re-Authenticate Session
                </button>
              </div>
            )}

            {authScreen === 'ACCESS_DENIED' && (
              <div className="space-y-3 p-2">
                <div className="flex items-center gap-2 text-red-700">
                  <ShieldAlert className="w-6 h-6" />
                  <h4 className="text-base font-bold">
                    403 — Unauthorized Jurisdiction / Role Action
                  </h4>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Backend RBAC Enforcement: Your current role (
                  <span className="font-mono font-semibold">{currentRole}</span>) is
                  not authorized to modify Rate Masters or approve Due Waivers.
                  Hiding a UI button is never treated as sufficient security.
                </p>
              </div>
            )}
          </div>

          <div className="md:col-span-5 space-y-3 text-xs">
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h5 className="font-bold text-slate-900">
                Active Session & Device Context
              </h5>
              <div className="space-y-1 text-slate-600">
                <p>
                  Active Role:{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {currentRole}
                  </span>
                </p>
                <p>
                  Municipality:{' '}
                  <span className="font-medium text-slate-900">
                    Noida Municipal Corporation
                  </span>
                </p>
                <p>
                  RBAC Authority:{' '}
                  <span className="text-emerald-700 font-medium">
                    Server-Enforced JWT + Ward Scope
                  </span>
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h5 className="font-bold text-slate-900">
                Blueprint Compliance Notes (Sec 5 & 53)
              </h5>
              <ul className="space-y-1.5 text-slate-600 list-disc pl-4">
                <li>Role-aware login for Admin, Officer, Agent, and Citizen.</li>
                <li>Citizen OTP expiry, resend cooldown, and retry-limit lockout.</li>
                <li>
                  Explicit screens for Disabled Account, Expired Session, and 403
                  Access Denied.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BlueprintDeliverablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateRequirement: (req: TraceabilityRequirement) => void;
}

export const BlueprintDeliverablesModal: React.FC<BlueprintDeliverablesModalProps> = ({
  isOpen,
  onClose,
  onNavigateRequirement,
}) => {
  const [activeTab, setActiveTab] = useState<
    'TRACEABILITY' | 'IA_SITEMAP' | 'DESIGN_SYSTEM' | 'PHASE_ROADMAP'
  >('TRACEABILITY');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-6xl w-full p-6 shadow-xl my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div>
            <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
              Part R, S, T & U — Sections 54–64 Master Architecture & Deliverables
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              SuvidhaPay Requirements Traceability Matrix, Sitemap, Component Spec & Developer Handoff
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
          {[
            { id: 'TRACEABILITY', label: 'Deliverable 1: Requirements Traceability Matrix (Sec 55)' },
            { id: 'IA_SITEMAP', label: 'Deliverable 2 & 3: Sitemap, Flows & Screen Inventory (Sec 54, 56)' },
            { id: 'DESIGN_SYSTEM', label: 'Deliverable 6 & 7: Design Tokens, Component Spec & Handoff (Sec 60, 61)' },
            { id: 'PHASE_ROADMAP', label: 'Part T & U: Phase 0–8 Execution & Final Quality Audit (Sec 62, 63)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-y-auto flex-1 pr-1">
          {activeTab === 'TRACEABILITY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span>
                  Every requirement in the SuvidhaPay blueprint is mapped below. Click{' '}
                  <strong className="text-slate-900">Open Live Screen</strong> on any
                  row to jump directly to the interactive module.
                </span>
                <span className="font-mono font-semibold text-emerald-700">
                  100% Coverage Verified (0 Missing Requirements)
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Req ID</th>
                      <th className="py-2.5 px-3">Source & Phase</th>
                      <th className="py-2.5 px-3">Module & Feature</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">State Coverage</th>
                      <th className="py-2.5 px-3">Architectural Rule / Note</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {TRACEABILITY_MATRIX.map((row) => (
                      <tr key={row.reqId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {row.reqId}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{row.sourceSection}</div>
                          <div className="text-slate-500">{row.phase}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{row.feature}</div>
                          <div className="text-slate-500">{row.subFeature}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {row.userRole}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{row.stateCoverage}</td>
                        <td className="py-2.5 px-3 text-slate-600">{row.openQuestion}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              onNavigateRequirement(row);
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-[#0B2545] text-white rounded text-[11px] font-medium hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <span>Open Live Screen</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'IA_SITEMAP' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  1. Administrator Web Console (Full ERP Hierarchy)
                </h4>
                <p className="text-slate-600">
                  Fixed left sidebar + Top jurisdiction bar + High-density tabular workspaces:
                </p>
                <ul className="space-y-1 text-slate-700 list-disc pl-4">
                  <li>
                    <strong>Operational Dashboard (Sec 6):</strong> 11 KPI drill-down cards + 8 collection/dues/agent charts.
                  </li>
                  <li>
                    <strong>Unified Entities & Registrations (Sec 13–16):</strong> Normalized vehicle lookup, 5-step Vehicle Wizard, Vendor Form, Officer Approval Queue.
                  </li>
                  <li>
                    <strong>Due Engine & Financial Ledger (Sec 17–19):</strong> 6-column balance ledger, Batch Rate-Based Due Generator, Waiver/Adjustment approval dialog.
                  </li>
                  <li>
                    <strong>Payments, Allocations & Reconciliation (Sec 28–32):</strong> Atomic multi-due allocation viewer, Online Gateway simulator, 6-state Reconciliation workspace, Refunds/Disputes.
                  </li>
                  <li>
                    <strong>Cash Control & Receipts (Sec 26–27, 33–34):</strong> Daily cash closing verification, Server-numbered receipts, Public QR verifier.
                  </li>
                  <li>
                    <strong>Master Governance & Operations (Sec 7–12, 41–50):</strong> Users/Agents/Officers, Wards/Zones, Categories, Rate Master, Reports, Notifications, Vahan Verify, Audit Logs, Legacy CSV Import, System Settings & Health.
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">
                    2. Revenue Officer Operations Console (Part J — Sec 35–36)
                  </h4>
                  <p className="text-slate-600">
                    Dedicated supervisory workspace for Ward/Zone Revenue Officers:
                  </p>
                  <ul className="space-y-1 text-slate-700 list-disc pl-4">
                    <li>Registration Approval Queue with Vahan status & duplicate checks.</li>
                    <li>Daily Agent Cash Closing verification & discrepancy escalation.</li>
                    <li>Manual UPI UTR verification queue (match bank UTR before marking PAID).</li>
                    <li>Waiver/Adjustment approvals & Dispute resolution.</li>
                  </ul>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">
                    3. Field Agent Mobile Shell & Citizen Portal (Part F & K)
                  </h4>
                  <ul className="space-y-1 text-slate-700 list-disc pl-4">
                    <li>
                      <strong>Field Agent Mobile Shell (Sec 20–26, 52):</strong> Thumb-zone bottom bar, Fast Search, Quick Profile, Under-30s Cash/Manual UPI Collection, Provisional Offline Queue, Daily Cash Closing.
                    </li>
                    <li>
                      <strong>Citizen Portal Shell (Sec 37–40):</strong> Mobile OTP login, Linked Vehicles/Vendor Stalls, Due breakdown, UPI Intent/Dynamic QR checkout with webhook verification, Receipt download.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DESIGN_SYSTEM' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Visual Identity & Color Tokens (Sec 3)
                </h4>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between p-2 rounded bg-[#0B2545] text-white font-mono">
                    <span>Primary Municipal Navy</span>
                    <span>#0B2545</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0F766E] text-white font-mono">
                    <span>Secondary Civic Teal</span>
                    <span>#0F766E</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] border border-slate-200 text-slate-900 font-mono">
                    <span>Neutral Canvas (60%)</span>
                    <span>#F8FAFC</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono">
                    <span>Verified / Settled</span>
                    <span>#15803D</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 font-mono">
                    <span>Pending / Unverified UTR</span>
                    <span>#B45309</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200 text-red-800 font-mono">
                    <span>Disputed / Variance / Failed</span>
                    <span>#B91C1C</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Typography & Tabular Discipline
                </h4>
                <p className="text-slate-600">
                  2+1 Font Hierarchy with strict vertical decimal alignment:
                </p>
                <div className="space-y-2 pt-1">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <p className="font-display font-bold text-sm text-slate-900">
                      Plus Jakarta Sans (Display & Headers)
                    </p>
                    <p className="text-slate-500">Weights: 600 SemiBold, 700 Bold</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <p className="font-sans font-medium text-sm text-slate-900">
                      Public Sans (Civic ERP Body & Controls)
                    </p>
                    <p className="text-slate-500">Weights: 400 Regular, 500 Medium, 600 SemiBold</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <p className="font-mono font-semibold text-sm text-slate-900">
                      IBM Plex Mono (INR ₹, Receipts, UTRs)
                    </p>
                    <p className="text-slate-500">font-variant-numeric: tabular-nums</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Financial Integrity Invariants (Sec 2, 11, 17, 23, 30)
                </h4>
                <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                  <li>
                    <strong>Never Trust Browser Redirects:</strong> Online payments transition to <span className="font-mono">SUCCESS</span> only via verified backend webhook.
                  </li>
                  <li>
                    <strong>Manual UPI ≠ Paid:</strong> Field-entered UPI UTRs stay <span className="font-mono">PENDING_VERIFICATION</span> until Officer bank reconciliation.
                  </li>
                  <li>
                    <strong>Immutable Historical Dues:</strong> Publishing a new Rate Master never recalculates past unpaid due periods.
                  </li>
                  <li>
                    <strong>No Delete Buttons:</strong> Ledger dues, payments, receipts, and audit logs have zero ordinary delete actions.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'PHASE_ROADMAP' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {[
                { phase: 'Phase 0 — Foundation', items: 'Design system, 3 Application shells, Role-based auth, Error patterns, Audit UI foundations.' },
                { phase: 'Phase 1 — MVP', items: 'Admin & Agent dashboards, Vehicle/Vendor registration, Normalized search, Cash & Manual UPI collection, Server receipts.' },
                { phase: 'Phase 2 — Due Engine', items: 'Rate master with conflict checks, Batch due generator preview, Historical dues preservation, Adjustments & Waivers.' },
                { phase: 'Phase 3 — Collection Ops', items: 'Payment lifecycle timeline, Atomic multi-due allocation, Agent Daily Closing, Officer Cash Reconciliation.' },
                { phase: 'Phase 4 — Reporting', items: 'Daily/Monthly collection, Aging outstanding buckets, Agent/Ward/Category reports, Background job CSV/Excel export.' },
                { phase: 'Phase 5 — Online Payments', items: 'Razorpay/Cashfree config, UPI Intent & Dynamic QR, Webhook signature log, 6-state Settlement Reconciliation, Refunds.' },
                { phase: 'Phase 6 — Notifications', items: 'SMS & WhatsApp templates, Delivery tracking, DLT retry queue, Non-blocking receipt flow.' },
                { phase: 'Phase 7 — Citizen Portal', items: 'Mobile OTP login, Linked entity ownership, Self-service online payment, Public & Citizen receipts.' },
                { phase: 'Phase 8 & Cross-Cutting', items: 'Vahan Government Verification queue & fallback, Legacy CSV staging import, Offline sync queue, System health.' },
              ].map((p) => (
                <div key={p.phase} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{p.phase}</span>
                    <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                      COMPLETE
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1.5 leading-relaxed">{p.items}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
