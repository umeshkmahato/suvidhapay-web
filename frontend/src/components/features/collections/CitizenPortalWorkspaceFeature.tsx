import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import {
  MunicipalEntity,
  DueRecord,
  ReceiptRecord,
} from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';
import { suvidhaApi } from '../../../services/apiClient';

export interface CitizenPortalWorkspaceProps {
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
  onCitizenOnlinePay: _onCitizenOnlinePay,
  onSelectReceipt,
}) => {
  const citizenEntities = entities.filter(
    (e) =>
      e.mobile === '9811452310' ||
      e.id === 'ENT-1001' ||
      e.id === 'ENT-1002'
  );
  const activeCitizenEntities =
    citizenEntities.length > 0 ? citizenEntities : entities.slice(0, 2);
  const [selectedEntity, setSelectedEntity] = useState<MunicipalEntity>(
    activeCitizenEntities[0] || entities[0]
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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrOrderDetails, setQrOrderDetails] = useState<{
    orderId: string;
    expiresAt: string;
    amountInr: number;
    qrPayload: string;
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string>('');
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);

  const entityDues = dues.filter((d) => d.entityId === selectedEntity.id);
  const entityReceipts = receipts.filter((r) => r.entityId === selectedEntity.id);

  const resetPaymentFlow = () => {
    setPaymentError('');
    setQrDataUrl('');
    setQrOrderDetails(null);
    setIsPreparingPayment(false);
    setPaymentFlowState('IDLE');
  };

  React.useEffect(() => {
    if (!qrOrderDetails?.qrPayload) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(qrOrderDetails.qrPayload, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0B2545',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''));
  }, [qrOrderDetails?.qrPayload]);

  const handleCreateUpiOrder = async () => {
    setIsPreparingPayment(true);
    setPaymentError('');

    const orderRes = await suvidhaApi.requestWithMeta<{
      orderId: string;
      amountPaise: number;
      gatewayOrder: {
        provider: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
        gatewayOrderId: string;
        amountInr: number;
        upiIntentUri: string;
        qrPayload: string;
        expiresAt: string;
      };
    }>('CITIZEN', '/payments/orders', {
      method: 'POST',
      body: JSON.stringify({
        entityId: selectedEntity.id,
        amountInr: selectedEntity.outstandingAmount,
      }),
    });

    if (!orderRes.success || !orderRes.data) {
      setPaymentError(
        orderRes.error?.message || 'Unable to create a UPI QR order right now.'
      );
      setPaymentFlowState('IDLE');
      setIsPreparingPayment(false);
      return;
    }

    const gatewayOrder = orderRes.data.gatewayOrder;
    const qrPayload =
      gatewayOrder.qrPayload ||
      gatewayOrder.upiIntentUri ||
      `SUVIDHAPAY_QR|${orderRes.data.orderId}|INR|${selectedEntity.outstandingAmount}`;

    setQrOrderDetails({
      orderId: orderRes.data.orderId,
      expiresAt: gatewayOrder.expiresAt,
      amountInr: selectedEntity.outstandingAmount,
      qrPayload,
    });
    setPaymentFlowState('UPI_QR_REVIEW');
    setIsPreparingPayment(false);
  };

  const handleConfirmCitizenWebhookPayment = async () => {
    if (!qrOrderDetails) {
      setPaymentError('Payment order data is missing. Please retry the payment flow.');
      setPaymentFlowState('EXPIRED');
      return;
    }

    setPaymentFlowState('WAITING_WEBHOOK_CONFIRMATION');

    const webhookRes = await suvidhaApi.requestWithMeta<ReceiptRecord>(
      'CITIZEN',
      '/payments/webhook',
      {
        method: 'POST',
        body: JSON.stringify({
          event: 'payment.captured',
          orderId: qrOrderDetails.orderId,
          paymentId: `pay_citizen_${Date.now().toString().slice(-6)}`,
          amountPaise: qrOrderDetails.amountInr * 100,
          gatewaySignature: 'MOCK_VALID_WEBHOOK_SIGNATURE',
        }),
      }
    );

    if (!webhookRes.success || !webhookRes.data) {
      setPaymentError(
        webhookRes.error?.message ||
          'The payment gateway webhook did not confirm the receipt yet.'
      );
      setPaymentFlowState('EXPIRED');
      return;
    }

    setLatestCitizenReceipt(webhookRes.data);
    setPaymentError('');
    setQrDataUrl('');
    setQrOrderDetails(null);
    setPaymentFlowState('VERIFIED_SUCCESS');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
                resetPaymentFlow();
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

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Section 39 — Citizen Online UPI / Dynamic QR Payment
            </h3>
            <p className="text-slate-500 mt-0.5">
              Browser redirect never marks a payment successful without verified server confirmation.
            </p>
          </div>

          {paymentError && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

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
                onClick={handleCreateUpiOrder}
                disabled={selectedEntity.outstandingAmount <= 0 || isPreparingPayment}
                className="w-full py-3.5 bg-[#0B2545] disabled:bg-slate-300 text-white font-bold rounded-xl min-h-[48px]"
              >
                {isPreparingPayment
                  ? 'Creating QR Order...'
                  : `Pay ${formatInr(selectedEntity.outstandingAmount)} via UPI / QR Gateway`}
              </button>
            </div>
          )}

          {paymentFlowState === 'UPI_QR_REVIEW' && qrOrderDetails && (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Citizen UPI QR code"
                    className="w-52 h-52 rounded-xl border border-slate-200 bg-white p-2"
                  />
                ) : (
                  <QrCode className="w-28 h-28 text-slate-900" />
                )}
                <p className="font-mono font-semibold text-slate-900 mt-2">
                  Scan Dynamic BharatQR / UPI Intent
                </p>
                <p className="text-slate-500 font-mono text-[11px]">
                  Order ID: {qrOrderDetails.orderId} · Expires:{' '}
                  {new Date(qrOrderDetails.expiresAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-slate-700 font-bold text-sm mt-1">
                  Amount: {formatInr(qrOrderDetails.amountInr)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmCitizenWebhookPayment}
                  className="flex-1 py-3 bg-teal-700 text-white font-bold rounded-xl disabled:bg-slate-300"
                  disabled={isPreparingPayment}
                >
                  Simulate Customer Paid in UPI App
                </button>
                <button
                  onClick={() => {
                    setPaymentFlowState('EXPIRED');
                    setPaymentError('');
                  }}
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
                onClick={handleConfirmCitizenWebhookPayment}
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
                onClick={() => {
                  resetPaymentFlow();
                }}
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

