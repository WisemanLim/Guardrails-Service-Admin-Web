'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthedUser } from '@/lib/types';
import { getStoredUser } from '@/lib/auth';

export default function UsersPage() {
  const [items, setItems] = useState<AuthedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getStoredUser();
    if (u?.role !== 'super_admin') {
      setError('super_admin 권한이 필요합니다.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await api.listUsers();
        setItems(r.items);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <h1>사용자 관리</h1>
      {error && <div className="toast error">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>email</th><th>role</th><th>TOTP</th><th>status</th><th>created</th><th>last login</th></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><span className="badge action">{u.role}</span></td>
                <td>{u.totpEnabled ? '✓' : '✗'}</td>
                <td>{u.status}</td>
                <td className="muted">{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                <td className="muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
