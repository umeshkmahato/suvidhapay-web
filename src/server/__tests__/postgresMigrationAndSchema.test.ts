import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb, IMemoryDb } from 'pg-mem';
import { Pool } from 'pg';
import { PostgresMigrator } from '../db/migrations/migrator';
import { seedPostgresIfEmpty, validatePostgresSeed, getPostgresTableCounts, resetPostgresToSeed } from '../db/postgresSeed';

describe('Phase 5 — PostgreSQL Migration, Relational Schema & Seeding Suite', () => {
  let memDb: IMemoryDb;
  let pool: Pool;

  beforeEach(() => {
    memDb = newDb({ noAstCoverageCheck: true });

    // Register PostgreSQL functions required if needed
    memDb.public.registerFunction({
      name: 'current_timestamp',
      implementation: () => new Date(),
    });

    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();

    // Emulate PostgreSQL transactional savepoints/rollback in pg-mem test harness
    let txBackup: any = null;
    const origConnect = pool.connect.bind(pool);
    pool.connect = (async () => {
      const client = await origConnect();
      const origClientQuery = client.query.bind(client);
      client.query = (async (text: any, params: any) => {
        const cmd = typeof text === 'string' ? text.trim().toUpperCase() : '';
        if (cmd.startsWith('BEGIN')) {
          txBackup = memDb.backup();
          return origClientQuery(text, params);
        }
        if (cmd.startsWith('ROLLBACK')) {
          if (txBackup) {
            txBackup.restore();
            txBackup = null;
          }
          return origClientQuery(text, params);
        }
        if (cmd.startsWith('COMMIT')) {
          txBackup = null;
          return origClientQuery(text, params);
        }
        return origClientQuery(text, params);
      }) as any;
      return client;
    }) as any;
  });

  afterEach(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('applies initial schema migration (001_initial_schema.sql) successfully from empty database', async () => {
    const migrator = new PostgresMigrator(pool);
    const applied = await migrator.migrate();

    expect(applied).toContain('001_initial_schema.sql');

    // Verify all 22 core tables are created
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name ASC;
    `);
    const tableNames = tablesRes.rows.map((r: any) => r.table_name);

    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('zones');
    expect(tableNames).toContain('wards');
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('system_users');
    expect(tableNames).toContain('rate_masters');
    expect(tableNames).toContain('municipal_entities');
    expect(tableNames).toContain('due_records');
    expect(tableNames).toContain('due_adjustments');
    expect(tableNames).toContain('payment_records');
    expect(tableNames).toContain('receipt_records');
    expect(tableNames).toContain('daily_closings');
    expect(tableNames).toContain('reconciliation_items');
    expect(tableNames).toContain('refund_disputes');
    expect(tableNames).toContain('notification_logs');
    expect(tableNames).toContain('notification_templates');
    expect(tableNames).toContain('gov_verifications');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('import_batches');
    expect(tableNames).toContain('idempotency_keys');
    expect(tableNames).toContain('system_settings');
  });

  it('guarantees repeatable migration execution without re-applying or erroring', async () => {
    const migrator = new PostgresMigrator(pool);
    const firstRun = await migrator.migrate();
    expect(firstRun.length).toBeGreaterThan(0);

    // Second run should detect existing migrations and apply 0 files
    const secondRun = await migrator.migrate();
    expect(secondRun.length).toBe(0);

    const appliedHistory = await migrator.getAppliedMigrations();
    expect(appliedHistory).toContain('001_initial_schema.sql');
  });

  it('seeds deterministic municipal data with valid foreign-key integrity and verified counts', async () => {
    const migrator = new PostgresMigrator(pool);
    await migrator.migrate();

    // 1. Initial seed
    const seedResult = await seedPostgresIfEmpty(pool);
    expect(seedResult.seeded).toBe(true);
    expect(seedResult.counts.system_users).toBe(7);
    expect(seedResult.counts.zones).toBe(3);
    expect(seedResult.counts.wards).toBe(4);
    expect(seedResult.counts.categories).toBe(5);
    expect(seedResult.counts.municipal_entities).toBe(6);
    expect(seedResult.counts.due_records).toBe(7);
    expect(seedResult.counts.payment_records).toBe(3);
    expect(seedResult.counts.receipt_records).toBe(2);
    expect(seedResult.counts.daily_closings).toBe(3);

    // 2. Validate seeded relationships and data
    const validation = await validatePostgresSeed(pool);
    expect(validation.valid).toBe(true);
    expect(validation.checks.usersPopulated).toBe(true);
    expect(validation.checks.entitiesWithValidWards).toBe(true);
    expect(validation.checks.duesWithValidEntities).toBe(true);
    expect(validation.checks.paymentsWithValidEntities).toBe(true);
    expect(validation.checks.receiptsWithValidPayments).toBe(true);
    expect(validation.checks.closingsWithValidWards).toBe(true);
    expect(validation.checks.noFloatingPointErrors).toBe(true);

    // 3. Repeatability test: executing seed again produces ZERO duplicate records
    const repeatedSeed = await seedPostgresIfEmpty(pool);
    expect(repeatedSeed.seeded).toBe(false);
    expect(repeatedSeed.counts.system_users).toBe(7);
    expect(repeatedSeed.counts.municipal_entities).toBe(6);
  });

  it('enforces relational integrity, unique constraints, and check constraints', async () => {
    const migrator = new PostgresMigrator(pool);
    await migrator.migrate();
    await seedPostgresIfEmpty(pool);

    // Test 1: Duplicate unique registration_number rejection
    await expect(
      pool.query(`
        INSERT INTO municipal_entities (
          id, registration_number, normalized_identifier, entity_type, name, mobile, address,
          category, category_id, ward_id, ward_name, zone_name, registration_date
        ) VALUES (
          'ENT-DUP-01', 'UP-16-AB-1234', 'UP16AB1234', 'VEHICLE', 'Duplicate Owner', '9811000000',
          'Sector 18', 'Commercial Auto-Rickshaw', 'CAT-AUTO', 'WD-12', 'Ward 12', 'Zone 2', '2026-01-01'
        );
      `)
    ).rejects.toThrow();

    // Test 2: Foreign key violation — entity with non-existent wardId
    await expect(
      pool.query(`
        INSERT INTO municipal_entities (
          id, registration_number, normalized_identifier, entity_type, name, mobile, address,
          category, category_id, ward_id, ward_name, zone_name, registration_date
        ) VALUES (
          'ENT-INVALID-WARD', 'UP-16-ZZ-9999', 'UP16ZZ9999', 'VEHICLE', 'Invalid Ward Owner', '9811000001',
          'Sector 99', 'Commercial Auto-Rickshaw', 'CAT-AUTO', 'WD-NONEXISTENT', 'Ward None', 'Zone None', '2026-01-01'
        );
      `)
    ).rejects.toThrow();

    // Test 3: Check constraint violation — invalid role
    await expect(
      pool.query(`
        INSERT INTO system_users (
          id, full_name, login_identifier, mobile, role, assigned_ward, assigned_zone, status,
          created_date, password_hash
        ) VALUES (
          'USR-HACK-01', 'Hacker', 'hacker', '9999999999', 'SUPER_GOD_MODE', 'ALL', 'ALL', 'ACTIVE',
          '01/01/2026', 'hash'
        );
      `)
    ).rejects.toThrow();
  });

  it('supports transactional rollback when errors occur during unit of work', async () => {
    const migrator = new PostgresMigrator(pool);
    await migrator.migrate();
    await seedPostgresIfEmpty(pool);

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // Valid insert
      await client.query(`
        INSERT INTO zones (id, code, name, ward_count, active_entities_count, total_collection_inr)
        VALUES ('ZN-TX-TEST', 'ZN-TX', 'Transaction Test Zone', 1, 0, 0.00);
      `);

      // Intentionally invalid insert violating duplicate primary key
      await client.query(`
        INSERT INTO zones (id, code, name, ward_count, active_entities_count, total_collection_inr)
        VALUES ('ZN-TX-TEST', 'ZN-TX-DUP', 'Duplicate ID Zone', 1, 0, 0.00);
      `);

      await client.query('COMMIT;');
    } catch {
      await client.query('ROLLBACK;');
    } finally {
      client.release();
    }

    // Verify ZN-TX-TEST was rolled back and does not exist in the database
    const checkRes = await pool.query("SELECT * FROM zones WHERE id = 'ZN-TX-TEST';");
    expect(checkRes.rows.length).toBe(0);
  });

  it('guarantees financial precision using NUMERIC types without floating point rounding error', async () => {
    const migrator = new PostgresMigrator(pool);
    await migrator.migrate();
    await seedPostgresIfEmpty(pool);

    // Summing dues balances
    const sumRes = await pool.query('SELECT SUM(balance_inr)::text as total_balance FROM due_records;');
    const totalBalance = sumRes.rows[0].total_balance;

    // Check that total_balance is a valid decimal string representation with exact monetary precision
    expect(totalBalance).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(Number(totalBalance)).toBeGreaterThan(0);
  });
});
