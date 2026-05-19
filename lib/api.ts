'use client';

import { getToken, clearSession } from './auth';
import type {
  AuditEntry, AuthedUser, LoginHistoryEntry, LoginResponse, RegisterResponse, Rule, RuleListResponse,
} from './types';

const BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:8084';

interface ApiOpts {
  method?: string;
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: ApiOpts['query']): string {
  const u = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

async function call<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? (opts.body || opts.formData ? 'POST' : 'GET'),
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?reason=expired');
    }
    throw new Error('unauthorized');
  }
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data as T;
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}

// -------------------- Auth --------------------

export const api = {
  health: () => call<{ status: string }>('/admin/health'),

  register: (email: string, password: string, role?: 'admin' | 'super_admin' | 'viewer') =>
    call<RegisterResponse>('/admin/auth/register', { body: { email, password, role } }),

  login: (email: string, password: string, totp?: string) =>
    call<LoginResponse>('/admin/auth/login', { body: { email, password, totp } }),

  me: () => call<AuthedUser>('/admin/auth/me'),

  totpQr: () => call<{ otpauth: string; qrDataUrl: string; enabled: boolean }>('/admin/auth/totp/qr'),

  enableTotp: (totp: string) =>
    call<{ enabled: boolean }>('/admin/auth/totp/enable', { body: { totp } }),

  changePassword: (currentPassword: string, newPassword: string) =>
    call<{ ok: boolean }>('/admin/auth/password', { body: { currentPassword, newPassword } }),

  // -------------------- Rules --------------------
  listRules: (q: {
    domain?: string; locale?: string; ioType?: string; category?: string;
    enabledOnly?: boolean; limit?: number; offset?: number;
  } = {}) => call<RuleListResponse>('/admin/rules', {
    query: { ...q, enabledOnly: q.enabledOnly ? '1' : undefined },
  }),

  getRule: (ruleId: string) => call<Rule>(`/admin/rules/${encodeURIComponent(ruleId)}`),

  createRule: (rule: any) => call<{ ok: boolean; ruleId: string }>('/admin/rules', { body: rule }),

  updateRule: (ruleId: string, rule: any) =>
    call<{ ok: boolean; ruleId: string }>(`/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT', body: rule,
    }),

  deleteRule: (ruleId: string) =>
    call<{ ok: boolean; deleted: number }>(`/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    }),

  bulkDelete: (ruleIds: string[]) =>
    call<{ ok: boolean; deleted: number; requested: number }>('/admin/rules', {
      method: 'DELETE', body: { ruleIds },
    }),

  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return call<{ ok: boolean; total: number; accepted: number; rejected: any[] }>(
      '/admin/rules/import-csv',
      { method: 'POST', formData: fd },
    );
  },

  // -------------------- Audit --------------------
  loginHistory: (limit = 100, userId?: string) =>
    call<{ items: LoginHistoryEntry[] }>('/admin/audit/login-history', { query: { limit, userId } }),

  auditActions: (q: { limit?: number; action?: string; actorId?: string } = {}) =>
    call<{ items: AuditEntry[] }>('/admin/audit/actions', { query: q }),

  // -------------------- Users (super_admin) --------------------
  listUsers: () => call<{ items: AuthedUser[] }>('/admin/users'),
};
