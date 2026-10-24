import express, { Router, Request, Response, NextFunction } from 'express';
import {
  AppError,
  sendSuccess,
  sendError,
  parsePagination,
  paginateArray,
  correlationAndSecurityHeaders,
  JwtClaims,
  loadConfig,
} from './infra/core';
import { IDataStore } from './repositories/interfaces';
import {
  MockPaymentGatewayAdapter,
  MockNotificationAdapter,
  MockGovVerificationAdapter,
} from './adapters/mockAdapters';
import { requireAuth, requireRoles } from './middleware/authMiddleware';
import {
  validateBody,
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
  CreateWardSchema,
  CreateZoneSchema,
  CreateCategorySchema,
  CreateEntitySchema,
  UpdateEntitySchema,
  RegistrationDecisionSchema,
  CreateRateSchema,
  UpdateRateSchema,
  GenerateDuesSchema,
  DueAdjustmentActionSchema,
  CashPaymentSchema,
  ManualUpiPaymentSchema,
  CreatePaymentOrderSchema,
  VerifyPaymentSchema,
  RefundOrReversePaymentSchema,
  CreateClosingSchema,
  SubmitClosingSchema,
  VerifyClosingSchema,
  ResolveReconciliationSchema,
  CreateDisputeSchema,
  ResolveDisputeSchema,
  CreateNotificationSchema,
  CreateTemplateSchema,
  VehicleVerificationRequestSchema,
  ImportStagingSchema,
  UpdateSettingsSchema,
} from './schemas/validationSchemas';
import { AuthAndUsersService } from './services/authAndUsersService';
import { EntitiesRatesDuesService } from './services/entitiesRatesDuesService';
import { PaymentsReceiptsService } from './services/paymentsReceiptsService';
import { OperationsAndReportsService } from './services/operationsAndReportsService';
import { buildOpenApiSpec } from './openapi/spec';

