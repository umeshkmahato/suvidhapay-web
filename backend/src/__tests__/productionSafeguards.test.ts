import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../db/database';
import { PostgresDataStore } from '../db/postgresDataStore';
import { loadConfig, JwtClaims } from '../infra/core';
import { MockGovVerificationAdapter, MockNotificationAdapter, MockPaymentGatewayAdapter } from '../adapters/mockAdapters';
import { JsonFileDataStore } from '../repositories/jsonDataStore';
import { PaymentsReceiptsService } from '../services/paymentsReceiptsService';
import { AuthAndUsersService } from '../services/authAndUsersService';
import request from 'supertest';
import { createSuvidhaApiApp } from '../app';

const officer: JwtClaims = { sub: 'USR-OFF-01', loginIdentifier: 'ro.rajeshwari', role: 'OFFICER', assignedWard: 'W-12, W-14', assignedZone: 'Zone 2', type: 'access', iat: 0, exp: 9999999999, jti: 'test' };
const temporaryDirs: string[] = [];

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suvidha-safeguards-'));
  temporaryDirs.push(dir);
  const store = new JsonFileDataStore(dir);
  await store.resetToDeterministicSeed();
  const service = new PaymentsReceiptsService(store, new MockPaymentGatewayAdapter(), new MockNotificationAdapter());
  return { store, service };
}

