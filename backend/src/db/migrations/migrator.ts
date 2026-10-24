import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, PoolClient } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    if (migrationsDir) {
      this.migrationsDir = migrationsDir;
    } else if (fs.existsSync(__dirname) && fs.readdirSync(__dirname).some((f) => f.endsWith('.sql'))) {
      this.migrationsDir = __dirname;
    } else {
      const candidates = [
        path.resolve(process.cwd(), 'backend/src/db/migrations'),
        path.resolve(process.cwd(), 'src/db/migrations'),
        path.resolve(process.cwd(), 'src/server/db/migrations'),
      ];
      this.migrationsDir = candidates.find((c) => fs.existsSync(c)) || __dirname;
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
