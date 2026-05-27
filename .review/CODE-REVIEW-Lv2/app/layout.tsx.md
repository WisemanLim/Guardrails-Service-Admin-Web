# app/layout.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 루트 레이아웃 (RSC). `<html>` / `<body>` 골격, 글로벌 CSS 주입, metadata.
- 진입점 거리: 0 (모든 라우트의 루트).
- LOC: 16
- export: `metadata`, default `RootLayout`
- 의존 모듈: `next` (타입), `./globals.css`
- 외부 패키지: next, react
- 부수효과: CSS import 가 빌드 타임에 번들에 포함
- 동시성/렌더 경계: **RSC** (디렉티브 없음). HTML lang="ko".
- 테스트 커버리지: 0

```tsx path=app/layout.tsx lines=1-16
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Guardrails Admin Console',
  description: 'Customer-managed guardrail rule administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

**분석 (Level 2)**
- L1 `import type { Metadata } from 'next'`: type-only import — 빌드 출력 영향 0. 좋다.
- L2 `./globals.css`: 글로벌 스코프. App Router 에서 root layout 만 글로벌 CSS 를 import 가능. 규칙 준수.
- L4-7 `metadata`: 정적 메타. title/description 만 — viewport, themeColor, OpenGraph, Twitter card, robots 모두 없음. admin 콘솔이라 robots 차단(`{ robots: { index: false } }`)이 적절할 수 있다.
- L9 RootLayout: RSC. 가장 단순한 구조.
- L11 `<html lang="ko">`: 접근성/SEO 양호. multi-locale 지원 시 hardcoded 가 한계가 되지만 admin 콘솔은 한국어 단일로 충분.
- 누락: `<head>` 안에 viewport meta — Next.js 가 자동 주입하므로 OK. CSP/HSTS 헤더는 layout 이 아니라 `next.config.mjs` 의 `async headers()` 또는 middleware 에서 설정해야 하므로 본 파일 외 범위.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML` 등 위험 패턴: 없음.
- robots 인덱싱 차단 누락: 검색엔진에 admin 콘솔 노출 가능. `metadata.robots = { index: false, follow: false }` 권고.

**파일 수준 평가**
- 강점
  1. RSC 최소 구현, App Router 컨벤션 준수.
  2. lang="ko" 명시.
- 위험
  1. robots 차단 누락 — 운영 환경 도메인이 공개되면 인덱싱 위험.
  2. CSP/security 헤더 부재 (next.config 책임이지만 layout 에서도 meta 로 보강 가능).
- 개선 권고
  1. `metadata.robots = { index: false }` 추가.
  2. `<meta name="referrer" content="no-referrer" />` 또는 `metadata.referrer` 권고.
- 재읽기 권고 레벨: **LOW**.
