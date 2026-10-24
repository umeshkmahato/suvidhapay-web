import { Request, Response, NextFunction } from 'express';
import { AppError, JwtClaims, verifyJwt, loadConfig } from '../infra/core';
import { IDataStore } from '../repositories/interfaces';
import { UserRole } from '../types/suvidha';

declare global {
  namespace Express {
    interface Request {
      authUser?: JwtClaims;
    }
  }
}

export function requireAuth(store: IDataStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.header('authorization');
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Bearer token');
      }
      const token = authHeader.slice(7).trim();
      const config = loadConfig();
      const claims = verifyJwt(token, config.jwtAccessSecret);
      if (claims.type !== 'access') {
        throw new AppError(401, 'INVALID_TOKEN_TYPE', 'Expected an access token');
      }

      const data = await store.readAll();
      const user = data.users.find((u) => u.id === claims.sub);
      if (!user) {
        throw new AppError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists');
      }
      if (user.status !== 'ACTIVE') {
        throw new AppError(
          403,
          'ACCOUNT_DISABLED',
          `Account ${user.loginIdentifier} is currently ${user.status}`
        );
      }

      req.authUser = {
        ...claims,
        role: user.role,
        assignedWard: user.assignedWard,
        assignedZone: user.assignedZone,
        linkedEntityIds: user.linkedEntityIds,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN_ROLE',
          `Role ${req.authUser.role} is not authorized for this operation. Allowed: ${allowedRoles.join(', ')}`
        )
      );
    }
    next();
  };
}

/**
 * Checks whether an authenticated user has jurisdiction over a specific Ward Code or Ward ID.
 * - ADMIN has universal jurisdiction ("ALL WARDS").
 * - OFFICER / AGENT have comma-separated ward codes (e.g. "W-12, W-14" or "W-12").
 */
export function hasWardJurisdiction(
  authUser: JwtClaims,
  wardCodeOrId: string,
  allWards: Array<{ id: string; code: string }>
): boolean {
  if (authUser.role === 'ADMIN') return true;
  if (authUser.assignedWard === 'ALL WARDS' || authUser.assignedWard === 'ALL') {
    return true;
  }

  const wardObj = allWards.find(
    (w) =>
      w.id.toUpperCase() === wardCodeOrId.toUpperCase() ||
      w.code.toUpperCase() === wardCodeOrId.toUpperCase()
  );
  const targetCode = wardObj ? wardObj.code.toUpperCase() : wardCodeOrId.toUpperCase();
  const targetId = wardObj ? wardObj.id.toUpperCase() : wardCodeOrId.toUpperCase();

  const assignedList = authUser.assignedWard
    .split(',')
    .map((s) => s.trim().toUpperCase());

  return assignedList.includes(targetCode) || assignedList.includes(targetId);
}

/**
 * Checks whether a CITIZEN owns the requested entityId.
 */
export function assertCitizenEntityOwnership(
  authUser: JwtClaims,
  entityId: string,
  entityMobile?: string
): void {
  if (authUser.role !== 'CITIZEN') return;
  const linked = authUser.linkedEntityIds || [];
  const matchesId = linked.includes(entityId);
  const matchesMobile =
    entityMobile && authUser.loginIdentifier === entityMobile;

  if (!matchesId && !matchesMobile) {
    throw new AppError(
      403,
      'CITIZEN_OWNERSHIP_VIOLATION',
      `Citizen account is not authorized to access records for entity ${entityId}`
    );
  }
}
