# app/(app)/layout.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../INDEX.md)

## 파일 요약
- 역할: `(app)` 라우트 그룹의 RSC 레이아웃. AuthGuard + Sidebar 셸을 자식 페이지에 적용.
- 진입점 거리: 0 (그룹 라우트 진입점들의 부모).
- LOC: 13
- export: default `AppLayout`
- 의존 모듈: `@/components/AuthGuard`, `@/components/Sidebar`
- 외부 패키지: react
- 부수효과: 없음 (자식 컴포넌트가 효과 보유)
- 동시성/렌더 경계: **RSC** (디렉티브 없음). 그러나 자식이 client.
- 테스트 커버리지: 0

```tsx path=app/(app)/layout.tsx lines=1-13
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="app-layout">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </AuthGuard>
  );
}
```

**분석 (Level 2)**
- 파일 자체는 RSC — `'use client'` 없음. 그러나 import 한 `AuthGuard`/`Sidebar` 가 client 라 두 컴포넌트는 client boundary 로 전환.
- 결과적으로 (app) 그룹의 모든 페이지는 RSC layout shell + client subtree 구성. RSC 의 데이터 직렬화 이점은 없으며, AuthGuard 의 `ready` 게이트 통과 전까지 자식 페이지가 마운트되지 않음.
- L8 `<Sidebar />`: client. localStorage 의존이라 RSC 화 불가.
- L9 `<main className="main">{children}</main>`: 자식이 페이지 — page.tsx 들. 자식 페이지 자체가 `'use client'` 이면 그 페이지의 fetch/state 가 AuthGuard `ready` 이후 시작.
- 누락: error boundary (`error.tsx`), loading UI (`loading.tsx`), not-found (`not-found.tsx`). App Router 규약상 추가 권고.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- AuthGuard 가 client 측 가드라는 점은 components/AuthGuard 평가에서 다룸.
- 보호 라우트의 layout shell HTML 은 미인증 사용자에게도 잠시 노출 (sidebar 골격 등). 정보 가치 0.

**파일 수준 평가**
- 강점: 13 LOC 의 명료한 셸. RSC + client 조합 컨벤션 준수.
- 위험: loading/error.tsx 부재 → 자식 페이지 에러가 root layout 까지 버블.
- 개선 권고
  1. `app/(app)/loading.tsx` 추가 — AuthGuard 깜빡임 완화.
  2. `app/(app)/error.tsx` 추가 — 페이지별 fetch 실패 graceful fallback.
- 재읽기 권고 레벨: **LOW**.