export function createSuvidhaApiApp(store: IDataStore): express.Express {
  const app = express();
  const config = loadConfig();
  app.disable('x-powered-by');
  app.use(correlationAndSecurityHeaders);
  app.use((req, res, next) => {
    const origin = req.header('origin');
    if (origin && config.corsOrigin !== '*' && origin !== config.corsOrigin) {
      return next(new AppError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed'));
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', config.corsOrigin === '*' ? '*' : origin);
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Correlation-Id');
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const gatewayAdapter = new MockPaymentGatewayAdapter();
  const notificationAdapter = new MockNotificationAdapter();
  const govAdapter = new MockGovVerificationAdapter();

  const authUsersSvc = new AuthAndUsersService(store);
  const entitiesRatesDuesSvc = new EntitiesRatesDuesService(store);
  const paymentsReceiptsSvc = new PaymentsReceiptsService(
    store,
    gatewayAdapter,
    notificationAdapter
  );
  const opsReportsSvc = new OperationsAndReportsService(
    store,
    notificationAdapter,
    govAdapter
  );

  const auth = requireAuth(store);
  const v1 = Router();

  const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // ============================================================================
  // OPENAPI & DOCS (/openapi.json, /docs, /api/v1/openapi.json)
  // ============================================================================
  const openApiSpec = buildOpenApiSpec();
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  v1.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.get('/docs', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SuvidhaPay REST API v1 — OpenAPI 3.1 Documentation</title>
  <style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#F8FAFC;color:#0F172A}pre{background:#0F172A;color:#F8FAFC;padding:16px;border-radius:8px;overflow:auto}</style>
</head>
<body>
  <h1>SuvidhaPay Municipal Collection Management System — OpenAPI 3.1</h1>
  <p>Machine-readable OpenAPI 3.1 JSON available at <a href="/openapi.json">/openapi.json</a> and <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>.</p>
  <pre>${JSON.stringify(openApiSpec, null, 2)}</pre>
</body>
</html>`);
  });

  // ============================================================================
  // HEALTH & READINESS PROBES (Unauthenticated)
  // ============================================================================
  const handleHealth = asyncHandler(async (_req, res) => {
    const db = await store.readAll();
    const isPostgres = store.constructor.name === 'PostgresDataStore';
    const databaseType = isPostgres ? 'POSTGRESQL' : 'JSON_TEST_STORE';
    const persistenceMode = isPostgres
      ? 'POSTGRES_VOLUME'
      : typeof (store as any).getPersistenceMode === 'function'
        ? (store as any).getPersistenceMode().toUpperCase()
        : 'DISK';
    sendSuccess(res, {
      status: 'UP',
      service: 'suvidhapay-backend',
      version: '1.0.0',
      database: databaseType,
      persistenceMode,
      municipality: db.settings.municipalityName,
      counts: {
        users: db.users.length,
        entities: db.entities.length,
        dues: db.dues.length,
        payments: db.payments.length,
        receipts: db.receipts.length,
        closings: db.closings.length,
        wards: db.wards.length,
        zones: db.zones.length,
      },
    });
  });

  v1.get('/health', handleHealth);
  v1.get('/health/live', (_req, res) => {
    sendSuccess(res, { status: 'LIVE' });
  });
  v1.get(
    '/health/ready',
    asyncHandler(async (_req, res) => {
      await store.readAll();
      sendSuccess(res, { status: 'READY', storageAccessible: true });
    })
  );

  // ============================================================================
  // AUTHENTICATION (/api/v1/auth/*)
  // ============================================================================
  v1.post(
    '/auth/login',
    validateBody(LoginSchema),
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.login({
        loginIdentifier: req.body.loginIdentifier,
        password: req.body.password,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.header('user-agent') || 'SuvidhaPayClient',
        correlationId: res.locals.correlationId,
      });
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/auth/refresh',
    validateBody(RefreshTokenSchema),
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.refreshSession({
        refreshToken: req.body.refreshToken,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.header('user-agent') || 'SuvidhaPayClient',
      });
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/auth/logout',
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.logout(req.body?.refreshToken);
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/auth/forgot-password',
    validateBody(ForgotPasswordSchema),
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.forgotPassword(req.body.loginIdentifier);
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/auth/reset-password',
    validateBody(ResetPasswordSchema),
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.resetPassword(
        req.body.token,
        req.body.newPassword
      );
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/auth/change-password',
    auth,
    validateBody(ChangePasswordSchema),
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.changePassword(
        req.authUser!.sub,
        req.body.currentPassword,
        req.body.newPassword
      );
      sendSuccess(res, result);
    })
  );

  v1.get(
    '/auth/me',
    auth,
    asyncHandler(async (req, res) => {
      const result = await authUsersSvc.getMe(req.authUser!.sub);
      sendSuccess(res, result);
    })
  );

  // ============================================================================
  // USERS, WARDS & ZONES (Module A)
  // ============================================================================
  v1.get(
    '/users',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const list = await authUsersSvc.listUsers({
        role: req.query.role as string | undefined,
        ward: req.query.ward as string | undefined,
        status: req.query.status as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.post(
    '/users',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateUserSchema),
    asyncHandler(async (req, res) => {
      const created = await authUsersSvc.createUser(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/users/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const user = await authUsersSvc.getUserById(req.params.id);
      sendSuccess(res, user);
    })
  );

  v1.patch(
    '/users/:id',
    auth,
    requireRoles('ADMIN'),
    validateBody(UpdateUserSchema),
    asyncHandler(async (req, res) => {
      const updated = await authUsersSvc.updateUser(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.patch(
    '/users/:id/status',
    auth,
    requireRoles('ADMIN'),
    validateBody(UpdateUserStatusSchema),
    asyncHandler(async (req, res) => {
      const updated = await authUsersSvc.updateUserStatus(
        req.authUser!,
        req.params.id,
        req.body.status,
        req.body.reason,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.get(
    '/wards',
    auth,
    asyncHandler(async (_req, res) => {
      const wards = await authUsersSvc.listWards();
      sendSuccess(res, wards);
    })
  );

  v1.post(
    '/wards',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateWardSchema),
    asyncHandler(async (req, res) => {
      const ward = await authUsersSvc.createWard(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, ward, {}, 201);
    })
  );

  v1.get(
    '/zones',
    auth,
    asyncHandler(async (_req, res) => {
      const zones = await authUsersSvc.listZones();
      sendSuccess(res, zones);
    })
  );

  v1.post(
    '/zones',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateZoneSchema),
    asyncHandler(async (req, res) => {
      const zone = await authUsersSvc.createZone(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, zone, {}, 201);
    })
  );

  // ============================================================================
  // CATEGORIES, ENTITIES & REGISTRATIONS (Module B)
  // Note: Specific route `/entities/search` is defined BEFORE `/entities/:id`
  // ============================================================================
  v1.get(
    '/categories',
    auth,
    asyncHandler(async (_req, res) => {
      const categories = await entitiesRatesDuesSvc.listCategories();
      sendSuccess(res, categories);
    })
  );

  v1.post(
    '/categories',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateCategorySchema),
    asyncHandler(async (req, res) => {
      const created = await entitiesRatesDuesSvc.createCategory(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/entities/search',
    auth,
    asyncHandler(async (req, res) => {
      const list = await entitiesRatesDuesSvc.listEntities(req.authUser!, {
        q: (req.query.q as string) || '',
        entityType: req.query.entityType as string | undefined,
        wardId: req.query.wardId as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        status: req.query.status as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.get(
    '/entities',
    auth,
    asyncHandler(async (req, res) => {
      const list = await entitiesRatesDuesSvc.listEntities(req.authUser!, {
        q: req.query.q as string | undefined,
        entityType: req.query.entityType as string | undefined,
        wardId: req.query.wardId as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        status: req.query.status as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.post(
    '/entities',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(CreateEntitySchema),
    asyncHandler(async (req, res) => {
      const created = await entitiesRatesDuesSvc.createEntity(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/entities/:id',
    auth,
    asyncHandler(async (req, res) => {
      const entity = await entitiesRatesDuesSvc.getEntityById(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, entity);
    })
  );

  v1.patch(
    '/entities/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(UpdateEntitySchema),
    asyncHandler(async (req, res) => {
      const updated = await entitiesRatesDuesSvc.updateEntity(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.get(
    '/entities/:id/dues',
    auth,
    asyncHandler(async (req, res) => {
      const result = await entitiesRatesDuesSvc.getEntityOutstandingAndDues(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, result.dues, { breakdown: result.breakdown });
    })
  );

  v1.get(
    '/entities/:id/outstanding',
    auth,
    asyncHandler(async (req, res) => {
      const result = await entitiesRatesDuesSvc.getEntityOutstandingAndDues(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, result);
    })
  );

  v1.get(
    '/entities/:id/payments',
    auth,
    asyncHandler(async (req, res) => {
      await entitiesRatesDuesSvc.getEntityById(req.authUser!, req.params.id);
      const payments = await paymentsReceiptsSvc.listPayments(req.authUser!, {
        entityId: req.params.id,
      });
      sendSuccess(res, payments);
    })
  );

  v1.post(
    '/entities/:id/submit',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const updated = await entitiesRatesDuesSvc.submitRegistration(
        req.authUser!,
        req.params.id,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.post(
    '/entities/:id/approve',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(RegistrationDecisionSchema),
    asyncHandler(async (req, res) => {
      const updated = await entitiesRatesDuesSvc.approveRegistration(
        req.authUser!,
        req.params.id,
        req.body.comments,
        req.body.govVerificationStatus,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.post(
    '/entities/:id/reject',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(RegistrationDecisionSchema),
    asyncHandler(async (req, res) => {
      const updated = await entitiesRatesDuesSvc.rejectRegistration(
        req.authUser!,
        req.params.id,
        req.body.comments,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  // ============================================================================
  // RATE MASTER & DUE ENGINE (Modules C & D)
  // ============================================================================
  v1.get(
    '/rates',
    auth,
    asyncHandler(async (req, res) => {
      const list = await entitiesRatesDuesSvc.listRates({
        categoryId: req.query.categoryId as string | undefined,
        status: req.query.status as string | undefined,
      });
      sendSuccess(res, list);
    })
  );

  v1.post(
    '/rates',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateRateSchema),
    asyncHandler(async (req, res) => {
      const created = await entitiesRatesDuesSvc.createRate(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/rates/:id',
    auth,
    asyncHandler(async (req, res) => {
      const rate = await entitiesRatesDuesSvc.getRateById(req.params.id);
      sendSuccess(res, rate);
    })
  );

  v1.patch(
    '/rates/:id',
    auth,
    requireRoles('ADMIN'),
    validateBody(UpdateRateSchema),
    asyncHandler(async (req, res) => {
      const updated = await entitiesRatesDuesSvc.updateRate(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  v1.get(
    '/dues',
    auth,
    asyncHandler(async (req, res) => {
      const list = await entitiesRatesDuesSvc.listDues(req.authUser!, {
        entityId: req.query.entityId as string | undefined,
        status: req.query.status as string | undefined,
        wardName: req.query.wardName as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  const handleGenerateDues = asyncHandler(async (req, res) => {
    const result = await entitiesRatesDuesSvc.generateDuesBatch(
      req.authUser!,
      req.body,
      res.locals.correlationId
    );
    sendSuccess(res, result, {}, 201);
  });

  v1.post(
    '/dues',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(GenerateDuesSchema),
    handleGenerateDues
  );

  v1.post(
    '/dues/batch-generate',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(GenerateDuesSchema),
    handleGenerateDues
  );

  v1.post(
    '/dues/:id/adjust',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(DueAdjustmentActionSchema),
    asyncHandler(async (req, res) => {
      const result = await entitiesRatesDuesSvc.adjustOrWaiveDue(
        req.authUser!,
        req.params.id,
        'ADJUSTMENT',
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/dues/:id/waive',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(DueAdjustmentActionSchema),
    asyncHandler(async (req, res) => {
      const result = await entitiesRatesDuesSvc.adjustOrWaiveDue(
        req.authUser!,
        req.params.id,
        'WAIVER',
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  v1.get(
    '/adjustments',
    auth,
    asyncHandler(async (_req, res) => {
      const list = await entitiesRatesDuesSvc.listAdjustments();
      sendSuccess(res, list);
    })
  );

  // ============================================================================
  // PAYMENTS, ALLOCATIONS & RECEIPTS (Modules E, F, G)
  // ============================================================================
  v1.post(
    '/payments/cash',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(CashPaymentSchema),
    asyncHandler(async (req, res) => {
      const idemHeader = req.header('idempotency-key');
      const result = await paymentsReceiptsSvc.recordCashPayment(
        req.authUser!,
        {
          ...req.body,
          idempotencyKey: req.body.idempotencyKey || idemHeader,
        },
        res.locals.correlationId
      );
      sendSuccess(
        res,
        result,
        { idempotentReplay: result.idempotentReplay },
        result.idempotentReplay ? 200 : 201
      );
    })
  );

  v1.post(
    '/payments/manual-upi',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(ManualUpiPaymentSchema),
    asyncHandler(async (req, res) => {
      const idemHeader = req.header('idempotency-key');
      const result = await paymentsReceiptsSvc.recordManualUpiPayment(
        req.authUser!,
        {
          ...req.body,
          idempotencyKey: req.body.idempotencyKey || idemHeader,
        },
        res.locals.correlationId
      );
      sendSuccess(
        res,
        result,
        { idempotentReplay: result.idempotentReplay },
        result.idempotentReplay ? 200 : 201
      );
    })
  );

  v1.post(
    '/payments/orders',
    auth,
    validateBody(CreatePaymentOrderSchema),
    asyncHandler(async (req, res) => {
      const result = await paymentsReceiptsSvc.createOnlinePaymentOrder(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result, {}, 201);
    })
  );

  v1.post(
    '/payments/webhook',
    asyncHandler(async (req, res) => {
      const orderId = req.body.orderId;
      const db = await store.readAll();
      const payment = db.payments.find(
        (p) => p.orderId === orderId || p.referenceNumber === orderId || p.id === orderId
      );
      if (!payment) {
        throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment for order ${orderId} not found`);
      }
      const now = Math.floor(Date.now() / 1000);
      const citizenActor: JwtClaims = req.authUser || {
        sub: 'CITIZEN',
        loginIdentifier: 'citizen',
        role: 'CITIZEN',
        assignedWard: 'ALL',
        assignedZone: 'ALL',
        linkedEntityIds: [],
        type: 'access',
        jti: 'webhook-citizen-jti',
        iat: now,
        exp: now + 3600,
      };
      const verified = await paymentsReceiptsSvc.verifyPayment(
        citizenActor,
        payment.id,
        {
          verificationNotes: 'Verified via Gateway Webhook (payment.captured)',
          gatewayTxnId: req.body.paymentId || `txn_${Date.now()}`,
          simulateOutcome: 'SUCCESS',
        },
        res.locals.correlationId
      );
      sendSuccess(res, verified.receipt || verified.payment);
    })
  );

  v1.get(
    '/payments',
    auth,
    asyncHandler(async (req, res) => {
      const list = await paymentsReceiptsSvc.listPayments(req.authUser!, {
        entityId: req.query.entityId as string | undefined,
        method: req.query.method as string | undefined,
        status: req.query.status as string | undefined,
        q: req.query.q as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.get(
    '/payments/:id',
    auth,
    asyncHandler(async (req, res) => {
      const payment = await paymentsReceiptsSvc.getPaymentById(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, payment);
    })
  );

  v1.get(
    '/payments/:id/status',
    auth,
    asyncHandler(async (req, res) => {
      const payment = await paymentsReceiptsSvc.getPaymentById(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, {
        paymentId: payment.id,
        processingStatus: payment.processingStatus,
        settlementStatus: payment.settlementStatus,
        receiptNumber: payment.receiptNumber || null,
        verifiedAt: payment.verifiedAt || null,
      });
    })
  );

  v1.post(
    '/payments/:id/verify',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'CITIZEN'),
    validateBody(VerifyPaymentSchema),
    asyncHandler(async (req, res) => {
      const result = await paymentsReceiptsSvc.verifyPayment(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/payments/:id/refunds',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(RefundOrReversePaymentSchema),
    asyncHandler(async (req, res) => {
      const result = await paymentsReceiptsSvc.refundOrReversePayment(
        req.authUser!,
        req.params.id,
        'REFUND',
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  v1.post(
    '/payments/:id/reverse',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(RefundOrReversePaymentSchema),
    asyncHandler(async (req, res) => {
      const result = await paymentsReceiptsSvc.refundOrReversePayment(
        req.authUser!,
        req.params.id,
        'REVERSAL',
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  // Public receipt verification route BEFORE `/receipts/:id`
  v1.get(
    '/receipts/verify/:code',
    asyncHandler(async (req, res) => {
      const verified = await paymentsReceiptsSvc.verifyReceiptPublic(
        req.params.code
      );
      sendSuccess(res, verified);
    })
  );

  v1.get(
    '/receipts',
    auth,
    asyncHandler(async (req, res) => {
      const list = await paymentsReceiptsSvc.listReceipts(req.authUser!, {
        entityId: req.query.entityId as string | undefined,
        q: req.query.q as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.get(
    '/receipts/:id',
    auth,
    asyncHandler(async (req, res) => {
      const receipt = await paymentsReceiptsSvc.getReceiptById(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, receipt);
    })
  );

  v1.get(
    '/receipts/:id/pdf',
    auth,
    asyncHandler(async (req, res) => {
      const pdfPayload = await paymentsReceiptsSvc.generateReceiptPdfPayload(
        req.authUser!,
        req.params.id
      );
      sendSuccess(res, pdfPayload);
    })
  );

  // ============================================================================
  // FIELD COLLECTIONS & DAILY CASH CLOSING (Modules H & I)
  // ============================================================================
  v1.get(
    '/collections/today',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const data = await opsReportsSvc.getTodayCollections(
        req.authUser!,
        req.query.ward as string | undefined
      );
      sendSuccess(res, data.payments, { summary: data.summary });
    })
  );

  v1.get(
    '/collections/summary',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const data = await opsReportsSvc.getTodayCollections(
        req.authUser!,
        req.query.ward as string | undefined
      );
      sendSuccess(res, data.summary);
    })
  );

  v1.get(
    '/collections/closing',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const list = await opsReportsSvc.listClosings(req.authUser!);
      sendSuccess(res, list);
    })
  );

  v1.post(
    '/collections/closing',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(CreateClosingSchema),
    asyncHandler(async (req, res) => {
      const created = await opsReportsSvc.createDailyClosing(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/collections/closing/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const closing = await opsReportsSvc.getClosingById(req.params.id);
      sendSuccess(res, closing);
    })
  );

  v1.post(
    '/collections/closing/:id/submit',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(SubmitClosingSchema),
    asyncHandler(async (req, res) => {
      const submitted = await opsReportsSvc.submitDailyClosing(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, submitted);
    })
  );

  v1.post(
    '/collections/closing/:id/verify',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(VerifyClosingSchema),
    asyncHandler(async (req, res) => {
      const verified = await opsReportsSvc.verifyDailyClosing(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, verified);
    })
  );

  // ============================================================================
  // RECONCILIATION & DISPUTES (Modules J & K)
  // ============================================================================
  v1.get(
    '/reconciliation',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const list = await opsReportsSvc.listReconciliations(
        req.query.status as string | undefined
      );
      sendSuccess(res, list);
    })
  );

  v1.post(
    '/reconciliation/run',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const result = await opsReportsSvc.runReconciliationPass(
        req.authUser!,
        res.locals.correlationId
      );
      sendSuccess(res, result);
    })
  );

  v1.get(
    '/reconciliation/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const item = await opsReportsSvc.getReconciliationById(req.params.id);
      sendSuccess(res, item);
    })
  );

  v1.post(
    '/reconciliation/:id/resolve',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(ResolveReconciliationSchema),
    asyncHandler(async (req, res) => {
      const resolved = await opsReportsSvc.resolveReconciliationItem(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, resolved);
    })
  );

  v1.get(
    '/disputes',
    auth,
    asyncHandler(async (_req, res) => {
      const list = await opsReportsSvc.listDisputes();
      sendSuccess(res, list);
    })
  );

  v1.post(
    '/disputes',
    auth,
    validateBody(CreateDisputeSchema),
    asyncHandler(async (req, res) => {
      const created = await opsReportsSvc.createDispute(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.post(
    '/disputes/:id/resolve',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(ResolveDisputeSchema),
    asyncHandler(async (req, res) => {
      const resolved = await opsReportsSvc.resolveDispute(
        req.authUser!,
        req.params.id,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, resolved);
    })
  );

  // ============================================================================
  // REPORTS & EXPORTS (Module L)
  // ============================================================================
  v1.get(
    '/reports/collections/daily',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getCollectionsReport('DAILY');
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/collections/monthly',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getCollectionsReport('MONTHLY');
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/collections/agents',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getCollectionsReport('AGENTS');
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/collections/categories',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getCollectionsReport('CATEGORIES');
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/collections/wards',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getCollectionsReport('WARDS');
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/outstanding',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const report = await opsReportsSvc.getOutstandingReport();
      sendSuccess(res, report);
    })
  );

  v1.get(
    '/reports/export',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const exp = await opsReportsSvc.exportReportCsv(
        (req.query.type as string) || 'COLLECTIONS'
      );
      sendSuccess(res, exp);
    })
  );

  // ============================================================================
  // NOTIFICATIONS & GOVERNMENT VERIFICATION (Modules M & N)
  // ============================================================================
  v1.get(
    '/notifications',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const list = await opsReportsSvc.listNotifications();
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.post(
    '/notifications',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    validateBody(CreateNotificationSchema),
    asyncHandler(async (req, res) => {
      const created = await opsReportsSvc.sendNotification(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, created, {}, 201);
    })
  );

  v1.get(
    '/notifications/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const item = await opsReportsSvc.getNotificationById(req.params.id);
      sendSuccess(res, item);
    })
  );

  v1.post(
    '/notifications/:id/retry',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const retried = await opsReportsSvc.retryNotification(
        req.authUser!,
        req.params.id,
        res.locals.correlationId
      );
      sendSuccess(res, retried);
    })
  );

  v1.get(
    '/notification-templates',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const list = await opsReportsSvc.listTemplates();
      sendSuccess(res, list);
    })
  );

  v1.post(
    '/notification-templates',
    auth,
    requireRoles('ADMIN'),
    validateBody(CreateTemplateSchema),
    asyncHandler(async (req, res) => {
      const tpl = await opsReportsSvc.createTemplate(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, tpl, {}, 201);
    })
  );

  v1.post(
    '/verifications/vehicles',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    validateBody(VehicleVerificationRequestSchema),
    asyncHandler(async (req, res) => {
      const rec = await opsReportsSvc.requestVehicleVerification(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, rec, {}, 201);
    })
  );

  v1.get(
    '/verifications/:id',
    auth,
    requireRoles('ADMIN', 'OFFICER', 'AGENT'),
    asyncHandler(async (req, res) => {
      const rec = await opsReportsSvc.getVerificationById(req.params.id);
      sendSuccess(res, rec);
    })
  );

  v1.post(
    '/verifications/:id/retry',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const rec = await opsReportsSvc.retryVerification(
        req.authUser!,
        req.params.id,
        res.locals.correlationId
      );
      sendSuccess(res, rec);
    })
  );

  // ============================================================================
  // AUDIT LOGS, DATA IMPORT & SYSTEM SETTINGS (Modules O, P, Q)
  // ============================================================================
  v1.get(
    '/audit-logs',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (req, res) => {
      const list = await opsReportsSvc.listAuditLogs({
        module: req.query.module as string | undefined,
        action: req.query.action as string | undefined,
        actor: req.query.actor as string | undefined,
        entityId: req.query.entityId as string | undefined,
      });
      const paged = paginateArray(
        list,
        parsePagination(req.query as Record<string, unknown>)
      );
      sendSuccess(res, paged.items, paged.meta);
    })
  );

  v1.post(
    '/imports',
    auth,
    requireRoles('ADMIN'),
    validateBody(ImportStagingSchema),
    asyncHandler(async (req, res) => {
      const batch = await opsReportsSvc.stageDataImport(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, batch, {}, 201);
    })
  );

  v1.post(
    '/imports/:id/commit',
    auth,
    requireRoles('ADMIN'),
    asyncHandler(async (req, res) => {
      const committed = await opsReportsSvc.commitStagedImport(
        req.authUser!,
        req.params.id,
        res.locals.correlationId
      );
      sendSuccess(res, committed);
    })
  );

  v1.get(
    '/settings',
    auth,
    requireRoles('ADMIN', 'OFFICER'),
    asyncHandler(async (_req, res) => {
      const settings = await opsReportsSvc.getSettings();
      sendSuccess(res, settings);
    })
  );

  v1.patch(
    '/settings',
    auth,
    requireRoles('ADMIN'),
    validateBody(UpdateSettingsSchema),
    asyncHandler(async (req, res) => {
      const updated = await opsReportsSvc.updateSettings(
        req.authUser!,
        req.body,
        res.locals.correlationId
      );
      sendSuccess(res, updated);
    })
  );

  app.use('/api/v1', v1);

  // 404 Handler for unmatched /api/* routes
  app.use('/api', (req, res) => {
    sendError(
      res,
      404,
      'ENDPOINT_NOT_FOUND',
      `API route ${req.method} ${req.originalUrl} does not exist`
    );
  });

  // Centralized Error Middleware (Section 8 — No stack traces leaked in responses)
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      if (err instanceof AppError) {
        sendError(res, err.statusCode, err.code, config.nodeEnv === 'production' && err.statusCode >= 500 ? 'Service temporarily unavailable' : err.message, config.nodeEnv === 'production' ? [] : err.details);
        return;
      }
      if (err instanceof SyntaxError && 'body' in err) {
        sendError(res, 400, 'INVALID_JSON', 'Request body must contain valid JSON');
        return;
      }
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error');
    }
  );

  return app;
}
