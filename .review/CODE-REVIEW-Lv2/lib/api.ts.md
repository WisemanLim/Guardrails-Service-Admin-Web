# lib/api.ts — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: Admin REST API 단일 fetch 래퍼. 모든 엔드포인트(`/admin/**`)에 대한 호출 메서드를 `api` 객체로 노출.
- 진입점 거리: 1 (모든 `(app)/**/page.tsx`, `login/page.tsx`, `register/page.tsx`가 직접 import).
- LOC: 128
- export: `api` (const object)
- 의존 모듈: `./auth` (`getToken`, `clearSession`), `./types`
- 외부 패키지: 없음 (브라우저 `fetch`, `URL`, `FormData` 만 사용)
- 부수효과: 401 응답 시 `clearSession()` + `window.location.assign('/login?reason=expired')` 강제 이동
- 동시성/렌더 경계: `'use client'` 모듈. SSR/RSC 에서 import 불가능 (잠재적 잠금).
- 테스트 커버리지: 0 (테스트 도구 부재)

```ts path=lib/api.ts lines=1-59
'use client';

import { getToken, clearSession } from './auth';
import type {
  AuditEntry, AuthedUser, LoginHistoryEntry, LoginResponse, RegisterResponse, Rule, RuleListResponse,
} from './types';

const BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:8084';

interface ApiOpts {
  method?: string;
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: ApiOpts['query']): string {
  const u = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

async function call<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? (opts.body || opts.formData ? 'POST' : 'GET'),
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?reason=expired');
    }
    throw new Error('unauthorized');
  }
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data as T;
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
```

**분석 (Level 2) — 호출 코어**
- L1 `'use client'`: fetch 만 사용하므로 RSC 에서도 동작 가능한데, 이 디렉티브가 박혀 향후 서버 액션·서버 컴포넌트에서 `api.*` 호출 불가. BFF 도입의 사실상 잠금.
- L8 `BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:8084'`: `NEXT_PUBLIC_*` 는 빌드 타임에 client bundle에 inline 된다. 런타임에 환경변수를 바꿔도 브라우저 번들은 옛 URL 사용 — `next.config.mjs` 의 같은 fallback 과 이중 정의이며 둘 다 `localhost:8084` 라 ENV 누락 시 운영 이미지가 즉시 손상.
- L17 `buildUrl`: `new URL(`${BASE}${path}`)` — `BASE` 끝에 `/` 가 있고 `path` 가 `/admin/...` 으로 시작하면 `//admin/...` 가 된다. WHATWG URL 이 정규화하지 않으므로 백엔드가 404. 호출부는 항상 `/admin/...` 으로 시작하므로 BASE 에 trailing slash 가 들어가지 않도록 운영 규약 필요.
- L21 `if (v === undefined || v === null || v === '') continue`: `0`/`false` 는 보존. 단 `enabledOnly: false` 를 명시적으로 보내려면 호출부가 `'1'`/`undefined` 로 변환해야 한다 (`listRules` 87 라인에서 그렇게 처리).
- L29-32 헤더 구성: `Content-Type: application/json` 을 **body가 있을 때만** 설정. `formData` 의 경우 브라우저가 자동으로 multipart boundary 를 붙이므로 옳다.
- L35 method 기본값: `body || opts.formData ? 'POST' : 'GET'` — `body: false` 또는 `body: 0` 처럼 falsy body 가 들어오면 GET 으로 되돌아간다. 현재 호출부 패턴에서는 발생 안 함이지만 함정.
- L38 `cache: 'no-store'`: 모든 요청에서 Next 의 fetch 캐시 회피. 콘솔 UI 라 정당하나 성능을 더 짤 수 있다.
- L41-47 401 처리: (a) 세션 클리어, (b) `/login` 이 아닐 때만 `window.location.assign` — 무한 redirect 루프 방지. 그러나 `window.location.assign` 은 SPA 라우터를 거치지 않고 풀 리로드. 의도된 것일 수 있으나 router.replace 와 일관성 없음.
- L43 `typeof window !== 'undefined'`: SSR 안전 가드. 그러나 모듈은 `'use client'` 이므로 SSR 에서 실행되지 않는 모순.
- L48-53 에러 메시지 추출: 응답 본문이 `{message}` 또는 `{error}` 둘 중 하나에 들어있다고 가정. 백엔드가 `{errors: [...]}` 같은 다른 구조를 쓰면 `res.statusText` 로 폴백 — 사용자는 "Bad Request" 만 보게 된다.
- L57 `safeJson` 의 catch fallback: 파싱 실패 시 원본 문자열을 반환. 그러나 `data.message || data.error` 접근부에서 문자열은 `undefined` 가 되어 결국 statusText 폴백. 일관 동작.

