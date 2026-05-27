# app/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 루트 `/` 의 redirect 라우터. 토큰 유무에 따라 `/dashboard` 또는 `/login`.
- 진입점 거리: 0 (홈).
- LOC: 13
- export: default `HomePage`
- 의존 모듈: `next/navigation`, `@/lib/auth`
- 외부 패키지: react, next
- 부수효과: `router.replace` (useEffect)
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/page.tsx lines=1-13
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isLoggedIn() ? '/dashboard' : '/login');
  }, [router]);
  return null;
}
```

**분석 (Level 2)**
- L1 `'use client'`: redirect 만 하는데도 client 필수 — `isLoggedIn` 이 localStorage 를 본다. middleware 로 이전하면 client 가 불필요.
- L9-11 effect: mount 시 1회. `router.replace` 로 history 오염 회피.
- L12 `return null`: 빈 페이지 — redirect 가 instantaneous 라 사실상 안 보임. 단 라우터가 동작하기 전 1프레임은 빈 페이지. 시각적으로는 깜빡임.

**대안 비교**
1. 현재: client redirect (1프레임 깜빡임, localStorage 의존)
2. `middleware.ts` 에서 쿠키 검사 후 `NextResponse.redirect` (서버측, 깜빡임 0, JWT 쿠키 모델 필요)

JWT 저장을 localStorage 에서 쿠키로 옮기는 작업과 함께 본 파일은 삭제 + middleware 대체 가능. 현재 상태에선 적정.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- redirect target 이 정적 문자열 — open redirect 없음.
- 검색엔진 노출: `layout.tsx` 의 robots 메타로 다뤄야 함.

**파일 수준 평가**
- 강점: 단순, 의도 명확.
- 위험: middleware 부재 패턴 — 서버 측 인증 경계 0 의 일부.
- 개선 권고: middleware 도입 시 본 파일 삭제 후 미들웨어가 `/` 에서 redirect.
- 재읽기 권고 레벨: **LOW**.
