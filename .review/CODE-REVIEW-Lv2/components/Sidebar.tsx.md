# components/Sidebar.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 좌측 네비게이션 + 사용자 카드 + 로그아웃 버튼. role 기반 메뉴 필터.
- 진입점 거리: 1 (`app/(app)/layout.tsx` 직접 사용).
- LOC: 48
- export: default `Sidebar`
- 의존 모듈: `next/link`, `next/navigation`, `@/lib/auth`
- 외부 패키지: react, next
- 부수효과: `localStorage` 읽기(`getStoredUser`), `clearSession` + `router.replace` (로그아웃)
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=components/Sidebar.tsx lines=1-48
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/rules', label: 'Rules' },
  { href: '/rules/import', label: 'CSV Import' },
  { href: '/audit', label: 'Audit' },
  { href: '/users', label: 'Users', role: 'super_admin' as const },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <aside className="sidebar">
      <h2>Guardrails Admin</h2>
      <nav>
        {NAV.filter((n) => !n.role || n.role === user?.role).map((n) => (
          <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? 'active' : ''}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="user-card">
        <div>{user?.email ?? '—'}</div>
        <div>role: {user?.role ?? '—'}</div>
        <button className="logout" onClick={logout}>로그아웃</button>
      </div>
    </aside>
  );
}
```

**분석 (Level 2)**
- L8-15 `NAV` 상수 정의: `role: 'super_admin' as const` 는 타입 좁히기로 좋다. 다만 role 표는 `Users` 한 항목에만 적용 — 향후 다중 role 분기 시 일반화 필요.
- L19 `usePathname() ?? ''`: usePathname 은 클라이언트에서 항상 string 반환. nullish 폴백은 안전 가드.
- L20 `useState<{email, role}>(null)`: 타입이 좁혀져 있어 `totpEnabled` 등은 접근 불가 — Sidebar 의 책임 범위 명확화. 좋다.
- L22-24 `useEffect`로 user 채우기: SSR 안전. 첫 1프레임은 user=null → 메뉴 6개 중 5개만 (Users 숨김). hydrate 후 super_admin 이면 6개로 늘어남 — 깜빡임 발생.
- L26-29 `logout`: clearSession → `/login` replace. 토큰을 백엔드에 알리는 `POST /logout` 호출 없음 — JWT 가 stateless 면 OK 이지만 서버측 세션 무효화 (예: blocklist) 가 있다면 누락.
- L35 `NAV.filter((n) => !n.role || n.role === user?.role)`: role 검사. **클라이언트 측 cosmetic 가드**. 사용자가 `localStorage.gr_admin_user` 를 조작하면 메뉴를 표시 가능 (실제 접근은 백엔드가 403 으로 거부해야 함).
- L36 `pathname.startsWith(n.href)`: `/rules` 가 `/rules/new` 에서도 active 로 잡힘 — 의도된 부모-자식 강조. 다만 `/rules/import` 가 `/rules` 보다 먼저 매치되지 않아 둘 다 active 가 동시에 표시될 수 있다 (실제로 `/rules` 가 prefix). UI 정합 확인 권고.
- L43 `<button className="logout">`: form 안이 아니므로 type 기본값이 'button'. OK.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- role 기반 가드는 cosmetic — 실제 권한 차단은 백엔드 (admin API) 책임. 본 파일은 자체 보안 가정을 만들지 않으므로 OK.
- XSS: `user?.email` 출력은 React 가 자동 escape — 안전.
- 로그아웃 시 다른 탭 알림 없음 — 다른 탭의 Sidebar 가 여전히 로그인 상태로 표시. 영향 미미.

**파일 수준 평가**
- 강점
  1. NAV 가 데이터 주도 — 추가/변경 쉬움.
  2. role 가드를 cosmetic 으로만 사용한다는 사실이 코드 흐름에서 명확.
  3. 책임 좁힌 user 타입(`{email,role}`).
- 위험
  1. 로그아웃 시 서버측 토큰 무효화 호출 없음 — JWT blocklist 시 누락.
  2. `pathname.startsWith` 가 형제 경로 prefix 충돌을 만들 수 있음.
  3. user 메타 1프레임 깜빡임.
- 개선 권고
  1. `pathname === n.href || pathname.startsWith(n.href + '/')` 로 prefix 정합.
  2. 로그아웃 핸들러에 `await api.logout()` 추가(백엔드가 endpoint 제공 시).
  3. `useEffect` 초기 동기 컴퓨테이션을 막기 위해 `useSyncExternalStore` 또는 `Suspense` 로 user 로딩 통일 (선택).
- 재읽기 권고 레벨: **LOW** — 단순 UI, 보안 가정 없음.
