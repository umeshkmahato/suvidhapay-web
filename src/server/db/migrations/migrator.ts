import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

export class PostgresMigrator {
  private readonly migrationsDir: string;

  constructor(
    private readonly pool: Pool,
    migrationsDir?: string
  ) {
    this.migrationsDir =
      migrationsDir || path.resolve(__dirname, '../../../server/db/migrations');
    if (!fs.existsSync(this.migrationsDir)) {
      // Fallback for tsx / production bundle locations
      this.migrationsDir = path.resolve(process.cwd(), 'src/server/db/migrations');
    }
  }

  /**
   * Initializes the schema_migrations tracking table and applies all pending migrations in order.
   * Halts with an error if any migration fails.
   */
  public async migrate(): Promise<string[]> {
    const client = await this.pool.connect();
    const applied: string[] = [];

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      const res = await client.query<MigrationRecord>(
        'SELECT name FROM schema_migrations ORDER BY id ASC;'
      );
      const appliedSet = new Set(res.rows.map((r) => r.name));

      let files: string[] = [];
      if (fs.existsSync(this.migrationsDir)) {
        files = fs
          .readdirSync(this.migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort();
      }

      for (const file of files) {
        if (!appliedSet.has(file)) {
          const filePath = path.join(this.migrationsDir, file);
          const sql = fs.readFileSync(filePath, 'utf-8');
          console.log(`[PostgresMigrator] Applying migration: "${file}"...`);

          await this.applySingleMigration(client, file, sql);
          applied.push(file);
          console.log(`[PostgresMigrator] Successfully applied: "${file}".`);
        }
      }

      return applied;
    } finally {
      client.release();
    }
  }

  /**
   * Executes a single migration file SQL within an explicit transaction.
   */
  public async applySingleMigration(
    client: PoolClient,
    name: string,
    sql: string
  ): Promise<void> {
    try {
      await client.query('BEGIN;');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name, applied_at) VALUES ($1, now());',
        [name]
      );
      await client.query('COMMIT;');
    } catch (err) {
      await client.query('ROLLBACK;');
      console.error(`[PostgresMigrator] Migration "${name}" failed and was rolled back!`, err);
      throw new Error(`Migration "${name}" failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Returns list of all applied migrations from the database.
   */
  public async getAppliedMigrations(): Promise<string[]> {
    try {
      const res = await this.pool.query<MigrationRecord>(
        'SELECT name FROM schema_migrations ORDER BY id ASC;'
      );
      return res.rows.map((r) => r.name);
    } catch {
      return [];
    }
  }
}
