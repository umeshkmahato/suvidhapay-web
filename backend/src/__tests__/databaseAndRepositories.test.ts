import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../db/database';
import { seedCollectionsIfEmpty, resetDatabaseToSeed } from '../db/seedData';
import { createRepositories } from '../repositories/domainRepositories';
import { LokiDataStore } from '../repositories/lokiDataStore';

describe('Phase 2 — LokiJS Database & Repository Foundation Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suvidha-phase2-test-'));
  });

  afterEach(async () => {
    await DatabaseManager.getInstance().close();
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('initializes LokiJS with all 22 collections, indexes, and seeded data', async () => {
    const manager = DatabaseManager.getInstance();
    const store = await manager.initialize({ dataDir: tempDir, persistenceMode: 'disk' });

    expect(store).toBeDefined();
    const health = await manager.getHealth();
    expect(health.status).toBe('HEALTHY');
    expect(health.storageEngine).toBe('LOKIJS');
    expect(health.persistenceMode).toBe('disk');
    expect(health.initialized).toBe(true);

    // Verify all 22 collections are present and populated
    const expectedCollections = [
      'users',
      'sessions',
      'resetTokens',
      'wards',
      'zones',
      'categories',
      'rates',
      'entities',
      'dues',
      'adjustments',
      'payments',
      'receipts',
      'closings',
      'reconciliations',
      'disputes',
      'notifications',
      'notificationTemplates',
      'verifications',
      'auditLogs',
      'imports',
      'idempotencyKeys',
      'settings',
    ];

    for (const col of expectedCollections) {
      expect(health.documentCounts[col]).toBeDefined();
    }
    expect(health.documentCounts.users).toBeGreaterThanOrEqual(7);
    expect(health.documentCounts.entities).toBeGreaterThanOrEqual(5);
    expect(health.documentCounts.wards).toBeGreaterThanOrEqual(4);
  });

  it('guarantees seed repeatability — running seed repeatedly does NOT create duplicates', async () => {
    const store = new LokiDataStore(tempDir, { persistence: 'memory' });

    // First seed
    const firstSeeded = await seedCollectionsIfEmpty(store);
    expect(firstSeeded).toBe(true);

    const initial = await store.readAll();
    const userCount = initial.users.length;
    const entityCount = initial.entities.length;
    const wardCount = initial.wards.length;

    // Second run should detect existing data and do nothing
    const secondSeeded = await seedCollectionsIfEmpty(store);
    expect(secondSeeded).toBe(false);

    const afterSecond = await store.readAll();
    expect(afterSecond.users.length).toBe(userCount);
    expect(afterSecond.entities.length).toBe(entityCount);
    expect(afterSecond.wards.length).toBe(wardCount);
  });

  it('blocks database reset in production mode', async () => {
    const store = new LokiDataStore(tempDir, { persistence: 'memory' });
    await seedCollectionsIfEmpty(store);

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await expect(resetDatabaseToSeed(store, false)).rejects.toThrow(
        'Database reset is strictly prohibited in production environments.'
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('domain repositories support full CRUD and enforce uniqueness & missing record checks', async () => {
    const store = new LokiDataStore(tempDir, { persistence: 'memory' });
    await resetDatabaseToSeed(store, true);
    const repos = createRepositories(store);

    // 1. Entity Repository — Lookup & Normalization
    const entity = await repos.entities.findById('ENT-1001');
    expect(entity).not.toBeNull();
    expect(entity?.registrationNumber).toBe('UP-16-AB-1234');
    expect(entity?.normalizedIdentifier).toBe('UP16AB1234');

    // Duplicate registration check
    await expect(
      repos.entities.create({
        ...entity!,
        id: 'ENT-DUPLICATE-999',
        registrationNumber: 'up-16-ab-1234',
        normalizedIdentifier: 'UP16AB1234',
      })
    ).rejects.toThrow(/already registered/i);

    // Non-existent ID handling
    const nonExistent = await repos.entities.findById('ENT-NON-EXISTENT-404');
    expect(nonExistent).toBeNull();

    await expect(
      repos.entities.update('ENT-NON-EXISTENT-404', { name: 'Ghost' })
    ).rejects.toThrow(/Entity with ID .* does not exist/i);

    // Update entity
    const updated = await repos.entities.update('ENT-1001', { name: 'Ramesh Yadav Updated' });
    expect(updated.name).toBe('Ramesh Yadav Updated');

    // 2. User Repository — Duplicate loginIdentifier check
    await expect(
      repos.users.create({
        id: 'USR-DUP-01',
        fullName: 'Fake Admin',
        loginIdentifier: 'admin.kulkarni', // already exists
        mobile: '9899001122',
        email: 'fake.admin@noida.in',
        role: 'ADMIN',
        assignedWard: 'W-12',
        assignedZone: 'Zone 2',
        status: 'ACTIVE',
        createdDate: '12/01/2026',
        lastLogin: '10/10/2026 10:00',
        passwordHash: 'scrypt$hash',
        forcePasswordChange: false,
        linkedEntityIds: [],
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
    ).rejects.toThrow(/already exists/i);

    // 3. Due Repository — Find by Entity ID
    const entityDues = await repos.dues.findByEntityId('ENT-1001');
    expect(entityDues.length).toBeGreaterThanOrEqual(1);
    for (const d of entityDues) {
      expect(d.entityId).toBe('ENT-1001');
      expect(d.outstandingAmount).toBeGreaterThanOrEqual(0);
    }

    // 4. Rate Repository — Active rate for category
    const activeAutoRate = await repos.rates.findActiveForCategory('CAT-AUTO', 'ALL');
    expect(activeAutoRate).not.toBeNull();
    expect(activeAutoRate?.amountInr).toBe(450);
  });

  it('guarantees zero metadata leakage: strips $loki and meta from all query outputs', async () => {
    const store = new LokiDataStore(tempDir, { persistence: 'memory' });
    await resetDatabaseToSeed(store, true);
    const repos = createRepositories(store);

    const entities = await repos.entities.list();
    expect(entities.length).toBeGreaterThan(0);
    for (const e of entities) {
      expect((e as any).$loki).toBeUndefined();
      expect((e as any).meta).toBeUndefined();
    }

    const users = await repos.users.list();
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect((u as any).$loki).toBeUndefined();
      expect((u as any).meta).toBeUndefined();
    }

    const receipts = await repos.receipts.list();
    expect(receipts.length).toBeGreaterThan(0);
    for (const r of receipts) {
      expect((r as any).$loki).toBeUndefined();
      expect((r as any).meta).toBeUndefined();
    }
  });

  it('handles database file corruption gracefully by auto-quarantining and recreating a fresh database', async () => {
    const dbPath = path.join(tempDir, 'suvidha_loki.db.json');
    fs.writeFileSync(dbPath, '{ this is corrupted non-json garbage content !!! ]]]');

    const manager = DatabaseManager.getInstance();
    const store = await manager.initialize({ dataDir: tempDir, persistenceMode: 'disk' });
    expect(store).toBeDefined();

    // Verify database opened and seeded properly
    const collections = await store.readAll();
    expect(collections.users.length).toBeGreaterThanOrEqual(7);

    // Verify corrupted file was quarantined
    const files = fs.readdirSync(tempDir);
    const quarantined = files.find((f) => f.includes('corrupted'));
    expect(quarantined).toBeDefined();
  });
});
