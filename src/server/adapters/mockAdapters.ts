import crypto from 'crypto';
import {
  GovVerificationStatus,
  NotificationChannel,
  NotificationStatus,
} from '../../types/suvidha';

/**
 * Payment Gateway Adapter Interface & Mock Implementation (Section 10)
 * Replaces direct live calls to Razorpay/Cashfree during development while enforcing
 * order creation, webhook signature verification simulation, and idempotency.
 */
export interface PaymentGatewayOrderResult {
  provider: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
  gatewayOrderId: string;
  amountInr: number;
  currency: 'INR';
  upiIntentUri: string;
  qrPayload: string;
  expiresAt: string;
}

export interface IPaymentGatewayAdapter {
  createOrder(params: {
    paymentId: string;
    entityId: string;
    amountInr: number;
    provider?: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
  }): Promise<PaymentGatewayOrderResult>;

  verifyWebhookSignature(params: {
    payloadRaw: string;
    signature: string;
    secret: string;
  }): boolean;
}

// TODO [Live Bank Payment Gateway Adapter]: Intentionally deferred until ULB merchant banking KYC, escrow account, and live webhook secrets are provisioned. Replace MockPaymentGatewayAdapter with Razorpay/Cashfree SDK integration.
export class MockPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  public async createOrder(params: {
    paymentId: string;
    entityId: string;
    amountInr: number;
    provider?: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
  }): Promise<PaymentGatewayOrderResult> {
    const provider = params.provider || 'RAZORPAY_MOCK';
    const gatewayOrderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return {
      provider,
      gatewayOrderId,
      amountInr: params.amountInr,
      currency: 'INR',
      upiIntentUri: `upi://pay?pa=noidamc@icici&pn=NoidaMunicipalCorp&tr=${gatewayOrderId}&am=${params.amountInr}&cu=INR`,
      qrPayload: `SUVIDHAPAY_QR|${gatewayOrderId}|INR|${params.amountInr}`,
      expiresAt,
    };
  }

  public verifyWebhookSignature(params: {
    payloadRaw: string;
    signature: string;
    secret: string;
  }): boolean {
    if (params.signature === 'MOCK_VALID_WEBHOOK_SIGNATURE') {
      return true;
    }
    const expected = crypto
      .createHmac('sha256', params.secret)
      .update(params.payloadRaw)
      .digest('hex');
    return expected === params.signature;
  }
}

/**
 * Notification Adapter Interface & Mock Implementation (Module M — Section 6)
 * Does not send live SMS or WhatsApp messages in mock mode; persists delivery states.
 */
export interface NotificationDispatchResult {
  status: NotificationStatus;
  providerMessageId: string;
  failureReason?: string;
}

export interface INotificationAdapter {
  dispatch(params: {
    channel: NotificationChannel;
    recipientMobile: string;
    messageBody: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult>;
}

// TODO [Telecom DLT SMS/WhatsApp Provider]: Intentionally deferred until ULB telecom DLT portal registration and pre-approved template IDs are assigned. Replace MockNotificationAdapter with production telecom gateway (e.g. Twilio, Gupshup, or CDAC SMS).
export class MockNotificationAdapter implements INotificationAdapter {
  public async dispatch(params: {
    channel: NotificationChannel;
    recipientMobile: string;
    messageBody: string;
    simulateFailure?: boolean;
  }): Promise<NotificationDispatchResult> {
    if (params.simulateFailure || params.recipientMobile.endsWith('0000')) {
      return {
        status: 'FAILED',
        providerMessageId: `msg_fail_${crypto.randomBytes(4).toString('hex')}`,
        failureReason: 'Simulated DLT / Gateway Delivery Timeout',
      };
    }
    return {
      status: 'DELIVERED',
      providerMessageId: `msg_ok_${crypto.randomBytes(4).toString('hex')}`,
    };
  }
}

/**
 * Government Verification Adapter Interface & Mock Implementation (Module N — Section 6)
 * Abstract Vahan / PM SVANidhi verification adapter without scraping external websites.
 */
export interface GovVerificationLookupResult {
  status: GovVerificationStatus;
  referenceNumber: string;
  ownerNameMatched: boolean;
  vehicleClass?: string;
  notes: string;
}

export interface IGovVerificationAdapter {
  verifyVehicleOrVendor(params: {
    registrationNumber: string;
    ownerName: string;
    simulateMode?: GovVerificationStatus;
  }): Promise<GovVerificationLookupResult>;
}

// TODO [Live Parivahan Vahan & PM SVANidhi APIs]: Intentionally deferred until MoRTH Parivahan NIC API credentials and secure VPN IP whitelisting are authorized for the municipal corporation. Replace MockGovVerificationAdapter with direct NIC SOAP/REST calls.
export class MockGovVerificationAdapter implements IGovVerificationAdapter {
  public async verifyVehicleOrVendor(params: {
    registrationNumber: string;
    ownerName: string;
    simulateMode?: GovVerificationStatus;
  }): Promise<GovVerificationLookupResult> {
    const clean = params.registrationNumber.toUpperCase();
    if (params.simulateMode) {
      return {
        status: params.simulateMode,
        referenceNumber: `VAHAN-SIM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        ownerNameMatched: params.simulateMode === 'VERIFIED',
        vehicleClass: '3W-CNG / Municipal Registered',
        notes: `Simulated status ${params.simulateMode} returned by mock adapter.`,
      };
    }
    if (clean.includes('503') || clean.includes('TIMEOUT')) {
      return {
        status: 'SERVICE_UNAVAILABLE',
        referenceNumber: 'VAHAN-ERR-503',
        ownerNameMatched: false,
        notes: 'External government gateway temporarily unreachable; eligible for manual review fallback.',
      };
    }
    if (clean.includes('NOTFOUND') || clean.includes('9999')) {
      return {
        status: 'NOT_FOUND',
        referenceNumber: 'VAHAN-404',
        ownerNameMatched: false,
        notes: 'Registration number not found in regional transport database.',
      };
    }
    return {
      status: 'VERIFIED',
      referenceNumber: `VAHAN-OK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      ownerNameMatched: true,
      vehicleClass: 'Commercial Municipal Permit Verified',
      notes: 'Matched against mock Vahan/SVANidhi registry.',
    };
  }
}
