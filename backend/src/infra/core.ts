import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/suvidha';

export type DatabaseEngine = 'POSTGRES' | 'LOKIJS';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  dataDir: string;
  databaseEngine: DatabaseEngine;
  databaseUrl?: string;
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresSec: number;
  jwtRefreshExpiresSec: number;
  corsOrigin: string;
  allowAdvanceOverpayment: boolean;
}

export function loadConfig(): AppConfig {
  const explicitEngine = (
    process.env.DATABASE_ENGINE ||
    process.env.DB_ENGINE ||
    process.env.DATABASE_TYPE ||
    ''
  ).toUpperCase();
  const hasPgEnv = Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.POSTGRES_HOST
  );
  const databaseEngine: DatabaseEngine =
    explicitEngine === 'LOKIJS'
      ? 'LOKIJS'
      : explicitEngine === 'POSTGRES' || hasPgEnv
        ? 'POSTGRES'
        : 'POSTGRES';

  return {
    port: 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    dataDir: process.env.SUVIDHAPAY_DATA_DIR || './data',
    databaseEngine,
    databaseUrl: process.env.DATABASE_URL,
    pgHost: process.env.PGHOST || process.env.POSTGRES_HOST || 'postgres',
    pgPort: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
    pgDatabase: process.env.PGDATABASE || process.env.POSTGRES_DB || 'suvidhapay',
    pgUser: process.env.PGUSER || process.env.POSTGRES_USER || 'suvidhapay',
    pgPassword: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'suvidhapay_secret_2026',
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ||
      'dev_suvidhapay_jwt_access_secret_change_in_prod',
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'dev_suvidhapay_jwt_refresh_secret_change_in_prod',
    jwtAccessExpiresSec: Number(process.env.JWT_ACCESS_EXPIRES_SEC || 900),
    jwtRefreshExpiresSec: Number(process.env.JWT_REFRESH_EXPIRES_SEC || 604800),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    allowAdvanceOverpayment: process.env.ALLOW_ADVANCE_OVERPAYMENT === 'true',
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: unknown[] = []
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown> = {},
  statusCode = 200
): void {
  const correlationId = res.locals.correlationId || 'corr-unknown';
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details: unknown[] = []
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = Number(query.page || 1);
  const rawLimit = Number(query.limit || 25);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(100, Math.floor(rawLimit))
      : 25;
  return { page, limit };
}

export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const start = (params.page - 1) * params.limit;
  const paged = items.slice(start, start + params.limit);
  return {
    items: paged,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
    },
  };
}

/**
 * Authoritative Integer Paise Financial Arithmetic (Section 3)
 * Avoids IEEE-754 floating-point drift in currency calculations.
 */
export const Money = {
  inrToPaise(inr: number): number {
    if (!Number.isFinite(inr)) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a finite number');
    }
    return Math.round(inr * 100);
  },
  paiseToInr(paise: number): number {
    return Math.round(paise) / 100;
  },
  addInr(a: number, b: number): number {
    return Money.paiseToInr(Money.inrToPaise(a) + Money.inrToPaise(b));
  },
  subInr(a: number, b: number): number {
    return Money.paiseToInr(Money.inrToPaise(a) - Money.inrToPaise(b));
  },
};

export function normalizeVehicleRegistration(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidIndianMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/^\+91[\s-]*/, '').trim();
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Password Hashing with Node crypto.scryptSync (Section 4, 5, 12)
 */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHash] = parts;
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(originalHash, 'hex'),
    Buffer.from(derived, 'hex')
  );
}

export interface JwtClaims {
  sub: string; // userId
  loginIdentifier: string;
  role: UserRole;
  assignedWard: string;
  assignedZone: string;
  linkedEntityIds?: string[];
  jti: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signJwt(
  payload: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>,
  secret: string,
  expiresInSec: number
): { token: string; jti: string; exp: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSec;
  const jti = crypto.randomUUID();
  const fullPayload: JwtClaims = {
    ...payload,
    jti,
    iat: now,
    exp,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return {
    token: `${header}.${body}.${signature}`,
    jti,
    exp,
  };
}

export function verifyJwt(token: string, secret: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed authentication token');
  }
  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid token signature');
  }

  const claims = JSON.parse(base64UrlDecode(body)) as JwtClaims;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired');
  }
  return claims;
}

export function correlationAndSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.header('x-correlation-id');
  const correlationId =
    incomingId && incomingId.trim().length > 0
      ? incomingId.trim()
      : `corr-${crypto.randomUUID().slice(0, 12)}`;
  res.locals.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
