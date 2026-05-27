# lib/auth.ts — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 브라우저 `localStorage` 기반 세션 저장/조회/제거.
- 진입점 거리: 1 (AuthGuard, Sidebar, login/register/settings, api.ts).
- LOC: 41
- export: `storeSession`, `getToken`, `getStoredUser`, `clearSession`, `isLoggedIn`, `updateStoredUser`
- 의존 모듈: `./types` (타입만)
- 외부 패키지: 없음
- 부수효과: `window.localStorage` 읽기/쓰기 — 외부 호출 0, 로컬 영속화.
- 동시성/렌더 경계: `'use client'`. SSR 안전 가드 `typeof window === 'undefined'`.
- 테스트 커버리지: 0

```ts path=lib/auth.ts lines=1-41
'use client';

const TOKEN_KEY = 'gr_admin_token';
const USER_KEY = 'gr_admin_user';

import type { AuthedUser, LoginResponse } from './types';

export function storeSession(login: LoginResponse) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, login.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(login.user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): { id: string; email: string; role: string; totpEnabled: boolean } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function updateStoredUser(patch: Partial<AuthedUser> & { totpEnabled?: boolean }) {
  const u = getStoredUser();
  if (!u) return;
  const next = { ...u, ...patch };
  window.localStorage.setItem(USER_KEY, JSON.stringify(next));
}
```

**분석 (Level 2)**
- L3-4 키 상수: `gr_admin_token`, `gr_admin_user` — 동일 출처 다른 앱이 같은 키를 사용하면 충돌. 현재 admin-web 전용 도메인이라 OK.
- L6 `import type ... 'after const'`: TS 는 허용하나 컨벤션 일탈. import 가 모듈 상단에 모이지 않아 가독성↓.
- L8-12 `storeSession`: SSR 가드 후 token + user JSON 저장. token 을 별도 키로 두는 것은 JSON 파싱 비용 회피 차원에서 합리적.
- L14-17 `getToken`: 단순. SSR 에서 `null` 반환.
- L19 `getStoredUser` 의 **인라인 반환 타입**이 `types.ts` 의 `AuthedUser` 와 일치하지 않음 — `status`, `lastLoginAt`, `createdAt` 누락. `LoginResponse.user` 가 `{id,email,role,totpEnabled}` 만 갖기 때문에 정확한 표현이긴 하나, **callsite (예: `/users` 의 `u?.role`)** 에서 타입이 좁혀져 의도된 의미를 잃을 가능성. 또한 반환 타입 inline 정의가 `updateStoredUser` 의 `Partial<AuthedUser>` 와 비대칭.
- L23 `try/catch`: JSON 파싱 실패 시 `null`. 동시에 storage 에 손상된 값이 남아 있어 다음 호출도 `null`. **셀프 복구 없음** — 손상 detect 시 `clearSession()` 해 주는 것이 안전.
- L32 `isLoggedIn`: token 존재 = 로그인 — 토큰의 만료 여부를 확인하지 않는다. 만료된 토큰이 storage 에 남아 있으면 `AuthGuard` 가 통과시키고 첫 API 호출에서 401 → redirect. UX 1-tick 깜빡임.
- L36-41 `updateStoredUser`: `patch` 가 `Partial<AuthedUser> & { totpEnabled?: boolean }` — 후자는 이미 전자에 포함되어 redundant. 의도는 명확화일 수 있으나 타입 잡음.

**짚어볼 점 (frontend security)**
- **JWT in `localStorage`**: XSS 즉시 탈취. **HttpOnly Secure SameSite=Lax 쿠키**로 옮기는 것이 1순위 권고. 쿠키 모델로 가면 `middleware.ts` 에서 서버측 인증 경계도 가능해진다.
- **role 메타 in `localStorage`**: 동일 출처 코드는 누구나 수정 가능. `Sidebar` 가 `Users` 메뉴를 노출/숨김하는 정도는 cosmetic 이라 OK 이지만, 사용자는 devtools 한 줄로 `super_admin` 을 흉내내 `/users` 페이지로 진입할 수 있다. 백엔드가 403 으로 차단해야 한다 (admin-web 단독으로는 검증 불가).
- CSP/CSRF/XSS: CSP 헤더는 본 프로젝트 어디에도 설정되지 않음 (`next.config.mjs` headers 없음). React 가 escape 해 주는 기본 XSS 방어 외 추가층 없음. CSP 도입 권고.
- Storage 통신 채널 누수: `storage` 이벤트는 동일 출처 다른 탭에 토큰 변경을 전파. logout 시 다른 탭은 알지 못함 (`window.addEventListener('storage', ...)` 미사용).

**파일 수준 평가**
- 강점: SSR 가드 일관, 인터페이스 최소, 코드 41 LOC.
- 위험
  1. `localStorage` JWT — XSS 탈취 노출 (전체 보안의 약한 고리).
  2. `getStoredUser` 반환 타입이 `AuthedUser` 와 다른 좁힌 형태 — 호출부에서 의도와 다른 필드 사용 시 혼란.
  3. 토큰 만료 미검증으로 보호 페이지 진입 후 401 깜빡임.
- 개선 권고
  1. HttpOnly 쿠키 모델로 마이그레이션 (middleware 동시 도입).
  2. `getStoredUser` 반환 타입을 `Pick<AuthedUser, 'id'|'email'|'role'|'totpEnabled'>` 로 명시.
  3. `isLoggedIn` 에 JWT exp 클레임 디코딩 (단순 base64) 추가, 만료 시 `clearSession()`.
- 재읽기 권고 레벨: **HIGH** — JWT 저장 모델은 admin console 의 보안 베이스라인이며 백엔드 (`Guardrails-Service-Admin`) 와 동시에 변경되어야 함.
