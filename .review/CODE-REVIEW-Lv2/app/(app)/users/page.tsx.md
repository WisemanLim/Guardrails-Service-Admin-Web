# app/(app)/users/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../INDEX.md)

## 파일 요약
- 역할: 사용자 목록. **클라이언트 측 role 체크** 후 listUsers 호출.
- 진입점 거리: 0 (라우트 진입).
- LOC: 61
- export: default `UsersPage`
- 의존 모듈: `@/lib/api`, `@/lib/auth`, `@/lib/types`
- 외부 패키지: react
- 부수효과: getStoredUser + listUsers
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/users/page.tsx lines=1-61
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
```

**분석 (Level 2)**
- L13-18 **role 가드**: `getStoredUser` 는 localStorage 의 user JSON. 사용자가 devtools 로 `localStorage.gr_admin_user` 의 role 을 `super_admin` 으로 위조하면 이 가드를 통과한다. 그 다음 `api.listUsers()` 호출 — 백엔드가 JWT 의 실제 role 로 검증해 403 을 반환해야 함. **본 컴포넌트의 가드는 cosmetic** (페이지 표시 차단). 백엔드가 진짜 경계.
- L14 `u?.role !== 'super_admin'`: role 비교. lib/auth.ts 의 `getStoredUser` 반환 타입에 role 이 `string` 으로 좁혀져 있어 비교는 통과 (정확히 'admin'/'super_admin'/'viewer' 중 하나).
- L17 `return;`: useEffect 안에서 early return. loading=false, error 설정. OK.
- L19-28 fetch: try/catch/finally. cancellation 없음.
- L48-49 `new Date(... ).toLocaleString()`: client only.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- **클라이언트 측 role 가드의 본질적 한계** — INDEX.md 4.1, 4.3 에서 지적. 사용자 메타가 localStorage 라 자기-위조 가능.
- 백엔드 401/403 의존: api.listUsers 가 403 반환 시 본 컴포넌트는 catch → error 표시. 401 은 api.ts 의 글로벌 핸들러로 /login 이동. 403 은 별도 처리 — UX 차이 점검.
- 출력 React escape — XSS 안전.
- `u.status` 가 `string` (types.ts) — 백엔드가 user 입력값을 그대로 status 에 넣지 않는 한 안전.

**파일 수준 평가**
- 강점
  1. 클라이언트 사이드 진입 가드로 불필요 호출 회피.
  2. 빈 상태 메시지.
  3. 테이블 구조 명확.
- 위험
  1. localStorage role 위조 시 cosmetic 가드 우회 — 백엔드 의존.
  2. 가드와 403 처리의 이중 메시지 가능성 (둘 다 setError).
  3. cancellation race.
- 개선 권고
  1. 가드 메시지를 별도 상태(`forbidden: boolean`)로 분리해 백엔드 에러와 구분.
  2. 백엔드의 me() 응답에서 role 을 신뢰해 진짜 가드로 사용 (한 번 더 fetch 비용).
  3. AbortController.
- 재읽기 권고 레벨: **MEDIUM** — role 가드 모델의 보안 가정 재확인.
