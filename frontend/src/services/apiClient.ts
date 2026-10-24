import { UserRole } from '../types/suvidha';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
}

const DEMO_CREDENTIALS: Record<UserRole, { loginIdentifier: string; password: string }> = {
  ADMIN: { loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026' },
  OFFICER: { loginIdentifier: 'ro.rajeshwari', password: 'Suvidha@Officer2026' },
  AGENT: { loginIdentifier: 'AG-104', password: 'Suvidha@Agent2026' },
  CITIZEN: { loginIdentifier: '9811452310', password: 'Suvidha@Citizen2026' },
};

class SuvidhaBackendClient {
  private tokensByRole: Partial<Record<UserRole, string>> = {};

  public clearTokens(): void {
    this.tokensByRole = {};
  }

  public setToken(role: UserRole, token: string): void {
    this.tokensByRole[role] = token;
  }

  public async getAccessToken(role: UserRole): Promise<string | null> {
    if (this.tokensByRole[role]) {
      return this.tokensByRole[role]!;
    }
    try {
      const creds = DEMO_CREDENTIALS[role];
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.success && json?.data?.accessToken) {
        this.tokensByRole[role] = json.data.accessToken;
        return json.data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async requestWithMeta<T>(
    role: UserRole,
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAccessToken(role);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/v1${path}`, {
        ...options,
        headers,
      });
      const json = await res.json();
      if (json?.success) {
        return { success: true, data: json.data as T };
      }
      return {
        success: false,
        error: json?.error || {
          code: 'HTTP_ERROR',
          message: json?.message || `Request failed with status ${res.status}`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      };
    }
  }

  public async request<T>(
    role: UserRole,
    path: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    const resp = await this.requestWithMeta<T>(role, path, options);
    if (resp.success && resp.data !== undefined) {
      return resp.data;
    }
    return null;
  }

  public async verifyReceiptPublic(code: string): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const res = await fetch(`/api/v1/receipts/verify/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (json?.success) {
        return { success: true, data: json.data };
      }
      return {
        success: false,
        error: json?.error || {
          code: 'NOT_FOUND',
          message: 'Receipt verification failed',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      };
    }
  }
}

export const suvidhaApi = new SuvidhaBackendClient();
