# lib/types.ts — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 도메인 타입 정의 (Rule, Auth, Audit).
- 진입점 거리: 1 (모든 페이지/컴포넌트가 import).
- LOC: 87
- export: `Severity`, `IoType`, `Action`, `Role`, `AuthedUser`, `LoginResponse`, `RegisterResponse`, `Rule`, `RuleListResponse`, `LoginHistoryEntry`, `AuditEntry`
- 의존 모듈: 없음
- 외부 패키지: 없음
- 부수효과: 없음 (declaration-only)
- 동시성/렌더 경계: 디렉티브 없음 — 어디서나 import 가능.
- 테스트 커버리지: 0

```ts path=lib/types.ts lines=1-87
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IoType = 'input' | 'output' | 'both';
export type Action =
  | 'allow' | 'warn' | 'redact' | 'sanitize' | 'block'
  | 'block_or_redact' | 'block_or_pseudonymize' | 'aggregate_only'
  | 'refuse' | 'escalate' | 'add_disclaimer' | 'route';
export type Role = 'admin' | 'super_admin' | 'viewer';

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; email: string; role: Role; totpEnabled: boolean };
}

export interface RegisterResponse {
  userId: string;
  email: string;
  role: Role;
  totp: {
    otpauth: string;
    secret: string;
    qrDataUrl: string;
    enabled: boolean;
    hint: string;
  };
}

export interface Rule {
  rule_id: string;
  domain: string;
  locale: string;
  io_type: IoType;
  category: string;
  sub_category: string | null;
  severity: Severity;
  priority: number;
  action: Action;
  pattern_bundle: Record<string, unknown>;
  message_template: Record<string, string>;
  regulation_tags: string[];
  examples_positive: string[];
  examples_negative: string[];
  enabled: boolean;
  version: string;
  source: string;
}

export interface RuleListResponse {
  items: Rule[];
  total: number;
}

export interface LoginHistoryEntry {
  id: string;
  user_id: string | null;
  email: string;
  ip: string | null;
  user_agent: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
```

**분석 (Level 2)**
- L1-7 union literal 타입: `Severity`, `IoType`, `Role` 은 백엔드 enum 과 1:1 매칭되어야 한다. Backend repo 의 enum 과 drift 시 컴파일은 통과하지만 런타임 값 불일치. CI 에서 generate-from-openapi 로 동기화 권고.
- L4-6 `Action`: 12개 — 백엔드 `Guardrails-Service-Admin` 의 정책 엔진 액션과 일치 여부 별도 확인 필요.
- L13 `status: string`: 다른 enum (`Role`, `Severity`) 은 union 인데 여기만 `string` — 일관성 부족. 가능한 값 (`active`/`disabled`/`pending` 등) 을 명시화 권고.
- L19-24 `LoginResponse`: `tokenType: 'Bearer'` 리터럴 좋음. `expiresIn: string` — 초 단위인지 ISO 형식인지 불명. 사용처에서 인자로만 쓰이지 않으므로 영향 없음.
- L23 `user: { ... }` 인라인 객체: `AuthedUser` 와 별도로 정의되어 있어 두 형식이 갈라진다. `lib/auth.ts:getStoredUser` 가 이 좁힌 형태를 반환하고, `/users` 페이지에서 `AuthedUser` 로 받는 데 사용 — 두 타입의 swap 시 컴파일러가 못 잡아냄.
- L39-57 `Rule`: snake_case 그대로 — 백엔드 응답 모양을 클라이언트가 그대로 가져옴. 반면 `formToDto` 는 camelCase 로 보낸다 (`patternBundle`, `messageTemplate` 등). **요청과 응답의 case 가 다르다** — 의도적이라면 주석 필요.
- L49-50 `pattern_bundle: Record<string, unknown>`, `message_template: Record<string, string>` — `unknown` 은 OK. 다만 `pattern_bundle` 의 실제 키 (regex/luhnCheck 등) 가 명세화되어 있지 않아 RuleForm 의 placeholder 와 백엔드 schema 의 단일 출처 부재.
- L82 `payload: unknown`: 좋다. `any` 회피.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`/`Function()`: 없음.
- Secret 노출: 없음 (선언만).
- Action enum drift 의 보안 영향: 백엔드는 새 `Action` 을 추가했는데 admin-web 은 모르면 신규 액션을 가진 룰을 편집할 때 union 좁힘으로 fail-shut. 좋은 방향.

**파일 수준 평가**
- 강점
  1. 핵심 enum 이 literal union 으로 좁혀짐.
  2. `payload: unknown` 등 안전한 타입 선택.
- 위험
  1. `AuthedUser.status` 가 `string` — enum 화 필요.
  2. `LoginResponse.user` 와 `AuthedUser` 가 갈라져 있음.
  3. `Rule` 의 snake_case vs request DTO 의 camelCase 비대칭.
- 개선 권고
  1. `status: 'active' | 'disabled' | ...` 로 좁히기.
  2. `LoginResponse['user']` 대신 `Pick<AuthedUser, ...>` 사용해 단일 출처화.
  3. `RuleDto` 인터페이스 (camelCase 요청) 추가 후 `api.createRule`/`updateRule` 의 `any` 제거.
- 재읽기 권고 레벨: **MEDIUM** — 백엔드 enum drift 모니터링 시점에 재방문.
