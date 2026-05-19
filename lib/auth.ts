'use client';

const TOKEN_KEY = 'gr_admin_token';
const USER_KEY = 'gr_admin_user';

import type { AuthedUser, LoginResponse } from './types';

export function storeSession(login: LoginResponse) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, login.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(login.user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): { id: string; email: string; role: string; totpEnabled: boolean } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function updateStoredUser(patch: Partial<AuthedUser> & { totpEnabled?: boolean }) {
  const u = getStoredUser();
  if (!u) return;
  const next = { ...u, ...patch };
  window.localStorage.setItem(USER_KEY, JSON.stringify(next));
}
