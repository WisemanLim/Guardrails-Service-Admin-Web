# app/login/ — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](../../INDEX.md)

## 디렉터리 역할
공개 로그인 페이지. 이메일/비밀번호/TOTP → JWT 획득 → localStorage 저장 → `/dashboard`.

## 파일 인덱스
| 파일 | LOC | 리뷰 |
|---|---:|---|
| `page.tsx` | 75 | [page.tsx.md](./page.tsx.md) |

## 관찰
- `useSearchParams` 사용으로 `dynamic = 'force-dynamic'` 명시 + Suspense 경계.
- 401 redirect 의 `?reason=expired` 와 정합되는 토스트.
- autocomplete attributes 미부착 — password manager 사용성↓.
- user enumeration 회피는 백엔드 책임.

## 위험 핫스팟
- JWT 저장 모델(localStorage) — `lib/auth.ts` 와 동일.
- autocomplete 누락.