```ts path=lib/api.ts lines=61-128
// -------------------- Auth --------------------

export const api = {
  health: () => call<{ status: string }>('/admin/health'),

  register: (email: string, password: string, role?: 'admin' | 'super_admin' | 'viewer') =>
    call<RegisterResponse>('/admin/auth/register', { body: { email, password, role } }),

  login: (email: string, password: string, totp?: string) =>
    call<LoginResponse>('/admin/auth/login', { body: { email, password, totp } }),

  me: () => call<AuthedUser>('/admin/auth/me'),

  totpQr: () => call<{ otpauth: string; qrDataUrl: string; enabled: boolean }>('/admin/auth/totp/qr'),

  enableTotp: (totp: string) =>
    call<{ enabled: boolean }>('/admin/auth/totp/enable', { body: { totp } }),

  changePassword: (currentPassword: string, newPassword: string) =>
    call<{ ok: boolean }>('/admin/auth/password', { body: { currentPassword, newPassword } }),

  // -------------------- Rules --------------------
  listRules: (q: {
    domain?: string; locale?: string; ioType?: string; category?: string;
    enabledOnly?: boolean; limit?: number; offset?: number;
  } = {}) => call<RuleListResponse>('/admin/rules', {
    query: { ...q, enabledOnly: q.enabledOnly ? '1' : undefined },
  }),

  getRule: (ruleId: string) => call<Rule>(`/admin/rules/${encodeURIComponent(ruleId)}`),

  createRule: (rule: any) => call<{ ok: boolean; ruleId: string }>('/admin/rules', { body: rule }),

  updateRule: (ruleId: string, rule: any) =>
    call<{ ok: boolean; ruleId: string }>(`/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT', body: rule,
    }),

  deleteRule: (ruleId: string) =>
    call<{ ok: boolean; deleted: number }>(`/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    }),

  bulkDelete: (ruleIds: string[]) =>
    call<{ ok: boolean; deleted: number; requested: number }>('/admin/rules', {
      method: 'DELETE', body: { ruleIds },
    }),

  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return call<{ ok: boolean; total: number; accepted: number; rejected: any[] }>(
      '/admin/rules/import-csv',
      { method: 'POST', formData: fd },
    );
  },

  // -------------------- Audit --------------------
  loginHistory: (limit = 100, userId?: string) =>
    call<{ items: LoginHistoryEntry[] }>('/admin/audit/login-history', { query: { limit, userId } }),

  auditActions: (q: { limit?: number; action?: string; actorId?: string } = {}) =>
    call<{ items: AuditEntry[] }>('/admin/audit/actions', { query: q }),

  // -------------------- Users (super_admin) --------------------
  listUsers: () => call<{ items: AuthedUser[] }>('/admin/users'),
};
```

**분석 (Level 2) — 엔드포인트 표면**
- L66 `register` 시그니처: 클라이언트가 `role` 을 임의 지정할 수 있다. 백엔드가 클라이언트 입력 `role` 을 그대로 받지 않도록(즉 super_admin 자가승격 방지) 검증해야 함. 본 리뷰는 admin-web 만 보지만, 콜사이트인 `register/page.tsx` 는 `role` 미지정으로 호출하므로 admin-web 측 위험은 없음. 단 SDK 사용 시 일반 사용자의 자가 승격 시도 가능.
- L69 `login`: `totp` 가 `undefined` 면 키 자체가 JSON 에 포함됨 (`JSON.stringify({...totp:undefined})` → `{...}`, undefined 는 자동 제거됨). OK.
- L83-88 `listRules`: `enabledOnly` 만 boolean → '1'/undefined 로 직접 변환하고 나머지는 그대로 통과. `domain: ''` 빈 문자열은 `buildUrl` 가 skip 하므로 안전.
- L92 `createRule: (rule: any)`, L94 `updateRule(... rule: any)`: **`any` 타입** — 컴파일러 보호 0. `RuleDto` 인터페이스로 좁히기 필요 (4.3 위험 #1). 또한 백엔드 API 가 `body.ruleId` 와 URL path 의 `ruleId` 가 다를 때 어떻게 동작하는지(URL 우선/거부/충돌) 불명.
- L99-102 `deleteRule`: path param 한 개. Bulk 와 시그니처 충돌 없음. **DELETE + body** (bulkDelete L106) 는 RFC 7231 상 정의되지 않은 의미. 일부 프록시는 DELETE 의 body 를 버리는 경우가 있어 운영 환경에서 주의.
- L109-116 `importCsv`: 파일 사이즈 가드 없음 (UI 측 20MB 라벨만). 거대 파일이 전송 중에 OOM 가능.
- L112 `rejected: any[]`: 호출부 `app/(app)/rules/import/page.tsx` 에서 자체 `ImportResult` 로 재단언 — 타입 약화.
- L120 `loginHistory(limit = 100, userId?)`: positional 인자, 다른 메서드는 query 객체 패턴. 일관성 부족.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML` / `eval` / `Function()`: 미사용 — PASS.
- Secret in `NEXT_PUBLIC_*`: BASE URL 만 노출 — 백엔드 호스트는 어차피 공개 정보라 OK.
- JWT 저장 → `lib/auth.ts` (`localStorage`). `api.call` 가 매 요청 헤더에 실어 보냄. **XSS 한 발이면 토큰 전량 탈취**. CSRF 는 Bearer + custom header 패턴이라 폼-제출형은 무력화되지만 XSS 표면이 더 큰 문제.
- CSRF 토큰 미사용: 쿠키-기반이 아니므로 자동 폼 CSRF 우려는 없음. 그러나 쿠키 모델로 전환 시 보강 필요.
- 클라이언트 검증 only: 비번 길이/email 형식 검증은 HTML5 attribute 뿐. 백엔드 의존.
- Open redirect: `window.location.assign('/login?reason=expired')` 만, 정적 경로 — 안전.
- Hardcoded API URL: `http://localhost:8084` fallback 이 prod 빌드에 박힐 가능성 — Dockerfile 의 ARG fallback 과 합쳐져 ENV 미주입 시 운영이 즉시 깨진다.
- Untrusted markdown rendering: 없음 — PASS.

**파일 수준 평가**
- 강점
  1. 단일 fetch 래퍼로 인증/에러/JSON 처리가 일원화 (`call`).
  2. 401 자동 로그아웃 + 무한 redirect 가드.
  3. 모든 path param 에 `encodeURIComponent` 적용.
- 위험
  1. `createRule`/`updateRule` 가 `any` — 타입 안전 0.
  2. `BASE` 와 `next.config.mjs` 가 같은 fallback 을 중복 정의해 ENV 미주입을 못 잡아냄.
  3. `cache: 'no-store'` 와 `'use client'` 가 합쳐져 RSC/Server actions 도입 시 마이그레이션 비용이 큼.
- 개선 권고
  1. `RuleDto` 타입을 `types.ts` 에 추가, `any` 제거.
  2. `BASE` 끝의 trailing slash 정규화 (`BASE.replace(/\/$/, '')`).
  3. 응답 에러 본문에 대해 `{ errors: [...] }` 등 백엔드 표준을 합의하고 메시지 추출 로직 확장.
- 재읽기 권고 레벨: **HIGH** — `createRule`/`updateRule` 의 DTO 명세 확정 + 백엔드 (`Guardrails-Service-Admin`) 의 입력 검증 합치 점검.
