'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuditEntry, LoginHistoryEntry } from '@/lib/types';

type Tab = 'login' | 'actions';

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [loginItems, setLoginItems] = useState<LoginHistoryEntry[]>([]);
  const [actionItems, setActionItems] = useState<AuditEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null); setLoading(true);
    try {
      if (tab === 'login') {
        const r = await api.loginHistory(limit);
        setLoginItems(r.items);
      } else {
        const r = await api.auditActions({
          limit,
          action: actionFilter || undefined,
          actorId: actorFilter || undefined,
        });
        setActionItems(r.items);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, limit, actionFilter, actorFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <h1>감사 로그</h1>
      {error && <div className="toast error">{error}</div>}

      <div className="tabs">
        <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>로그인 히스토리</button>
        <button className={tab === 'actions' ? 'active' : ''} onClick={() => setTab('actions')}>행위 감사 로그</button>
      </div>

      <div className="toolbar">
        {tab === 'actions' && (
          <>
            <div>
              <label>action</label>
              <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="post /admin/rules" />
            </div>
            <div>
              <label>actorId (super_admin)</label>
              <input value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="uuid" />
            </div>
          </>
        )}
        <div>
          <label>limit</label>
          <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 100)} />
        </div>
        <div>
          <label style={{ visibility: 'hidden' }}>x</label>
          <button className="btn secondary" onClick={load} disabled={loading}>{loading ? '로딩...' : '새로고침'}</button>
        </div>
      </div>

      {tab === 'login' && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>일시</th><th>이메일</th><th>IP</th><th>UA</th><th>성공</th><th>사유</th></tr>
            </thead>
            <tbody>
              {loginItems.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.email}</td>
                  <td className="muted">{l.ip ?? '—'}</td>
                  <td className="muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.user_agent ?? '—'}</td>
                  <td>{l.success ? '✓' : '✗'}</td>
                  <td className="muted">{l.reason ?? '—'}</td>
                </tr>
              ))}
              {loginItems.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>없음</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'actions' && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>일시</th><th>actor</th><th>action</th><th>target</th><th>IP</th><th>payload</th></tr>
            </thead>
            <tbody>
              {actionItems.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.actor_email ?? '—'}</td>
                  <td><code>{a.action}</code></td>
                  <td className="muted">{a.target_id ?? '—'}</td>
                  <td className="muted">{a.ip ?? '—'}</td>
                  <td><pre style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{a.payload ? JSON.stringify(a.payload, null, 0) : ''}</pre></td>
                </tr>
              ))}
              {actionItems.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>없음</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
