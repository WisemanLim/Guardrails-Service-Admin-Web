# app/(app)/ — 디렉터리 abstract (route group)
> 리뷰 레벨: 2
> [← INDEX.md](../../INDEX.md)

## 디렉터리 역할
보호 라우트 그룹. layout 이 `AuthGuard + Sidebar` 셸을 적용. 그룹 안의 모든 페이지는 클라이언트 측 인증 가드 뒤에서 동작.

## 파일 인덱스
| 파일 | LOC | RSC/Client | 리뷰 |
|---|---:|---|---|
| `layout.tsx` | 13 | **RSC** | [layout.tsx.md](./layout.tsx.md) |
| `dashboard/page.tsx` | 103 | client | [dashboard/page.tsx.md](./dashboard/page.tsx.md) |
| `rules/page.tsx` | 203 | client | [rules/page.tsx.md](./rules/page.tsx.md) |
| `rules/[ruleId]/page.tsx` | 74 | client | [rules/[ruleId]/page.tsx.md](<./rules/[ruleId]/page.tsx.md>) |
| `rules/new/page.tsx` | 43 | client | [rules/new/page.tsx.md](./rules/new/page.tsx.md) |
| `rules/import/page.tsx` | 100 | client | [rules/import/page.tsx.md](./rules/import/page.tsx.md) |
| `audit/page.tsx` | 123 | client | [audit/page.tsx.md](./audit/page.tsx.md) |
| `users/page.tsx` | 61 | client | [users/page.tsx.md](./users/page.tsx.md) |
| `settings/page.tsx` | 119 | client | [settings/page.tsx.md](./settings/page.tsx.md) |

## 관찰
- 9개 라우트 모두 같은 `useEffect → IIFE async fetch → setState` 패턴. cancellation 가드 없음 — 빠른 라우트 이탈 시 setState-after-unmount 경고 + 잘못된 토스트.
- 필터/페이지 상태가 URL 에 동기화되지 않아 deep link / refresh 손실.
- `/users` 는 클라이언트 측 role 가드만 — cosmetic. 백엔드 의존.
- 다양한 페이지에서 동일한 `error` + `toast` 더블 상태 — 다중 토스트 표시 가능.
- `/rules` 등의 필터 input 이 debounce 없이 매 키스트로크 fetch.
- error.tsx / loading.tsx 부재.

## 위험 핫스팟 Top-3
1. cancellation race (모든 페이지 공통).
2. role 가드 cosmetic (`/users`).
3. `/rules/[ruleId]` 의 이중 `decodeURIComponent`.

## 다음 단계
- AbortController 또는 `let alive = true` 패턴을 모든 페이지에 적용.
- 필터 상태의 URL 동기화.
- `app/(app)/loading.tsx`, `error.tsx` 추가.
