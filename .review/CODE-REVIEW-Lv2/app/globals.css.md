# app/globals.css — 코드 리뷰
> 리뷰 레벨: 2 (보조 — security 측면 검토)
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 다크 테마 + 디자인 토큰 + 컴포넌트 기본 스타일.
- LOC: 102
- export: N/A
- 의존 모듈: 없음
- 외부 패키지: 없음
- 부수효과: app/layout.tsx 가 import → 전체 페이지에 적용
- 테스트 커버리지: 0

```css path=app/globals.css lines=1-22
:root {
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-elev: #334155;
  --border: #334155;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #38bdf8;
  --accent-2: #818cf8;
  --danger: #f87171;
  --success: #4ade80;
  --warn: #facc15;
  --radius: 8px;
}

* { box-sizing: border-box; }
html, body { padding: 0; margin: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
  font-size: 14px; line-height: 1.5; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
```

**분석 (Level 2)**
- CSS variables 로 토큰 통합 — 다크 테마 일관성. 좋다.
- 색상 contrast: `--text #e2e8f0` on `--bg #0f172a` — WCAG AA 통과 (대비비 ~12.6:1). `--text-muted #94a3b8` on `--bg` ~5.1:1 — AA pass. 좋다.
- `* { box-sizing: border-box }` — 표준 reset.
- 시스템 폰트 stack — 외부 폰트 fetch 없음. CSP 친화적.
- `a:hover` underline — 좋은 a11y.

```css path=app/globals.css lines=23-102
.app-layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { ... }
... (반복)
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.kpi { padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); }
...
.qr-box { display: inline-block; padding: 12px; background: #fff; border-radius: var(--radius); }
.qr-box img { display: block; }

pre { background: var(--bg); padding: 8px 12px; border-radius: var(--radius); overflow-x: auto;
  font-size: 12px; color: var(--text-muted); }
code { background: var(--bg); padding: 1px 4px; border-radius: 4px; font-size: 12px; }
```

**분석 (Level 2) — 컴포넌트 스타일**
- `.app-layout` 그리드: 240px sidebar + 1fr main — 반응형 미지원. 모바일에서 sidebar 가 240px 차지. media query 권고.
- `.kpi-grid auto-fit minmax(180px, 1fr)` — 반응형. 좋다.
- `.toast.{error,success,info}` 3색 정의.
- `.badge.severity-{low,medium,high,critical}` 4색 — RulesPage 에서 활용. severity 가 union 이라 사용은 안전.
- `.qr-box { background: #fff }` — 다크 테마에서도 QR 가독성 확보 (PNG QR 은 흰 배경 필요).
- 글로벌 `*`, `html, body` 외에 `position: sticky` 가 `th` 에 적용 — 테이블 헤더 고정. 좋다.

**짚어볼 점 (frontend security)**
- CSS injection 위험: className 이 데이터로 만들어지는 곳 — `badge severity-${r.severity}` (rules/page.tsx L173). severity 가 union 이라 `low|medium|high|critical` 중 하나 — CSS 주입 불가. 안전.
- 외부 폰트/이미지: 모두 inline. CSP `font-src 'self'` 가능.
- `background: #fff` (qr-box) hardcode — 다크 테마 토큰화와 일치하지 않음 (다른 모든 색은 var). 의도된 화이트 (QR 가독성). 일관성 흠.

**파일 수준 평가**
- 강점
  1. 디자인 토큰 일원화 + 충분한 대비.
  2. 시스템 폰트 stack — 외부 의존 0.
  3. severity badge 등 컴포넌트 일관.
- 위험
  1. 모바일 반응형 미지원 (sidebar 고정 240px).
  2. severity 외 데이터 className 주입 표면이 향후 늘어날 수 있음.
- 개선 권고
  1. `@media (max-width: 768px) { .app-layout { grid-template-columns: 1fr; } .sidebar { ... } }` 추가.
  2. 향후 데이터 기반 className 추가 시 enum 검증 유지.
- 재읽기 권고 레벨: **LOW**.
