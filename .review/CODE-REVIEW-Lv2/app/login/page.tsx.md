# app/login/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 로그인 폼. email/password/TOTP → `api.login` → `storeSession` → `/dashboard`.
- 진입점 거리: 0 (라우트 진입).
- LOC: 75
- export: default `LoginPage`, `dynamic = 'force-dynamic'`
- 의존 모듈: `next/navigation`, `next/link`, `@/lib/api`, `@/lib/auth`
- 외부 패키지: react, next
- 부수효과: localStorage 저장, router.replace
- 동시성/렌더 경계: `'use client'`, `dynamic = 'force-dynamic'` (useSearchParams 가 정적 prerender 차단)
- 테스트 커버리지: 0

```tsx path=app/login/page.tsx lines=1-75
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeSession } from '@/lib/auth';

// useSearchParams forces client-side rendering — opt out of static prerender.
export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    search?.get('reason') === 'expired' ? '세션이 만료되었습니다. 다시 로그인해주세요.' : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.login(email, password, totp || undefined);
      storeSession(r);
      router.replace('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h1>로그인</h1>
      {error && <div className="toast error">{error}</div>}
      <div className="row">
        <label>이메일</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="row">
        <label>비밀번호</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="row">
        <label>TOTP 코드 (등록된 경우)</label>
        <input
          type="text" inputMode="numeric" pattern="[0-9]{6}" placeholder="123456"
          value={totp} onChange={(e) => setTotp(e.target.value)} maxLength={6}
        />
      </div>
      <button className="btn" type="submit" disabled={loading}>
        {loading ? '로그인 중...' : '로그인'}
      </button>
      <div className="alt">
        계정이 없으신가요? <Link href="/register">회원가입</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<div className="auth-card"><h1>로그인</h1><div className="muted">로딩 중...</div></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
```

**분석 (Level 2)**
- L10 `dynamic = 'force-dynamic'`: useSearchParams 가 prerender 와 호환되지 않음을 명시. 옳다.
- L13-14 `useSearchParams`: client only. Suspense 로 감쌀 의무 — `LoginPage` 가 그렇게 한다.
- L19-21 `error` 초기값을 useState 의 lazy 가 아닌 직접 계산: `useState<string | null>(... ? ... : null)`. 매 렌더마다 계산되지만 useState 는 첫 호출만 사용 — 영향 없음. lazy init `() => ...` 으로 명시 권고.
- L20 `search?.get('reason') === 'expired'` 메시지: api.ts 의 401 redirect 후 표시되는 토스트. 일관 동작.
- L23-36 submit: try/catch/finally. `totp || undefined` 로 빈 문자열을 undefined 로 정규화 → JSON 직렬화 시 키 drop.
- L28 `api.login(email, password, totp || undefined)`: TOTP 가 빈 경우 백엔드가 TOTP gate ON 사용자에게 적절히 에러 반환해야 함.
- L29 `storeSession(r)`: localStorage 저장 — 보안 가정은 `lib/auth.ts` 와 동일.
- L43 `type="email"`: HTML5 검증. 클라이언트 검증 only — 백엔드도 검증해야 함.
- L47 `type="password"`: 비번 length 검증 없음. register 페이지에는 `minLength={8}` 이 있는데 login 에는 없음 — 일관성 부족이지만 login 은 사용자 입력만 받는다는 점에서 OK.
- L52-55 TOTP input: `inputMode="numeric"`, `pattern="[0-9]{6}"`, `maxLength={6}`. 모바일 키패드 최적화. pattern 은 submit 시 HTML5 검증.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`/`Function()`: 없음.
- JWT 저장 → `lib/auth.ts` 의 localStorage. XSS 노출 (lib 평가 참조).
- 비밀번호 평문 전송: HTTPS 가정. Dockerfile 의 fallback URL 이 `http://localhost:8084` 라 prod 빌드 시 ENV 가 누락되면 평문 HTTP 전송 위험. **반드시 prod 에서 https URL 주입 필요**.
- CSRF: Bearer 토큰 + custom header — 쿠키 미사용이라 폼-제출 CSRF 위험 낮음. 로그인 자체는 인증 전이라 CSRF 표면이 아님.
- error 메시지에 백엔드 메시지 그대로 표시 — 로그인 실패 시 "사용자 없음" vs "비번 불일치" 구분이 user enumeration 으로 이어질 수 있다. 백엔드가 통일된 메시지("이메일 또는 비밀번호가 잘못되었습니다") 를 반환해야 함.
- autoFocus: 좋음.
- 자동 완성 attributes: `autocomplete="email"`, `autocomplete="current-password"` 누락 — 브라우저 password manager 친화성을 위해 추가 권고.
- Open redirect: 정적 `/dashboard` — 안전.

**파일 수준 평가**
- 강점
  1. Suspense 경계 + force-dynamic 으로 useSearchParams 사용을 안전 처리.
  2. 401 → expired 토스트 흐름이 api.ts 와 정합.
  3. controlled inputs + HTML5 검증.
- 위험
  1. user enumeration: 백엔드 메시지 그대로 노출.
  2. autocomplete 누락 — 비번 매니저 사용성↓.
  3. JWT localStorage (모듈 횡단 위험).
- 개선 권고
  1. `autoComplete="email"`, `autoComplete="current-password"`, `autoComplete="one-time-code"` 추가.
  2. error 표시를 generic 메시지로 통일하거나 백엔드와 합의.
  3. useState lazy init 으로 search 계산 분리.
- 재읽기 권고 레벨: **MEDIUM** — JWT 저장 모델 변경 시 함께.
