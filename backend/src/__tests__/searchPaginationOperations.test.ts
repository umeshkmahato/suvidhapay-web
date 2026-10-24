import fs from 'fs';
import path from 'path';
import os from 'os';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { JsonFileDataStore } from '../repositories/jsonDataStore';
import { createSuvidhaApiApp } from '../app';

describe('SuvidhaPay Search, Pagination, Operations & Audit Suite', () => {
  let tempDir: string;
  let store: JsonFileDataStore;
  let app: ReturnType<typeof createSuvidhaApiApp>;
  let adminToken = '';
  let officerToken = '';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suvidhapay-ops-test-'));
    store = new JsonFileDataStore(tempDir);
    await store.resetToDeterministicSeed();
    app = createSuvidhaApiApp(store);

    const admRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026' });
    expect(admRes.status).toBe(200);
    adminToken = admRes.body.data.accessToken;

    const offRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'ro.rajeshwari', password: 'Suvidha@Officer2026' });
    expect(offRes.status).toBe(200);
    officerToken = offRes.body.data.accessToken;
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('paginates and filters entities with normalized search', async () => {
    // Test entity pagination with page 1, limit 2
    const p1 = await request(app)
      .get('/api/v1/entities?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(p1.status).toBe(200);
    expect(p1.body.data.length).toBe(2);
    expect(p1.body.meta.page).toBe(1);
    expect(p1.body.meta.limit).toBe(2);
    expect(p1.body.meta.total).toBe(6);
    expect(p1.body.meta.totalPages).toBe(3);

    // Test normalized vehicle search
    const searchRes = await request(app)
      .get('/api/v1/entities/search?q=UP16AB1234')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
    expect(searchRes.body.data[0].registrationNumber).toBe('UP-16-AB-1234');
  });

  it('processes mock vehicle verification with government verification adapter', async () => {
    const verRes = await request(app)
      .post('/api/v1/verifications/vehicles')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        entityId: 'ENT-1001',
        registrationNumber: 'UP-16-AB-1234',
        ownerName: 'Ramesh Kumar',
      });
    expect(verRes.status).toBe(201);
    expect(verRes.body.data.status).toBe('VERIFIED');
    expect(verRes.body.data.registrationNumber).toBe('UP-16-AB-1234');
    expect(verRes.body.data.vehicleClass).toBe('Commercial Municipal Permit Verified');

    const getRes = await request(app)
      .get(`/api/v1/verifications/${verRes.body.data.id}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(verRes.body.data.id);
  });

  it('handles notification dispatch and audit trails', async () => {
    // Send SMS notification via mock notification adapter
    const notifRes = await request(app)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        recipientName: 'Ramesh Kumar',
        recipientMobile: '9811452310',
        channel: 'SMS',
        eventType: 'DUE_REMINDER',
      });
    expect(notifRes.status).toBe(201);
    expect(notifRes.body.data.status).toBe('DELIVERED');

    // Query audit logs with pagination and verify cryptographic correlationId
    const auditRes = await request(app)
      .get('/api/v1/audit-logs?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    expect(auditRes.body.data[0].correlationId).toBeDefined();
    expect(auditRes.body.data[0].actorRole).toBeDefined();
  });

  it('masks sensitive secrets in municipal settings and handles disputes lifecycle', async () => {
    // Get settings - check masking
    const setRes = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(setRes.status).toBe(200);
    expect(setRes.body.data.maskedSecrets.paymentGatewayApiKey).toContain('••••');
    expect(setRes.body.data.maskedSecrets.smsGatewayToken).toContain('••••');

    // Create and resolve dispute
    const dispRes = await request(app)
      .post('/api/v1/disputes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        recordType: 'DISPUTE',
        entityId: 'ENT-1001',
        paymentId: 'PAY-2026-9083',
        amountInr: 300,
        reasonCode: 'DOUBLE_DEBIT',
        description: 'Citizen charged twice on gateway',
      });
    expect(dispRes.status).toBe(201);
    expect(dispRes.body.data.status).toBe('OPEN');

    const resolveRes = await request(app)
      .post(`/api/v1/disputes/${dispRes.body.data.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        resolutionNotes: 'Bank statement verified, refund approved and settled',
      });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('RESOLVED');
  });
});
