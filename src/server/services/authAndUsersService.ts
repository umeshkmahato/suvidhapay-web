import crypto from 'crypto';
import {
  AppError,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  loadConfig,
  JwtClaims,
} from '../infra/core';
import {
  IDataStore,
  BackendUserRecord,
  SuvidhaDataCollections,
} from '../repositories/interfaces';
import {
  UserRole,
  SystemUser,
  Ward,
  Zone,
  AuditLogEntry,
} from '../../types/suvidha';

export function appendAudit(
  collections: SuvidhaDataCollections,
  params: {
    actorName: string;
    actorRole: UserRole | 'SYSTEM_WEBHOOK';
    action: string;
    module: string;
    entityType: string;
    entityId: string;
    previousValueSummary: string;
    newValueSummary: string;
    ipAddress?: string;
    correlationId?: string;
  }
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `AUD-${10090 + collections.auditLogs.length + 1}`,
    timestamp: new Date().toISOString(),
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    module: params.module,
    entityType: params.entityType,
    entityId: params.entityId,
    previousValueSummary: params.previousValueSummary,
    newValueSummary: params.newValueSummary,
    ipAddress: params.ipAddress || '127.0.0.1',
    correlationId: params.correlationId || `corr-${crypto.randomUUID().slice(0, 8)}`,
  };
  collections.auditLogs.unshift(entry);
  return entry;
}

export function sanitizeUserDto(u: BackendUserRecord): SystemUser {
  const {
    passwordHash: _ph,
    forcePasswordChange: _fpc,
    failedLoginAttempts: _fla,
    lockedUntil: _lu,
    ...safeUser
  } = u;
  return safeUser;
}

export class AuthAndUsersService {
  constructor(private readonly store: IDataStore) {}

  public async login(params: {
    loginIdentifier: string;
    password: string;
    ipAddress: string;
    userAgent: string;
    correlationId: string;
  }) {
    const config = loadConfig();
    return this.store.withTransaction('AUTH_LOGIN', (db) => {
      const user = db.users.find(
        (u) =>
          u.loginIdentifier.toLowerCase() ===
            params.loginIdentifier.trim().toLowerCase() ||
          u.mobile === params.loginIdentifier.trim()
      );

      if (!user) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login identifier or password');
      }

      if (user.status === 'DISABLED') {
        throw new AppError(
          403,
          'ACCOUNT_DISABLED',
          'Account has been deactivated by Municipal Administrator'
        );
      }

      if (user.status === 'LOCKED') {
        throw new AppError(
          423,
          'ACCOUNT_LOCKED',
          'Account is locked due to excessive failed login attempts'
        );
      }

      const validPassword = verifyPassword(params.password, user.passwordHash);
      if (!validPassword) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.status = 'LOCKED';
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login identifier or password');
      }

      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.lastLogin = new Date().toISOString();

      const accessTokenObj = signJwt(
        {
          sub: user.id,
          loginIdentifier: user.loginIdentifier,
          role: user.role,
          assignedWard: user.assignedWard,
          assignedZone: user.assignedZone,
          linkedEntityIds: user.linkedEntityIds,
          type: 'access',
        },
        config.jwtAccessSecret,
        config.jwtAccessExpiresSec
      );

      const refreshTokenObj = signJwt(
        {
          sub: user.id,
          loginIdentifier: user.loginIdentifier,
          role: user.role,
          assignedWard: user.assignedWard,
          assignedZone: user.assignedZone,
          linkedEntityIds: user.linkedEntityIds,
          type: 'refresh',
        },
        config.jwtRefreshSecret,
        config.jwtRefreshExpiresSec
      );

      db.sessions.push({
        jti: refreshTokenObj.jti,
        userId: user.id,
        loginIdentifier: user.loginIdentifier,
        role: user.role,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(refreshTokenObj.exp * 1000).toISOString(),
        revokedAt: null,
        replacedByJti: null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      appendAudit(db, {
        actorName: `${user.fullName} (${user.loginIdentifier})`,
        actorRole: user.role,
        action: 'USER_LOGIN_SUCCESS',
        module: 'AUTHENTICATION',
        entityType: 'USER',
        entityId: user.id,
        previousValueSummary: 'Unauthenticated',
        newValueSummary: `Issued session ${refreshTokenObj.jti}`,
        ipAddress: params.ipAddress,
        correlationId: params.correlationId,
      });

      return {
        accessToken: accessTokenObj.token,
        refreshToken: refreshTokenObj.token,
        expiresIn: config.jwtAccessExpiresSec,
        user: sanitizeUserDto(user),
      };
    });
  }