afterEach(async () => {
  await DatabaseManager.getInstance().close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Production safeguards', () => {
  it('persists failed-login counters and audit events before returning an error', async () => {
    const { store } = await fixture();
    const auth = new AuthAndUsersService(store);
    const attempt = { loginIdentifier: 'admin.kulkarni', password: 'wrong-password', ipAddress: '127.0.0.1', userAgent: 'test', correlationId: 'test' };
    for (let i = 0; i < 5; i++) await expect(auth.login(attempt)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const db = await store.readAll();
    expect(db.users.find((u) => u.loginIdentifier === attempt.loginIdentifier)?.status).toBe('LOCKED');
    expect(db.auditLogs.filter((a) => a.action === 'USER_LOGIN_FAILED')).toHaveLength(5);
    await expect(auth.login({ ...attempt, password: 'Suvidha@Admin2026' })).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    await store.withTransaction('EXPIRE_TEST_LOCK', (data) => {
      data.users.find((u) => u.loginIdentifier === attempt.loginIdentifier)!.lockedUntil = new Date(Date.now() - 1000).toISOString();
    });
    expect((await auth.login({ ...attempt, password: 'Suvidha@Admin2026' })).accessToken).toBeTruthy();
  });

  it('masks unexpected internal errors and rejects malformed JSON', async () => {
    const { store } = await fixture();
    const app = createSuvidhaApiApp(store);
    vi.spyOn(store, 'readAll').mockRejectedValue(new Error('private database details'));
    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(500);
    expect(JSON.stringify(health.body)).not.toContain('private database');
    const invalid = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{invalid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_JSON');
  });

  it('enforces configured origins and handles authorized preflight', async () => {
    const { store } = await fixture();
    vi.stubEnv('CORS_ORIGIN', 'https://municipality.invalid');
    const app = createSuvidhaApiApp(store);
    expect((await request(app).get('/api/v1/health/live').set('Origin', 'https://untrusted.invalid')).status).toBe(403);
    const allowed = await request(app).options('/api/v1/auth/login').set('Origin', 'https://municipality.invalid');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://municipality.invalid');
  });
  it('stores reset-token digests and disables undeliverable password recovery outside demo', async () => {
    const { store } = await fixture();
    const auth = new AuthAndUsersService(store);
    const result = await auth.forgotPassword('admin.kulkarni');
    expect((await store.readAll()).resetTokens[0].token).not.toBe(result.resetToken);
    expect((await store.readAll()).resetTokens[0].token).toMatch(/^[a-f0-9]{64}$/);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SUVIDHAPAY_DEMO_MODE', 'false');
    await expect(auth.forgotPassword('admin.kulkarni')).rejects.toMatchObject({ code: 'PASSWORD_RESET_NOT_CONFIGURED' });
  });

  it('rejects removed storage engines rather than silently switching stores', () => {
    vi.stubEnv('DATABASE_ENGINE', 'LOKIJS');
    expect(() => loadConfig()).toThrow('Only DATABASE_ENGINE=POSTGRES');
  });

  it('does not replace an unavailable PostgreSQL server with an embedded store', async () => {
    vi.spyOn(PostgresDataStore.prototype, 'initialize').mockRejectedValue(new Error('database unavailable'));
    const close = vi.spyOn(PostgresDataStore.prototype, 'close').mockResolvedValue();
    const manager = DatabaseManager.getInstance();
    await expect(manager.initialize()).rejects.toThrow('database unavailable');
    expect(close).toHaveBeenCalledOnce();
    expect((await manager.getHealth()).status).toBe('DOWN');
    expect(() => manager.getStore()).toThrow('not been initialized');
  });

  it('requires distinct strong production signing secrets and explicit CORS origin', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUVIDHAPAY_DEMO_MODE', 'false');
    vi.stubEnv('JWT_ACCESS_SECRET', '');
    vi.stubEnv('JWT_REFRESH_SECRET', '');
    expect(() => loadConfig()).toThrow('JWT secrets');
    vi.stubEnv('JWT_ACCESS_SECRET', 'a'.repeat(48));
    vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(48));
    vi.stubEnv('CORS_ORIGIN', '*');
    expect(() => loadConfig()).toThrow('CORS_ORIGIN');
    vi.stubEnv('CORS_ORIGIN', 'https://municipality.invalid');
    expect(loadConfig().demoMode).toBe(false);
  });

  it('forbids demo mode in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUVIDHAPAY_DEMO_MODE', 'true');
    expect(() => loadConfig()).toThrow('Demo mode is forbidden');
  });

  it('does not fabricate gateway, notification or government success without demo opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SUVIDHAPAY_DEMO_MODE', 'false');
    const gateway = new MockPaymentGatewayAdapter();
    await expect(gateway.createOrder({ paymentId: 'test', entityId: 'test', amountInr: 1 })).rejects.toMatchObject({ code: 'PAYMENT_GATEWAY_NOT_CONFIGURED' });
    expect(gateway.verifyWebhookSignature({ payloadRaw: '{}', signature: 'MOCK_VALID_WEBHOOK_SIGNATURE', secret: 'test' })).toBe(false);
    expect((await new MockNotificationAdapter().dispatch({ channel: 'SMS', recipientMobile: '9000000001', messageBody: 'test' })).status).toBe('FAILED');
    expect((await new MockGovVerificationAdapter().verifyVehicleOrVendor({ registrationNumber: 'TEST', ownerName: 'test', simulateMode: 'VERIFIED' })).status).toBe('SERVICE_UNAVAILABLE');
  });

  it('checks jurisdiction before returning already-verified payment data', async () => {
    const { store, service } = await fixture();
    const payment = (await store.readAll()).payments.find((p) => p.receiptId)!;
    expect(payment).toBeDefined();
    await expect(service.verifyPayment({ ...officer, assignedWard: 'NO-SUCH-WARD' }, payment.id, {}, 'test')).rejects.toMatchObject({ code: 'JURISDICTION_FORBIDDEN' });
  });

  it('prevents another actor from obtaining an idempotent cash-payment response', async () => {
    const { service } = await fixture();
    const payload = { entityId: 'ENT-1001', amountInr: 1, idempotencyKey: 'private-key' };
    await service.recordCashPayment(officer, payload, 'test');
    await expect(service.recordCashPayment({ ...officer, sub: 'OTHER-OFFICER' }, payload, 'test')).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('does not allow browser gateway confirmation outside demo mode', async () => {
    const { service } = await fixture();
    const result = await service.createOnlinePaymentOrder(officer, { entityId: 'ENT-1001', amountInr: 1 }, 'test');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SUVIDHAPAY_DEMO_MODE', 'false');
    await expect(service.verifyPayment(officer, result.payment.id, {}, 'test')).rejects.toMatchObject({ code: 'PAYMENT_GATEWAY_NOT_CONFIGURED' });
  });
});
