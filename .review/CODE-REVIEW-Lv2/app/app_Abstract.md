# app/ — 디렉터리 abstract
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 디렉터리 역할
Next.js App Router 의 루트. 두 그룹의 라우트를 가짐:
- 공개: `/`, `/login`, `/register`
- 보호 그룹 `(app)`: AuthGuard + Sidebar 셸 안에서 `/dashboard`, `/rules*`, `/audit`, `/users`, `/settings`

## 파일 인덱스 (이 디렉터리 직속)
| 파일 | LOC | RSC/Client | 리뷰 |
|---|---:|---|---|
| `layout.tsx` | 16 | **RSC** | [layout.tsx.md](./layout.tsx.md) |
| `page.tsx` | 13 | client | [page.tsx.md](./page.tsx.md) |
| `globals.css` | 102 | — | [globals.css.md](./globals.css.md) |

## 하위 디렉터리 인덱스
- [`app/login/`](./login/login_Abstract.md) — 로그인
- [`app/register/`](./register/register_Abstract.md) — 회원가입 + TOTP enroll
- [`app/(app)/`](<./(app)/(app)_Abstract.md>) — 보호 라우트 그룹

## 관찰
- **모든 페이지가 `'use client'`** — 유일한 RSC 는 두 layout.tsx (root + (app)) 뿐. 데이터 fetch 가 모두 useEffect 안. RSC 의 이점(서버 fetch, 토큰 SSR-side 사용, 스플릿) 전부 미활용.
- `app/page.tsx` 는 isLoggedIn 으로 redirect — middleware 로 대체 가능 (쿠키 모델 전환 후).
- **error.tsx / loading.tsx / not-found.tsx 부재** — App Router 규약 미활용. 라우트 별 graceful fallback 부재.
- robots 메타 부재 — admin URL 인덱싱 위험.
- globals.css 는 보안적으로 안전 (CSS injection 표면 없음, 외부 폰트 0).

## 위험 핫스팟
- 클라이언트 측 인증 가드만 (서버 경계 0).
- 보안 헤더는 next.config 책임이지만 layout 에서 메타 보강 가능.