  public async refreshSession(params: {
    refreshToken: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const config = loadConfig();
    const claims = verifyJwt(params.refreshToken, config.jwtRefreshSecret);
    if (claims.type !== 'refresh') {
      throw new AppError(401, 'INVALID_TOKEN_TYPE', 'Provided token is not a refresh token');
    }

    return this.store.withTransaction('AUTH_REFRESH', (db) => {
      const session = db.sessions.find((s) => s.jti === claims.jti);
      if (!session) {
        throw new AppError(401, 'SESSION_NOT_FOUND', 'Refresh token session not found');
      }
      if (session.revokedAt) {
        throw new AppError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token has already been revoked or rotated');
      }

      const user = db.users.find((u) => u.id === session.userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new AppError(403, 'ACCOUNT_DISABLED', 'User account is inactive');
      }

      // Rotate refresh token
      const newAccess = signJwt(
        {
          sub: user.id,
          loginIdentifier: user.loginIdentifier,
          role: user.role,
          assignedWard: user.assignedWard,
          assignedZone: user.assignedZone,
          linkedEntityIds: user.linkedEntityIds,
          type: 'access',
        },
        config.jwtAccessSecret,
        config.jwtAccessExpiresSec
      );

      const newRefresh = signJwt(
        {
          sub: user.id,
          loginIdentifier: user.loginIdentifier,
          role: user.role,
          assignedWard: user.assignedWard,
          assignedZone: user.assignedZone,
          linkedEntityIds: user.linkedEntityIds,
          type: 'refresh',
        },
        config.jwtRefreshSecret,
        config.jwtRefreshExpiresSec
      );

      session.revokedAt = new Date().toISOString();
      session.replacedByJti = newRefresh.jti;

      db.sessions.push({
        jti: newRefresh.jti,
        userId: user.id,
        loginIdentifier: user.loginIdentifier,
        role: user.role,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(newRefresh.exp * 1000).toISOString(),
        revokedAt: null,
        replacedByJti: null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      return {
        accessToken: newAccess.token,
        refreshToken: newRefresh.token,
        expiresIn: config.jwtAccessExpiresSec,
        user: sanitizeUserDto(user),
      };
    });
  }

  public async logout(refreshToken?: string): Promise<{ loggedOut: boolean }> {
    if (!refreshToken) return { loggedOut: true };
    const config = loadConfig();
    return this.store.withTransaction('AUTH_LOGOUT', (db) => {
      try {
        const claims = verifyJwt(refreshToken, config.jwtRefreshSecret);
        const session = db.sessions.find((s) => s.jti === claims.jti);
        if (session && !session.revokedAt) {
          session.revokedAt = new Date().toISOString();
        }
      } catch {
        // Ignore expired token on logout
      }
      return { loggedOut: true };
    });
  }

  public async forgotPassword(loginIdentifier: string) {
    return this.store.withTransaction('AUTH_FORGOT_PASSWORD', (db) => {
      const user = db.users.find(
        (u) =>
          u.loginIdentifier.toLowerCase() === loginIdentifier.trim().toLowerCase() ||
          u.mobile === loginIdentifier.trim()
      );
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'No user found with this identifier');
      }
      const resetToken = `rst_${crypto.randomBytes(12).toString('hex')}`;
      db.resetTokens.push({
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        usedAt: null,
      });
      return {
        message: 'Single-use password reset token generated (development mock)',
        resetToken,
        expiresInMinutes: 15,
      };
    });
  }

  public async resetPassword(token: string, newPassword: string) {
    return this.store.withTransaction('AUTH_RESET_PASSWORD', (db) => {
      const record = db.resetTokens.find((t) => t.token === token);
      if (!record || record.usedAt) {
        throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or already used');
      }
      if (new Date(record.expiresAt).getTime() < Date.now()) {
        throw new AppError(400, 'RESET_TOKEN_EXPIRED', 'Reset token has expired');
      }
      const user = db.users.find((u) => u.id === record.userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }
      user.passwordHash = hashPassword(newPassword);
      user.failedLoginAttempts = 0;
      if (user.status === 'LOCKED') user.status = 'ACTIVE';
      record.usedAt = new Date().toISOString();
      return { passwordReset: true };
    });
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    return this.store.withTransaction('AUTH_CHANGE_PASSWORD', (db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
      }
      user.passwordHash = hashPassword(newPassword);
      user.forcePasswordChange = false;
      return { passwordChanged: true };
    });
  }

