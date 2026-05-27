# components/AuthGuard.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: `(app)` 라우트 그룹의 클라이언트 측 인증 게이트. 미로그인 시 `/login` 으로 replace.
- 진입점 거리: 1 (`app/(app)/layout.tsx` 가 직접 감싸기).
- LOC: 23
- export: default `AuthGuard`
- 의존 모듈: `next/navigation`, `@/lib/auth`
- 외부 패키지: react, next
- 부수효과: `router.replace('/login')` (useEffect 내부)
- 동시성/렌더 경계: `'use client'`. RSC layout 안에서 hydrate 후 동작.
- 테스트 커버리지: 0

```tsx path=components/AuthGuard.tsx lines=1-23
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div style={{ padding: 32, color: '#94a3b8' }}>로딩 중...</div>;
  }
  return <>{children}</>;
}
```

**분석 (Level 2)**
- L9 `useState(false)`: 초기 렌더에서 `ready=false` → "로딩 중..." UI 가 RSC shell hydrate 직후 1프레임 보인다. SSR 안전.
- L11-17 `useEffect`: 의존성 `[router]` 만. `router` 객체는 Next 가 일정 — effect 가 mount 후 1회 실행. `isLoggedIn()` 은 동기 localStorage 읽기라 race 없음.
- L13 `router.replace('/login')`: pushState 아닌 replace — 보호 페이지가 history 에 남지 않음. 좋은 선택.
- L14 `return;` 후 컴포넌트는 여전히 "로딩 중..." 을 그린다. 라우트 전환 동안 깜빡임이 있을 수 있으나 의도된 fallback.
- L19-21 `!ready` 분기: 인증 검증 동안 `children` 을 렌더하지 않음 — 보호 콘텐츠 fetch 가 조기 실행되지 않음. 좋다.
- L17 의존성 배열 누락 검사: react-hooks/exhaustive-deps 룰을 적용하면 `router` 만으로 충분. OK.

**잠재 race condition**
- 라우트 전환 중 unmount 가 일어나도 `setReady(true)` 가 호출되어 "Can't perform a React state update on an unmounted component" 경고가 dev 모드에서 발생할 수 있음. 그러나 `useEffect` 안에서만 setState 하고 setState 후 즉시 unmount 가 일어나는 시나리오는 드물어 실용상 무시 가능.

**`(app)` 라우트 그룹에서의 보호 모델**
- `(app)/layout.tsx` 는 RSC. 첫 응답에는 보호된 자식의 RSC payload 가 이미 직렬화되어 포함. 그러나 자식 페이지들이 모두 `'use client'` 이고 fetch 는 `useEffect` 에서만 시작되므로, **민감 데이터는 RSC 응답에 포함되지 않는다**. 따라서 미인증 사용자가 보호 URL 직접 입력 → 잠시 "로딩 중..." → `/login` redirect 의 흐름에서 누설은 없음.
- 다만 보호 페이지의 정적 UI 구조(테이블 헤더 등)는 미인증자에게도 잠깐 노출. 이는 정보 가치가 거의 없으므로 무시 가능.

**짚어볼 점 (frontend security)**
- 클라이언트 측 가드만 — 서버 측 경계 없음. `middleware.ts` 가 부재이므로 사용자가 JS 비활성 브라우저로 접근하면 보호 페이지 HTML(셸)이 그대로 보임. 단, 데이터 fetch 가 client-only 라 실 데이터는 없음.
- `dangerouslySetInnerHTML`/`eval`/CSRF/XSS: 해당 없음 — PASS.
- Open redirect: hardcoded `/login` 정적 경로 — 안전.

**파일 수준 평가**
- 강점
  1. 23 LOC 의 최소 구현, 의도 명확.
  2. `router.replace` 로 history 오염 회피.
  3. `ready` 게이트로 보호 콘텐츠 마운트 차단.
- 위험
  1. JS-only 가드 — `middleware.ts` 부재로 서버측 보호 경계 0.
  2. 토큰 만료 검증 부재 — 만료된 JWT 가 localStorage 에 남아 있으면 통과 후 첫 API 401.
  3. unmount race 시 dev 모드 경고 가능.
- 개선 권고
  1. JWT 만료 클레임 검사를 `isLoggedIn` 에 추가하거나 `AuthGuard` 가 `/admin/auth/me` 를 호출해 검증 후 ready.
  2. `middleware.ts` 도입 (쿠키 모델 전환 후).
  3. unmount cancellation 위해 `let alive = true; return () => { alive = false; };` 패턴 추가.
- 재읽기 권고 레벨: **MEDIUM** — JWT 저장 모델 변경 시 함께 재방문.
