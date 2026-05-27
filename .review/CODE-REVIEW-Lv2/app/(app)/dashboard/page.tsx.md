# app/(app)/dashboard/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../INDEX.md)

## 파일 요약
- 역할: 대시보드. me + 룰 통계 + 최근 로그인/감사 5건.
- 진입점 거리: 0 (라우트 진입).
- LOC: 103
- export: default `DashboardPage`
- 의존 모듈: `@/lib/api`, `@/lib/types`
- 외부 패키지: react
- 부수효과: useEffect 안에서 4개 API 호출 (me, listRules, loginHistory, auditActions)
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/dashboard/page.tsx lines=1-103
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
```

**분석 (Level 2) — fetch flow**
- L8-13 상태 5개 + error. 좋은 분리.
- L15-35 useEffect mount 1회. 4개 호출이 **순차** 실행 — 첫 실패 시 이후 호출 중단. UX 적절하나 `Promise.all` 로 병렬화 시 latency↓.
- L18-19 `api.me()`: 사용자 정보. AuthGuard 가 이미 토큰 존재만 검증, 여기서 실제 토큰 유효성 확인.
- L21 `api.listRules({ limit: 1000 })`: **all rules** 를 한 번에 가져옴 — 1000개 cap. 운영에서 룰이 1000 초과 시 통계가 부정확. 백엔드에 `/admin/rules/stats` 엔드포인트가 있다면 그것을 사용해야 함.
- L23-25 domain 별 그룹화: O(n) — 1000개 이하라 무해. 그러나 `total !== items.length` 일 때 표시되는 KPI 와 실제 도메인 분포가 어긋남.
- L27 `loginHistory(5)`: limit=5. positional 인자 — api.ts 의 시그니처 일관성 이슈와 별개로 동작 OK.
- L28-30 `auditActions({ limit: 5 })`: 객체 인자. 두 메서드 패턴 불일치 — admin-web 입장에선 큰 문제 아님.
- L31-32 catch 전체 단일 처리: 어느 호출이 실패했는지 사용자에게 표시되지 않음 (메시지만). 진단 시 어려움.
- **unmount race**: cancellation 가드 없음 — 빠른 라우트 이탈 시 setState-after-unmount 경고. INDEX.md 4.3 #5 에서 지적.

```tsx path=app/(app)/dashboard/page.tsx lines=37-103
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
```

**분석 (Level 2) — UI**
- L52 `.slice(0, 4)`: 도메인 KPI 상위 4개만 표시. 정렬 미적용 → 객체 키 순회 순서(삽입순)에 의존. domain alphabetical 또는 count desc 정렬 권고.
- L69 `new Date(l.created_at).toLocaleString()`: SSR/CSR 시간대 차이 — 그러나 `'use client'` + useEffect fetch 이므로 client only — 일관.
- L72 `{l.success ? '✓' : '✗'}`: ASCII 체크 — i18n 시 의미 약화.
- L91 `<code>{a.action}</code>`: 액션 문자열 raw 표시. backend 가 사용자 제어 가능한 값을 action 에 넣지 않는 한 안전. React escape 적용.
- L92 `{a.target_id ?? '—'}`: null 폴백.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- 모든 출력이 React text-node — XSS 안전.
- 미디어 IP/UA 표시: PII 가 일부 포함될 수 있음. 권한자만 보는 페이지라 OK.
- 1000개 룰 fetch — 트래픽/메모리 부담 운영 단계에서 재검토.

**파일 수준 평가**
- 강점
  1. KPI + 두 표의 명확한 정보 아키텍처.
  2. 빈 상태 메시지 ("없음") 일관.
  3. 책임 한 컴포넌트로 응집.
- 위험
  1. listRules(limit:1000) 의 가정 — 향후 룰 수 초과 시 정확도↓.
  2. 4 API 순차 호출 — 첫 실패 시 이후 데이터 미수집.
  3. unmount race + 4 API 순차.
- 개선 권고
  1. `/admin/rules/stats` 또는 backend pagination total + group-by 서버 처리.
  2. `Promise.allSettled` 로 4개 호출 병렬화, 부분 실패 시 부분 표시.
  3. `let alive = true; return () => alive = false;` cancellation 패턴.
- 재읽기 권고 레벨: **MEDIUM** — 룰 수 증가 시 통계 정확도 재검토.
