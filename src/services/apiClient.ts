import { UserRole } from '../types/suvidha';

const DEMO_CREDENTIALS: Record<UserRole, { loginIdentifier: string; password: string }> = {
  ADMIN: { loginIdentifier: 'admin.kulkarni', password: 'Suvidha@Admin2026' },
  OFFICER: { loginIdentifier: 'ro.rajeshwari', password: 'Suvidha@Officer2026' },
  AGENT: { loginIdentifier: 'AG-104', password: 'Suvidha@Agent2026' },
  CITIZEN: { loginIdentifier: '9811452310', password: 'Suvidha@Citizen2026' },
};

class SuvidhaBackendClient {
  private tokensByRole: Partial<Record<UserRole, string>> = {};

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

  public async request<T>(
    role: UserRole,
    path: string,
    options: RequestInit = {}
  ): Promise<T | null> {
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
        return json.data as T;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const suvidhaApi = new SuvidhaBackendClient();
