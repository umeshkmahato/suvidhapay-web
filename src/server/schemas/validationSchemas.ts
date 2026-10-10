import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../infra/core';

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Request payload validation failed', details)
      );
    }
    req.body = parsed.data;
    next();
  };
}

export const LoginSchema = z.object({
  loginIdentifier: z.string().min(2, 'Login identifier is required'),
  password: z.string().min(4, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const ForgotPasswordSchema = z.object({
  loginIdentifier: z.string().min(2, 'Login identifier or mobile is required'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(6, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(4),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const CreateUserSchema = z.object({
  fullName: z.string().min(2),
  loginIdentifier: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  email: z.string().email().optional().default('staff@suvidhapay.in'),
  role: z.enum(['ADMIN', 'OFFICER', 'AGENT', 'CITIZEN']),
  assignedWard: z.string().min(1),
  assignedZone: z.string().min(1),
  password: z.string().min(8).optional(),
  linkedEntityIds: z.array(z.string()).optional(),
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'OFFICER', 'AGENT', 'CITIZEN']).optional(),
  assignedWard: z.string().min(1).optional(),
  assignedZone: z.string().min(1).optional(),
  linkedEntityIds: z.array(z.string()).optional(),
});

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED', 'LOCKED']),
  reason: z.string().min(3).optional(),
});

export const CreateWardSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  zoneId: z.string().min(2),
  assignedOfficerId: z.string().min(2),
});

export const CreateZoneSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
});

export const CreateCategorySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  entityType: z.enum(['VEHICLE', 'VENDOR']),
  specificFields: z.array(z.string()).default([]),
  applicableFeeTypes: z.array(z.string()).default([]),
  activeRateAmount: z.number().positive(),
});

export const CreateEntitySchema = z.object({
  registrationNumber: z.string().min(3),
  entityType: z.enum(['VEHICLE', 'VENDOR']),
  name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit Indian mobile number'),
  address: z.string().min(3),
  categoryId: z.string().min(2),
  vehicleType: z.string().optional(),
  stallLocation: z.string().optional(),
  wardId: z.string().min(2),
  saveAsDraft: z.boolean().optional(),
});

export const UpdateEntitySchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
  address: z.string().min(3).optional(),
  vehicleType: z.string().optional(),
  stallLocation: z.string().optional(),
  wardId: z.string().optional(),
});

export const RegistrationDecisionSchema = z.object({
  comments: z.string().min(3, 'Officer review comments or rejection reason is required'),
  govVerificationStatus: z
    .enum([
      'NOT_REQUESTED',
      'PENDING',
      'VERIFIED',
      'FAILED',
      'NOT_FOUND',
      'SERVICE_UNAVAILABLE',
      'MANUAL_REVIEW',
    ])
    .optional(),
});

export const CreateRateSchema = z.object({
  categoryId: z.string().min(2),
  feeType: z.string().min(2),
  vehicleType: z.string().optional(),
  frequency: z.enum(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
  amountInr: z.number().positive('Rate amount must be positive'),
  effectiveFrom: z.string().min(4),
  effectiveTo: z.string().nullable().optional().default(null),
  wardScope: z.string().default('ALL'),
  status: z.enum(['ACTIVE', 'UPCOMING', 'EXPIRED']).default('ACTIVE'),
});

export const UpdateRateSchema = z.object({
  feeType: z.string().min(2).optional(),
  amountInr: z.number().positive().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'UPCOMING', 'EXPIRED']).optional(),
});

export const GenerateDuesSchema = z.object({
  categoryId: z.string().min(2),
  wardId: z.string().optional().default('ALL'),
  periodStart: z.string().min(4),
  periodEnd: z.string().min(4),
  feeLabel: z.string().optional(),
  entityIds: z.array(z.string()).optional(),
});

export const DueAdjustmentActionSchema = z.object({
  amountInr: z.number().positive('Adjustment/waiver amount must be greater than zero'),
  reason: z.string().min(5, 'Detailed audit reason is required'),
  supportingRef: z.string().min(2).default('MUNICIPAL-ORDER-REF'),
  autoApprove: z.boolean().optional(),
});

