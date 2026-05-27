# app/(app)/audit/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../INDEX.md)

## 파일 요약
- 역할: 감사 로그 viewer. 2 탭(login history / actions). 필터 + limit.
- 진입점 거리: 0 (라우트 진입).
- LOC: 123
- export: default `AuditPage`
- 의존 모듈: `@/lib/api`, `@/lib/types`
- 외부 패키지: react
- 부수효과: useEffect 안에서 loginHistory or auditActions
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/audit/page.tsx lines=1-41
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
```

**분석 (Level 2)**
- L7 `Tab` union: 2-state. OK.
- L10-17 상태 7개. URL 동기화 없음 → 새로고침 시 손실.
- L19-38 load: 탭에 따라 다른 엔드포인트. **debounce 없음** — `actionFilter`/`actorFilter` 매 키스트로크 fetch.
- L23 `api.loginHistory(limit)`: positional. userId 미지정.
- L26-30 `api.auditActions({limit, action, actorId})`: 빈 문자열은 undefined 로 정규화. 좋다.
- L40 useEffect: load 의존. tab 전환마다 자동 fetch.
- cancellation 없음 — 빠른 탭 전환 시 race.

```tsx path=app/(app)/audit/page.tsx lines=43-123
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
```

**분석 (Level 2) — UI**
- L68 `Number(e.target.value) || 100`: 빈 입력 시 100 으로 폴백. 음수도 통과 — 백엔드가 reject.
- L87 user_agent 표시: maxWidth + ellipsis. tooltip 부재 — `title={l.user_agent ?? ''}` 권고.
- L112 `<pre>{JSON.stringify(a.payload, null, 0)}</pre>`: indent 0 → 한 줄 JSON. `whiteSpace: 'pre-wrap'` 으로 줄바꿈은 가능. payload 가 거대하면 표 행 폭증 — clip 또는 expand 토글 권고.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- 출력 모두 React text-node — XSS 안전.
- **user_agent / payload** 가 사용자 입력 / 외부 출처 — XSS payload 가 들어있어도 React escape 로 안전.
- IP/UA 로깅 — PII. super_admin 등 적격자만 보는 페이지인지 백엔드가 확인.
- 권한 가드: 클라이언트 측 없음. 백엔드 책임.

**파일 수준 평가**
- 강점
  1. 2 탭 UX 일관.
  2. 필터 빈 문자열 → undefined 정규화.
  3. user_agent 행 클리핑.
- 위험
  1. debounce 부재 — 필터 입력마다 fetch.
  2. URL 동기화 없어 deep link 불가.
  3. payload 거대 시 행 폭증.
- 개선 권고
  1. 필터 입력에 useDeferredValue / debounce.
  2. URL search param 동기화.
  3. payload 클릭 시 모달로 펼치기.
- 재읽기 권고 레벨: **LOW**.