  public async getMe(userId: string) {
    const db = await this.store.readAll();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return {
      user: sanitizeUserDto(user),
      linkedEntityIds: user.linkedEntityIds,
    };
  }

  public async listUsers(filters: { role?: string; ward?: string; status?: string }) {
    const db = await this.store.readAll();
    let list = db.users.map(sanitizeUserDto);
    if (filters.role) {
      list = list.filter((u) => u.role === filters.role);
    }
    if (filters.ward) {
      list = list.filter((u) =>
        u.assignedWard.toUpperCase().includes(filters.ward!.toUpperCase())
      );
    }
    if (filters.status) {
      list = list.filter((u) => u.status === filters.status);
    }
    return list;
  }

  public async getUserById(id: string) {
    const db = await this.store.readAll();
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `User ${id} was not found`);
    }
    const sessions = db.sessions
      .filter((s) => s.userId === id)
      .slice(-10);
    return {
      ...sanitizeUserDto(user),
      recentSessions: sessions,
    };
  }

  public async createUser(
    actor: JwtClaims,
    payload: {
      fullName: string;
      loginIdentifier: string;
      mobile: string;
      email: string;
      role: UserRole;
      assignedWard: string;
      assignedZone: string;
      password?: string;
      linkedEntityIds?: string[];
    },
    correlationId: string
  ) {
    return this.store.withTransaction('CREATE_USER', (db) => {
      const duplicate = db.users.find(
        (u) =>
          u.loginIdentifier.toLowerCase() ===
          payload.loginIdentifier.trim().toLowerCase()
      );
      if (duplicate) {
        throw new AppError(
          409,
          'DUPLICATE_USER',
          `Login identifier ${payload.loginIdentifier} already exists`
        );
      }

      const newUser: BackendUserRecord = {
        id: `USR-${payload.role.slice(0, 3)}-${100 + db.users.length + 1}`,
        fullName: payload.fullName,
        loginIdentifier: payload.loginIdentifier.trim(),
        mobile: payload.mobile,
        email: payload.email,
        role: payload.role,
        assignedWard: payload.assignedWard,
        assignedZone: payload.assignedZone,
        status: 'ACTIVE',
        createdDate: new Date().toISOString().slice(0, 10),
        lastLogin: 'Never',
        todayCashCollected: 0,
        todayDigitalCollected: 0,
        receiptCount: 0,
        closingStatus: 'OPEN',
        reconciliationVariance: 0,
        passwordHash: hashPassword(payload.password || 'Suvidha@Default2026'),
        forcePasswordChange: true,
        linkedEntityIds: payload.linkedEntityIds || [],
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      db.users.unshift(newUser);
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMIN_CREATED_USER',
        module: 'USER_MANAGEMENT',
        entityType: 'USER',
        entityId: newUser.id,
        previousValueSummary: 'None',
        newValueSummary: `Created ${newUser.fullName} (${newUser.role}) in ${newUser.assignedWard}`,
        correlationId,
      });

      return sanitizeUserDto(newUser);
    });
  }

  public async updateUser(
    actor: JwtClaims,
    id: string,
    payload: Partial<{
      fullName: string;
      mobile: string;
      email: string;
      role: UserRole;
      assignedWard: string;
      assignedZone: string;
      linkedEntityIds: string[];
    }>,
    correlationId: string
  ) {
    return this.store.withTransaction('UPDATE_USER', (db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', `User ${id} was not found`);
      }
      const prevSummary = `${user.role} | Ward: ${user.assignedWard}`;
      Object.assign(user, payload);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMIN_UPDATED_USER',
        module: 'USER_MANAGEMENT',
        entityType: 'USER',
        entityId: user.id,
        previousValueSummary: prevSummary,
        newValueSummary: `${user.role} | Ward: ${user.assignedWard}`,
        correlationId,
      });

      return sanitizeUserDto(user);
    });
  }

  public async updateUserStatus(
    actor: JwtClaims,
    id: string,
    status: 'ACTIVE' | 'DISABLED' | 'LOCKED',
    reason: string | undefined,
    correlationId: string
  ) {
    return this.store.withTransaction('UPDATE_USER_STATUS', (db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', `User ${id} was not found`);
      }
      const prevStatus = user.status;
      user.status = status;
      if (status === 'ACTIVE') {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
      } else {
        // Revoke active refresh sessions when disabling user
        db.sessions
          .filter((s) => s.userId === id && !s.revokedAt)
          .forEach((s) => {
            s.revokedAt = new Date().toISOString();
          });
      }

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: status === 'DISABLED' ? 'ADMINDISABLEDUSER' : 'ADMIN_CHANGED_USER_STATUS',
        module: 'USER_MANAGEMENT',
        entityType: 'USER',
        entityId: user.id,
        previousValueSummary: `Status: ${prevStatus}`,
        newValueSummary: `Status: ${status} (${reason || 'Administrative update'})`,
        correlationId,
      });

      return sanitizeUserDto(user);
    });
  }

  public async listWards(): Promise<Ward[]> {
    const db = await this.store.readAll();
    return db.wards;
  }

  public async createWard(
    actor: JwtClaims,
    payload: { code: string; name: string; zoneId: string; assignedOfficerId: string },
    correlationId: string
  ): Promise<Ward> {
    return this.store.withTransaction('CREATE_WARD', (db) => {
      if (db.wards.some((w) => w.code.toUpperCase() === payload.code.toUpperCase())) {
        throw new AppError(409, 'DUPLICATE_WARD_CODE', `Ward code ${payload.code} already exists`);
      }
      const zone = db.zones.find((z) => z.id === payload.zoneId) || db.zones[0];
      const officer = db.users.find((u) => u.id === payload.assignedOfficerId);
      const ward: Ward = {
        id: `WD-${db.wards.length + 20}`,
        code: payload.code.toUpperCase(),
        name: payload.name,
        zoneId: zone.id,
        zoneName: zone.name,
        assignedOfficerId: payload.assignedOfficerId,
        assignedOfficerName: officer ? officer.fullName : 'Assigned Officer',
        assignedAgentsCount: 0,
        registeredEntitiesCount: 0,
        outstandingDues: 0,
        todayCollection: 0,
        status: 'ACTIVE',
      };
      db.wards.push(ward);
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMIN_CREATED_WARD',
        module: 'WARD_MANAGEMENT',
        entityType: 'WARD',
        entityId: ward.id,
        previousValueSummary: 'None',
        newValueSummary: `Created Ward ${ward.code} (${ward.name})`,
        correlationId,
      });
      return ward;
    });
  }

  public async listZones(): Promise<Zone[]> {
    const db = await this.store.readAll();
    return db.zones;
  }

  public async createZone(
    actor: JwtClaims,
    payload: { code: string; name: string },
    correlationId: string
  ): Promise<Zone> {
    return this.store.withTransaction('CREATE_ZONE', (db) => {
      if (db.zones.some((z) => z.code.toUpperCase() === payload.code.toUpperCase())) {
        throw new AppError(409, 'DUPLICATE_ZONE_CODE', `Zone code ${payload.code} already exists`);
      }
      const zone: Zone = {
        id: `ZN-0${db.zones.length + 1}`,
        code: payload.code.toUpperCase(),
        name: payload.name,
        wardsCount: 0,
        totalEntities: 0,
        totalOutstanding: 0,
        status: 'ACTIVE',
      };
      db.zones.push(zone);
      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'ADMIN_CREATED_ZONE',
        module: 'ZONE_MANAGEMENT',
        entityType: 'ZONE',
        entityId: zone.id,
        previousValueSummary: 'None',
        newValueSummary: `Created Zone ${zone.code}`,
        correlationId,
      });
      return zone;
    });
  }
}