export const CashPaymentSchema = z.object({
  entityId: z.string().min(2),
  amountInr: z.number().positive('Collection amount must be positive'),
  dueIds: z.array(z.string()).optional(),
  allocations: z
    .array(
      z.object({
        dueId: z.string().min(2),
        allocatedAmount: z.number().positive(),
      })
    )
    .optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const ManualUpiPaymentSchema = z.object({
  entityId: z.string().min(2),
  amountInr: z.number().positive('Amount must be positive'),
  referenceNumber: z
    .string()
    .min(6, 'Valid UPI UTR / Reference number is required'),
  dueIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const CreatePaymentOrderSchema = z.object({
  entityId: z.string().min(2),
  amountInr: z.number().positive(),
  provider: z.enum(['RAZORPAY_MOCK', 'CASHFREE_MOCK']).optional(),
  dueIds: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});

export const VerifyPaymentSchema = z.object({
  verificationNotes: z.string().optional(),
  gatewayTxnId: z.string().optional(),
  simulateOutcome: z.enum(['SUCCESS', 'FAILED', 'EXPIRED']).optional().default('SUCCESS'),
});

export const RefundOrReversePaymentSchema = z.object({
  amountInr: z.number().positive().optional(),
  reasonCode: z.string().min(3),
  description: z.string().min(5),
});

export const CreateClosingSchema = z.object({
  wardName: z.string().optional(),
  date: z.string().optional(),
  actualCashCount: z.number().min(0),
  discrepancyNote: z.string().optional(),
});

export const SubmitClosingSchema = z.object({
  actualCashCount: z.number().min(0),
  discrepancyNote: z.string().optional(),
});

export const VerifyClosingSchema = z.object({
  action: z.enum(['VERIFY', 'RETURN_FOR_CORRECTION', 'CLOSE']).default('CLOSE'),
  officerComments: z.string().min(3),
});

export const ResolveReconciliationSchema = z.object({
  resolutionStatus: z.enum(['MATCHED', 'UNDER_REVIEW']).default('MATCHED'),
  reviewNotes: z.string().min(3),
});

export const CreateDisputeSchema = z.object({
  recordType: z.enum(['REFUND', 'REVERSAL', 'DISPUTE']).default('DISPUTE'),
  paymentId: z.string().min(2),
  entityId: z.string().min(2),
  amountInr: z.number().positive(),
  reasonCode: z.string().min(3),
  description: z.string().min(5),
});

export const ResolveDisputeSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED']),
  resolutionNotes: z.string().min(3),
});

export const CreateNotificationSchema = z.object({
  recipientName: z.string().min(2),
  recipientMobile: z.string().regex(/^[6-9]\d{9}$/),
  channel: z.enum(['SMS', 'WHATSAPP', 'IN_APP']),
  eventType: z.string().min(2),
  templateId: z.string().optional(),
  simulateFailure: z.boolean().optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(2),
  channel: z.enum(['SMS', 'WHATSAPP', 'IN_APP']),
  eventType: z.string().min(2),
  bodyTemplate: z.string().min(5),
});

export const VehicleVerificationRequestSchema = z.object({
  entityId: z.string().min(2),
  registrationNumber: z.string().min(3),
  ownerName: z.string().optional(),
  simulateMode: z
    .enum([
      'NOT_REQUESTED',
      'PENDING',
      'VERIFIED',
      'FAILED',
      'NOT_FOUND',
      'SERVICE_UNAVAILABLE',
      'MANUAL_REVIEW',
    ])
    .optional(),
});

export const ImportStagingSchema = z.object({
  fileName: z.string().min(3),
  importType: z.enum(['VEHICLES', 'VENDORS', 'LEGACY_DUES']).default('VEHICLES'),
  rows: z.array(
    z.object({
      registrationNumber: z.string().min(2),
      name: z.string().min(2),
      mobile: z.string().min(1),
      categoryId: z.string().optional().default('CAT-AUTO'),
      wardId: z.string().optional().default('WD-12'),
      openingArrearsInr: z.number().min(0).optional().default(0),
    })
  ),
});

export const UpdateSettingsSchema = z.object({
  municipalityName: z.string().min(3).optional(),
  tagline: z.string().min(3).optional(),
  receiptPrefix: z.string().min(2).optional(),
  allowAdvanceOverpayment: z.boolean().optional(),
  requireOfficerApprovalForRegistrations: z.boolean().optional(),
  requireAdminApprovalForWaivers: z.boolean().optional(),
  paymentGatewayStatus: z.enum(['ACTIVE', 'MAINTENANCE']).optional(),
});
