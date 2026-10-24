import { SystemUser, UserRole } from '../types/suvidha';

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

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SystemUser;
}

class SuvidhaBackendClient {
  private activeToken: string | null = null;

  private async parseJsonBody<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    if (!rawText) {
      return null;
    }

    if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
      try {
        return JSON.parse(rawText) as T;
      } catch {
        return null;
      }
    }

    return null;
  }

  public clearTokens(): void {
    this.activeToken = null;
  }

  public async logout(refreshToken: string): Promise<void> {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      console.error('Failed to revoke the server session:', err);
    }
  }

  public async login(
    loginIdentifier: string,
    password: string
  ): Promise<ApiResponse<LoginResult>> {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier, password }),
      });
      const json = await this.parseJsonBody<ApiResponse<LoginResult>>(res);

      if (res.ok && json?.success && json?.data?.accessToken && json?.data?.user) {
        return { success: true, data: json.data as LoginResult };
      }

      if (!json && !res.ok) {
        return {
          success: false,
          error: {
            code: 'API_UNAVAILABLE',
            message: 'The sign-in service is unavailable. Please start the backend and retry.',
          },
        };
      }

      return {
        success: false,
        error: json?.error || {
          code: 'AUTHENTICATION_FAILED',
          message: json && 'error' in json && typeof json.error?.message === 'string'
            ? json.error.message
            : 'Sign-in failed. Check your details and try again.',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Unable to connect to the sign-in service.',
        },
      };
    }
  }

  public setToken(_role: UserRole, token: string): void {
    this.activeToken = token;
  }

  public async getAccessToken(_role: UserRole): Promise<string | null> {
    return this.activeToken;
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
      const json = await this.parseJsonBody<ApiResponse<T>>(res);

      if (res.ok && json?.success) {
        return { success: true, data: json.data as T };
      }

      if (!json && !res.ok) {
        return {
          success: false,
          error: {
            code: 'API_UNAVAILABLE',
            message: 'The requested service is unavailable. Please check the backend connection.',
          },
        };
      }

      return {
        success: false,
        error: json?.error || {
          code: 'HTTP_ERROR',
          message: json && 'error' in json && typeof json.error?.message === 'string'
            ? json.error.message
            : `Request failed with status ${res.status}`,
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
      const json = await this.parseJsonBody<ApiResponse<Record<string, unknown>>>(res);
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
