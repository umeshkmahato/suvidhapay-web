import { afterAll, describe, expect, it } from 'vitest';
import { PostgresDataStore } from '../db/postgresDataStore';
import { AuthAndUsersService } from '../services/authAndUsersService';

const url = process.env.SUVIDHAPAY_TEST_DATABASE_URL;
const store = url ? new PostgresDataStore({ connectionString: url, autoSeed: true }) : null;

describe.skipIf(!url)('Isolated real PostgreSQL authentication', () => {
  afterAll(async () => { await store?.close(); });

  it('persists login, refresh rotation, logout and lockout without rewriting financial rows', async () => {
    if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated database ending in _test');
    await store!.initialize();
    await store!.getPool().query("UPDATE system_users SET status='ACTIVE',failed_login_attempts=0,locked_until=NULL WHERE login_identifier='admin.kulkarni'");
    const before = await store!.getPool().query('SELECT row_to_json(p) AS document FROM payment_records p ORDER BY id');
    const auth = new AuthAndUsersService(store!);
    const input = { loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026', ipAddress: '127.0.0.1', userAgent: 'isolated-test', correlationId: 'isolated-test' };
    const login = await auth.login(input);
    expect((await store!.readAll()).sessions.some((s) => s.userId === login.user.id && !s.revokedAt)).toBe(true);
    const rotated = await auth.refreshSession({ refreshToken: login.refreshToken, ipAddress: input.ipAddress, userAgent: input.userAgent });
    await expect(auth.refreshSession({ refreshToken: login.refreshToken, ipAddress: input.ipAddress, userAgent: input.userAgent })).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REVOKED' });
    await auth.logout(rotated.refreshToken);
    await expect(auth.refreshSession({ refreshToken: rotated.refreshToken, ipAddress: input.ipAddress, userAgent: input.userAgent })).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REVOKED' });
    for (let i = 0; i < 5; i++) await expect(auth.login({ ...input, password: 'wrong-password' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect((await store!.readAll()).users.find((u) => u.id === login.user.id)?.status).toBe('LOCKED');
    const after = await store!.getPool().query('SELECT row_to_json(p) AS document FROM payment_records p ORDER BY id');
    expect(after.rows).toEqual(before.rows);
  });
});
