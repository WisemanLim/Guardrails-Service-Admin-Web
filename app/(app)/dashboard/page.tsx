'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthedUser, AuditEntry, LoginHistoryEntry, RuleListResponse } from '@/lib/types';

export default function DashboardPage() {
  const [me, setMe] = useState<AuthedUser | null>(null);
  const [rulesByDomain, setRulesByDomain] = useState<Record<string, number>>({});
  const [totalRules, setTotalRules] = useState(0);
  const [recentLogins, setRecentLogins] = useState<LoginHistoryEntry[]>([]);
  const [recentActions, setRecentActions] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await api.me();
        setMe(meRes);

        const all: RuleListResponse = await api.listRules({ limit: 1000 });
        setTotalRules(all.total);
        const grp: Record<string, number> = {};
        for (const r of all.items) grp[r.domain] = (grp[r.domain] ?? 0) + 1;
        setRulesByDomain(grp);

        const logins = await api.loginHistory(5);
        setRecentLogins(logins.items);
        const actions = await api.auditActions({ limit: 5 });
        setRecentActions(actions.items);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  return (
    <>
      <h1>대시보드</h1>
      {error && <div className="toast error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="muted">현재 로그인</div>
          <div className="num">{me?.email ?? '—'}</div>
          <div className="muted">role: {me?.role}, TOTP: {me?.totpEnabled ? 'ON' : 'OFF'}</div>
        </div>
        <div className="kpi">
          <div className="muted">총 룰 (DB 저장)</div>
          <div className="num">{totalRules}</div>
        </div>
        {Object.entries(rulesByDomain).slice(0, 4).map(([d, n]) => (
          <div className="kpi" key={d}>
            <div className="muted">{d}</div>
            <div className="num">{n}</div>
          </div>
        ))}
      </div>

      <h2>최근 로그인</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>일시</th><th>이메일</th><th>IP</th><th>성공</th><th>사유</th></tr>
          </thead>
          <tbody>
            {recentLogins.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.email}</td>
                <td className="muted">{l.ip ?? '—'}</td>
                <td>{l.success ? '✓' : '✗'}</td>
                <td className="muted">{l.reason ?? '—'}</td>
              </tr>
            ))}
            {recentLogins.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>없음</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>최근 행위 감사</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>일시</th><th>actor</th><th>action</th><th>target</th></tr>
          </thead>
          <tbody>
            {recentActions.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>{a.actor_email ?? a.actor_id ?? '—'}</td>
                <td><code>{a.action}</code></td>
                <td className="muted">{a.target_id ?? '—'}</td>
              </tr>
            ))}
            {recentActions.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>없음</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
