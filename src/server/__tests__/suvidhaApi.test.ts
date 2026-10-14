import fs from 'fs';
import path from 'path';
import os from 'os';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { LokiDataStore } from '../repositories/lokiDataStore';
import { createSuvidhaApiApp } from '../app';

describe('SuvidhaPay Complete Backend REST API (/api/v1) Suite', () => {
  let tempDir: string;
  let store: LokiDataStore;
  let app: ReturnType<typeof createSuvidhaApiApp>;

  let adminToken = '';
  let officerZone2Token = ''; // Assigned W-12, W-14
  let officerZone1Token = ''; // Assigned W-04, W-19
  let agentW12Token = ''; // Assigned W-12
  let citizenToken = ''; // Linked ENT-1001, ENT-1002

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suvidhapay-test-'));
    store = new LokiDataStore(tempDir);
    await store.resetToDeterministicSeed();
    app = createSuvidhaApiApp(store);

    // Authenticate all 4 role personas
    const admRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026' });
    expect(admRes.status).toBe(200);
    adminToken = admRes.body.data.accessToken;

    const off1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'ro.rajeshwari', password: 'Suvidha@Officer2026' });
    expect(off1Res.status).toBe(200);
    officerZone2Token = off1Res.body.data.accessToken;

    const off2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'aro.arvind', password: 'Suvidha@Officer2026' });
    expect(off2Res.status).toBe(200);
    officerZone1Token = off2Res.body.data.accessToken;

    const agRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'AG-104', password: 'Suvidha@Agent2026' });
    expect(agRes.status).toBe(200);
    agentW12Token = agRes.body.data.accessToken;

    const citRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: '9811452310', password: 'Suvidha@Citizen2026' });
    expect(citRes.status).toBe(200);
    citizenToken = citRes.body.data.accessToken;
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // 1. AUTHENTICATION & SESSION LIFECYCLE TESTS
  // ==========================================================================
  it('supports login, refresh-token rotation, revoked token rejection, and password reset flow', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['x-correlation-id']).toBeDefined();
    const firstRefresh = loginRes.body.data.refreshToken;

    // Rotate refresh token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(refreshRes.status).toBe(200);
    const secondRefresh = refreshRes.body.data.refreshToken;
    expect(secondRefresh).not.toBe(firstRefresh);

    // Reusing the old rotated refresh token must fail with 401 REFRESH_TOKEN_REVOKED
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('REFRESH_TOKEN_REVOKED');

    // Reject invalid credentials & disabled account (AG-112)
    const badRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'admin.kulkarni', password: 'WrongPassword' });
    expect(badRes.status).toBe(401);

    const disabledRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ loginIdentifier: 'AG-112', password: 'Suvidha@Agent2026' });
    expect(disabledRes.status).toBe(403);
    expect(disabledRes.body.error.code).toBe('ACCOUNT_DISABLED');

    // Forgot & Reset password single-use token
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ loginIdentifier: 'AG-104' });
    expect(forgotRes.status).toBe(200);
    const resetToken = forgotRes.body.data.resetToken;

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'NewAgentPassword@2026' });
    expect(resetRes.status).toBe(200);

    // Reusing single-use reset token must fail
    const reuseReset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'NewAgentPassword@2026' });
    expect(reuseReset.status).toBe(400);
  });

  // ==========================================================================
  // 2. AUTHORIZATION, JURISDICTION & CITIZEN ISOLATION TESTS
  // ==========================================================================
  it('enforces RBAC, Officer/Agent Ward jurisdiction, and Citizen entity ownership isolation', async () => {
    // Agent cannot create a rate master (ADMIN only)
    const rateAttempt = await request(app)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({
        categoryId: 'CAT-AUTO',
        feeType: 'Unauthorized Fee',
        frequency: 'MONTHLY',
        amountInr: 999,
        effectiveFrom: '01/05/2027',
      });
    expect(rateAttempt.status).toBe(403);
    expect(rateAttempt.body.error.code).toBe('FORBIDDEN_ROLE');

    // Citizen can access own linked entity ENT-1001, but gets 403 on ENT-1003 (owned by Savitri Devi)
    const ownEnt = await request(app)
      .get('/api/v1/entities/ENT-1001/outstanding')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(ownEnt.status).toBe(200);
    expect(ownEnt.body.data.breakdown.remainingOutstandingInr).toBe(1150);

    const otherEnt = await request(app)
      .get('/api/v1/entities/ENT-1003/outstanding')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(otherEnt.status).toBe(403);
    expect(otherEnt.body.error.code).toBe('CITIZEN_OWNERSHIP_VIOLATION');

    // Officer Zone 2 (W-12, W-14) cannot approve ENT-1004 which is in Ward WD-19 (Zone 3)
    const crossWardApprove = await request(app)
      .post('/api/v1/entities/ENT-1004/approve')
      .set('Authorization', `Bearer ${officerZone2Token}`)
      .send({ comments: 'Attempting cross-ward approval' });
    expect(crossWardApprove.status).toBe(403);
    expect(crossWardApprove.body.error.code).toBe('JURISDICTION_FORBIDDEN');

    // Officer Zone 1 & 3 (aro.arvind, assigned W-04, W-19) CAN approve ENT-1004
    const validApprove = await request(app)
      .post('/api/v1/entities/ENT-1004/approve')
      .set('Authorization', `Bearer ${officerZone1Token}`)
      .send({
        comments: 'Verified RC manually in Ward 19 office',
        govVerificationStatus: 'VERIFIED',
      });
    expect(validApprove.status).toBe(200);
    expect(validApprove.body.data.registrationStatus).toBe('ACTIVE');
  });

  // ==========================================================================
  // 3. ENTITY REGISTRATION, NORMALIZATION & DUPLICATE DETECTION
  // ==========================================================================
  it('normalizes vehicle numbers, blocks duplicate registrations, and validates Indian mobile numbers', async () => {
    // Search with lowercase & hyphens matches normalized UP16AB1234
    const searchRes = await request(app)
      .get('/api/v1/entities/search?q=up-16-ab-1234')
      .set('Authorization', `Bearer ${agentW12Token}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.data[0].id).toBe('ENT-1001');

    // Duplicate registration with different formatting (up16ab1234) is rejected with 409
    const dupRes = await request(app)
      .post('/api/v1/entities')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({
        registrationNumber: 'up 16 ab 1234',
        entityType: 'VEHICLE',
        name: 'Duplicate Test',
        mobile: '9811452310',
        address: 'Sector 18 Noida',
        categoryId: 'CAT-AUTO',
        wardId: 'WD-12',
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('DUPLICATE_REGISTRATION');

    // Invalid mobile number rejected by Zod validation
    const badMobileRes = await request(app)
      .post('/api/v1/entities')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({
        registrationNumber: 'UP-16-ZZ-9988',
        entityType: 'VEHICLE',
        name: 'Bad Mobile Owner',
        mobile: '12345',
        address: 'Sector 18 Noida',
        categoryId: 'CAT-AUTO',
        wardId: 'WD-12',
      });
    expect(badMobileRes.status).toBe(400);
    expect(badMobileRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ==========================================================================
  // 4. RATE MASTER & DUE ENGINE (HISTORICAL PRESERVATION & WAIVERS)
  // ==========================================================================
  it('preserves historical due amounts when publishing a new rate and supports batch due generation & waivers', async () => {
    // Publish a new rate for CAT-AUTO effective 01/05/2027 @ INR 550
    const rateRes = await request(app)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId: 'CAT-AUTO',
        feeType: 'Revised Stand Fee 2027',
        frequency: 'MONTHLY',
        amountInr: 550,
        effectiveFrom: '01/05/2027',
        wardScope: 'ALL',
        status: 'ACTIVE',
      });
    expect(rateRes.status).toBe(201);

    // Verify historical due DUE-2026-101 still retains its originalAmount of INR 400 and remaining 250
    const duesRes = await request(app)
      .get('/api/v1/entities/ENT-1001/dues')
      .set('Authorization', `Bearer ${adminToken}`);
    const historicalDue = duesRes.body.data.find(
      (d: { id: string }) => d.id === 'DUE-2026-101'
    );
    expect(historicalDue.originalAmount).toBe(400);
    expect(historicalDue.outstandingAmount).toBe(250);

    // Waive INR 50 on DUE-2026-101
    const waiveRes = await request(app)
      .post('/api/v1/dues/DUE-2026-101/waive')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountInr: 50,
        reason: 'Approved partial stand closure waiver',
        supportingRef: 'NMC-ORDER-55',
      });
    expect(waiveRes.status).toBe(200);
    expect(waiveRes.body.data.due.outstandingAmount).toBe(200);
  });

  // ==========================================================================
  // 5. CASH COLLECTION, MULTI-DUE ALLOCATION, IDEMPOTENCY & OVERPAYMENT GUARD
  // ==========================================================================
  it('processes cash collection with FIFO multi-due allocation, enforces idempotency, blocks overpayment, and issues server receipts', async () => {
    // ENT-1001 has 3 open dues: DUE-2026-101 (250), DUE-2026-102 (450), DUE-2026-103 (450) = Total 1150
    // Pay INR 500 via CASH with Idempotency-Key
    const payRes = await request(app)
      .post('/api/v1/payments/cash')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .set('Idempotency-Key', 'idem-cash-test-001')
      .send({
        entityId: 'ENT-1001',
        amountInr: 500,
      });
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.payment.processingStatus).toBe('RECEIPT_GENERATED');
    expect(payRes.body.data.receipt.receiptNumber).toMatch(/^SUP\/2026\/\d{9}$/);
    expect(payRes.body.data.payment.allocations.length).toBe(2); // 250 to DUE-101 + 250 to DUE-102

    // Replaying exact same Idempotency-Key returns 200 without double-charging
    const replayRes = await request(app)
      .post('/api/v1/payments/cash')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .set('Idempotency-Key', 'idem-cash-test-001')
      .send({
        entityId: 'ENT-1001',
        amountInr: 500,
      });
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.meta.idempotentReplay).toBe(true);
    expect(replayRes.body.data.receipt.receiptNumber).toBe(
      payRes.body.data.receipt.receiptNumber
    );

    // Remaining balance on ENT-1001 is now 1150 - 500 = 650. Attempting to pay INR 900 must fail with OVERPAYMENT_NOT_ALLOWED
    const overpayRes = await request(app)
      .post('/api/v1/payments/cash')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({
        entityId: 'ENT-1001',
        amountInr: 900,
      });
    expect(overpayRes.status).toBe(400);
    expect(overpayRes.body.error.code).toBe('OVERPAYMENT_NOT_ALLOWED');
  });

  // ==========================================================================
  // 6. MANUAL UPI PENDING VERIFICATION WORKFLOW & PRIVACY-SAFE PUBLIC RECEIPT
  // ==========================================================================
  it('keeps manual UPI references PENDING without a receipt until Officer verification, and masks PII on public verification', async () => {
    // Agent submits manual UPI reference for ENT-1001 (INR 300)
    const upiRes = await request(app)
      .post('/api/v1/payments/manual-upi')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({
        entityId: 'ENT-1001',
        amountInr: 300,
        referenceNumber: 'UTR998877665544',
      });
    expect(upiRes.status).toBe(201);
    const paymentId = upiRes.body.data.payment.id;
    expect(upiRes.body.data.payment.processingStatus).toBe('PENDING');
    expect(upiRes.body.data.payment.settlementStatus).toBe('UNVERIFIED_MANUAL_REF');
    expect(upiRes.body.data.payment.receiptNumber).toBeUndefined();

    // Agent is forbidden from verifying their own manual UPI reference
    const agentVerifyAttempt = await request(app)
      .post(`/api/v1/payments/${paymentId}/verify`)
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({ verificationNotes: 'Self verify attempt' });
    expect(agentVerifyAttempt.status).toBe(403);

    // Officer Zone 2 verifies the manual UPI reference -> issues authoritative receipt
    const offVerifyRes = await request(app)
      .post(`/api/v1/payments/${paymentId}/verify`)
      .set('Authorization', `Bearer ${officerZone2Token}`)
      .send({ verificationNotes: 'Matched UTR in Ward 12 bank statement' });
    expect(offVerifyRes.status).toBe(200);
    expect(offVerifyRes.body.data.payment.settlementStatus).toBe('SETTLED');
    const issuedReceipt = offVerifyRes.body.data.receipt;
    expect(issuedReceipt.receiptNumber).toMatch(/^SUP\/2026\/\d{9}$/);

    // Public receipt verification endpoint returns validity without leaking mobile or address
    const pubVerify = await request(app).get(
      `/api/v1/receipts/verify/${issuedReceipt.verificationCode}`
    );
    expect(pubVerify.status).toBe(200);
    expect(pubVerify.body.data.valid).toBe(true);
    expect(pubVerify.body.data.amountInr).toBe(300);
    expect(pubVerify.body.data.mobile).toBeUndefined();
    expect(pubVerify.body.data.address).toBeUndefined();
  });

  // ==========================================================================
  // 7. DAILY CASH CLOSING, RECONCILIATION, REVERSALS, REPORTS & STAGED IMPORT
  // ==========================================================================
  it('handles daily cash closing lifecycle, reconciliation, payment reversal, reports, and staged legacy import', async () => {
    // Create & submit daily closing (Expected cash for AG-104 from stored CASH payments is INR 500)
    const clsCreate = await request(app)
      .post('/api/v1/collections/closing')
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({ actualCashCount: 400, discrepancyNote: 'INR 100 coin pouch pending' });
    expect(clsCreate.status).toBe(201);
    expect(clsCreate.body.data.expectedCash).toBe(500);
    expect(clsCreate.body.data.cashVariance).toBe(-100);
    const closingId = clsCreate.body.data.id;

    const clsSubmit = await request(app)
      .post(`/api/v1/collections/closing/${closingId}/submit`)
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({ actualCashCount: 500, discrepancyNote: 'Full cash tallied' });
    expect(clsSubmit.status).toBe(200);
    expect(clsSubmit.body.data.status).toBe('SUBMITTED');
    expect(clsSubmit.body.data.cashVariance).toBe(0);

    // Agent cannot re-submit an already SUBMITTED closing
    const editSubmitted = await request(app)
      .post(`/api/v1/collections/closing/${closingId}/submit`)
      .set('Authorization', `Bearer ${agentW12Token}`)
      .send({ actualCashCount: 10000 });
    expect(editSubmitted.status).toBe(400);
    expect(editSubmitted.body.error.code).toBe('CLOSING_IMMUTABLE_AFTER_SUBMISSION');

    // Officer verifies and closes daily closing
    const clsVerify = await request(app)
      .post(`/api/v1/collections/closing/${closingId}/verify`)
      .set('Authorization', `Bearer ${officerZone2Token}`)
      .send({ action: 'CLOSE', officerComments: 'Deposited to treasury chest' });
    expect(clsVerify.status).toBe(200);
    expect(clsVerify.body.data.status).toBe('CLOSED');

    // Reverse an existing payment PAY-2026-9083 and verify due balance is restored without deleting payment
    const revRes = await request(app)
      .post('/api/v1/payments/PAY-2026-9083/reverse')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reasonCode: 'ERRONEOUS_ENTRY',
        description: 'Reversing payment for audit test',
      });
    expect(revRes.status).toBe(200);
    expect(revRes.body.data.payment.settlementStatus).toBe('REVERSED');

    // Reports reconcile cash + verified digital totals accurately
    const repRes = await request(app)
      .get('/api/v1/reports/collections/daily')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(repRes.status).toBe(200);
    const totals = repRes.body.data.reconciledTotals;
    expect(totals.cashVerifiedInr + totals.digitalVerifiedInr).toBe(
      totals.totalVerifiedCollectionInr
    );

    // Staged Data Import detects duplicate vehicle UP-16-AB-1234 and invalid mobile while staging valid rows
    const impStage = await request(app)
      .post('/api/v1/imports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fileName: 'legacy_test.csv',
        importType: 'VEHICLES',
        rows: [
          {
            registrationNumber: 'UP-16-NEW-9001',
            name: 'Valid Imported Owner',
            mobile: '9811009900',
            categoryId: 'CAT-AUTO',
            wardId: 'WD-12',
            openingArrearsInr: 450,
          },
          {
            registrationNumber: 'up-16-ab-1234', // Duplicate of ENT-1001
            name: 'Duplicate Owner',
            mobile: '9811452310',
            categoryId: 'CAT-AUTO',
            wardId: 'WD-12',
            openingArrearsInr: 450,
          },
        ],
      });
    expect(impStage.status).toBe(201);
    expect(impStage.body.data.validRowsCount).toBe(1);
    expect(impStage.body.data.errorRowsCount).toBe(1);

    const impCommit = await request(app)
      .post(`/api/v1/imports/${impStage.body.data.id}/commit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(impCommit.status).toBe(200);
    expect(impCommit.body.data.status).toBe('COMMITTED');

    // OpenAPI 3.1 endpoint check
    const openApiRes = await request(app).get('/openapi.json');
    expect(openApiRes.status).toBe(200);
    expect(openApiRes.body.openapi).toBe('3.1.0');
  });
});
